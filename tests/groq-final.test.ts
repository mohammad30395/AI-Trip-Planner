import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const openAiMocks = vi.hoisted(() => ({
  chatCreate: vi.fn(),
  clientOptions: [] as unknown[],
}))

vi.mock("openai", () => {
  class MockAPIConnectionTimeoutError extends Error {}
  class MockAPIUserAbortError extends Error {}
  class MockRateLimitError extends Error {
    readonly status = 429
    readonly headers: Headers

    constructor(
      _status: 429,
      _error: object | undefined,
      _message: string | undefined,
      headers: Headers
    ) {
      super("rate limited")
      this.headers = headers
    }
  }

  class MockOpenAI {
    readonly chat = {
      completions: {
        create: openAiMocks.chatCreate,
      },
    }

    constructor(options: unknown) {
      openAiMocks.clientOptions.push(options)
    }
  }

  return {
    default: MockOpenAI,
    APIConnectionTimeoutError: MockAPIConnectionTimeoutError,
    APIUserAbortError: MockAPIUserAbortError,
    RateLimitError: MockRateLimitError,
  }
})

import {
  APIConnectionTimeoutError,
  RateLimitError,
} from "openai"

import { parseFinalItineraryResponse } from "@/lib/ai/contract"
import {
  groqFinalItineraryWireSchema,
  normalizeGroqFinalItineraryWire,
} from "@/lib/ai/groq-final-schema"
import {
  getGroqFinalMaxCompletionTokens,
  GROQ_FINAL_MAX_COMPLETION_TOKENS_CAP,
  runGroqFinalItinerary,
  type GroqFinalProviderErrorMetadata,
} from "@/lib/ai/groq"
import {
  buildGroqFinalMessages,
  completeOneDayWireFixture,
  oneDayExperimentalCompletionBudget,
  oneDayRequirements,
} from "@/tests/helpers/groq-final-one-day"
import {
  getStep4A3ClientSnapshot,
  getStep4A3OutgoingRequestSnapshot,
} from "@/tests/helpers/groq-final-400-diagnostic"

const originalGroqApiKey = process.env.GROQ_API_KEY
const originalGroqModel = process.env.GROQ_MODEL

beforeEach(() => {
  process.env.GROQ_API_KEY = "unit-test-secret"
  process.env.GROQ_MODEL = "unit-test-model"
  openAiMocks.chatCreate.mockReset()
  openAiMocks.clientOptions.length = 0
})

afterEach(() => {
  restoreEnvironmentVariable("GROQ_API_KEY", originalGroqApiKey)
  restoreEnvironmentVariable("GROQ_MODEL", originalGroqModel)
})

describe("Groq strict final wire schema", () => {
  test("closes every object and requires every declared property", () => {
    expect(auditStrictWireSchema(groqFinalItineraryWireSchema)).toEqual({
      objectNodes: 8,
      anyOfBranches: 3,
      problems: [],
      unsupportedKeywords: [],
    })
  })

  test("represents every application-optional field as nullable", () => {
    expect(
      groqFinalItineraryWireSchema.properties.practicalNotes.type
    ).toEqual(["array", "null"])
    expect(
      groqFinalItineraryWireSchema.properties.travelPlan.properties.groupType.type
    ).toEqual(["string", "null"])

    const hotel = groqFinalItineraryWireSchema.properties.hotels.items.properties
    expect(hotel.area.type).toEqual(["string", "null"])
    expect(hotel.address.type).toEqual(["string", "null"])
    expect(hotel.priceTier.type).toEqual(["string", "null"])

    const activity =
      groqFinalItineraryWireSchema.properties.itinerary.items.properties.activities
        .items.properties
    expect(activity.timeOfDay.type).toEqual(["string", "null"])
    expect(activity.duration.type).toEqual(["string", "null"])
    const [specificPlace, genericActivity, transport] = activity.place.anyOf
    expect(specificPlace.properties.name.type).toBe("string")
    expect(genericActivity.properties.name.type).toBe("null")
    expect(transport.properties.name.type).toBe("null")

    for (const placeVariant of activity.place.anyOf) {
      expect(placeVariant.properties.addressHint.type).toEqual([
        "string",
        "null",
      ])
      expect(placeVariant.properties.areaHint.type).toEqual(["string", "null"])
      expect(placeVariant.properties.originHint.type).toEqual([
        "string",
        "null",
      ])
      expect(placeVariant.properties.destinationHint.type).toEqual([
        "string",
        "null",
      ])
    }
  })

  test("does not permit canonical provider, coordinate, image, or rating fields", () => {
    const schema = JSON.stringify(groqFinalItineraryWireSchema)

    for (const forbiddenField of [
      "providerPlaceId",
      "providerId",
      "latitude",
      "longitude",
      "imageUrl",
      "rating",
      "availability",
    ]) {
      expect(schema).not.toContain(`\"${forbiddenField}\"`)
    }
  })
})

describe("Groq wire-to-application normalization", () => {
  test("removes only nullable placeholders without mutating the wire value", () => {
    const wireValue = wireItinerary(1)
    const original = structuredClone(wireValue)
    const normalized = normalizeGroqFinalItineraryWire(wireValue)

    expect(wireValue).toEqual(original)
    expect(normalized).not.toHaveProperty("practicalNotes")
    expect(normalized).not.toHaveProperty("travelPlan.groupType")
    expect(normalized).not.toHaveProperty("hotels.0.area")
    expect(normalized).not.toHaveProperty("hotels.0.address")
    expect(normalized).not.toHaveProperty("hotels.0.priceTier")
    expect(normalized).not.toHaveProperty("itinerary.0.activities.0.timeOfDay")
    expect(normalized).not.toHaveProperty("itinerary.0.activities.0.duration")
    expect(normalized).not.toHaveProperty("itinerary.0.activities.0.place.name")
  })

  test("produces a value accepted by the canonical application parser", () => {
    const parsed = parseFinalItineraryResponse(
      normalizeGroqFinalItineraryWire(wireItinerary(1))
    )

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.itinerary[0]?.activities[0]?.place).toEqual({
        kind: "generic_activity",
        name: null,
        addressHint: null,
        areaHint: null,
        originHint: null,
        destinationHint: null,
      })
    }
  })

  test("preserves forbidden provider fields so runtime validation rejects them", () => {
    const wireValue = wireItinerary(1)
    Object.assign(wireValue.itinerary[0]?.activities[0]?.place ?? {}, {
      providerPlaceId: "forbidden-provider-id",
    })

    const parsed = parseFinalItineraryResponse(
      normalizeGroqFinalItineraryWire(wireValue)
    )

    expect(parsed.ok).toBe(false)
  })
})

describe("isolated Groq final itinerary adapter", () => {
  test("reconstructs the exact Step 4A.3 request without changing SDK options", async () => {
    mockFinalCompletion(JSON.stringify(completeOneDayWireFixture))
    const observer = vi.fn()

    const result = await runGroqFinalItinerary(
      {
        messages: buildGroqFinalMessages(oneDayRequirements),
        durationDays: 1,
        maxCompletionTokens: oneDayExperimentalCompletionBudget,
      },
      undefined,
      { observeProviderError: observer }
    )

    expect(result.ok).toBe(true)
    expect(observer).not.toHaveBeenCalled()
    expect(getFirstChatRequest()).toEqual(
      getStep4A3OutgoingRequestSnapshot("unit-test-model")
    )
    expect(openAiMocks.chatCreate.mock.calls[0]?.[1]).toEqual({
      signal: undefined,
      timeout: 90_000,
    })
    expect(openAiMocks.clientOptions[0]).toEqual({
      apiKey: "unit-test-secret",
      ...getStep4A3ClientSnapshot(),
    })
  })

  test("sends the strict wire schema with bounded Groq-native options", async () => {
    mockFinalCompletion(JSON.stringify(wireItinerary(1)))

    const result = await runFinal(1)
    const body = getFirstChatRequest()

    expect(result).toMatchObject({
      ok: true,
      data: {
        response: {
          travelPlan: { durationDays: 1 },
          itinerary: [{ dayNumber: 1 }],
        },
        usage: {
          inputTokens: 1_200,
          outputTokens: 600,
          totalTokens: 1_800,
        },
        rateLimit: {
          limitTokensPerMinute: 8_000,
          remainingTokens: 6_200,
          resetTokensSeconds: 8,
        },
        diagnostic: {
          normalizedFailureCode: "success",
          stage: "SUCCESS",
          strictSchemaReachedProvider: true,
          responseFormatAccepted: true,
          providerContentReturned: true,
          finishReason: "stop",
          jsonParsed: true,
          wireNormalized: true,
          runtimeValidated: true,
          durationValidated: true,
        },
      },
    })
    expect(body).toEqual({
      model: "unit-test-model",
      messages: finalMessages,
      temperature: 0.4,
      max_completion_tokens: 1_700,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "groq_final_itinerary_wire_response",
          strict: true,
          schema: groqFinalItineraryWireSchema,
        },
      },
    })
    expect(body).not.toHaveProperty("provider")
    expect(body).not.toHaveProperty("reasoning")
    expect(body).not.toHaveProperty("reasoning_effort")
    expect(body).not.toHaveProperty("include_reasoning")
    expect(body).not.toHaveProperty("tools")
    expect(body).not.toHaveProperty("stream")
    expect(body).not.toHaveProperty("search_settings")
    expect(openAiMocks.clientOptions[0]).toEqual({
      apiKey: "unit-test-secret",
      baseURL: "https://api.groq.com/openai/v1",
      timeout: 90_000,
      maxRetries: 0,
    })
  })

  test("returns invalid_json without repairing malformed output", async () => {
    mockFinalCompletion("```json\n{}\n```")

    await expect(runFinal(1)).resolves.toMatchObject({
      ok: false,
      code: "invalid_json",
      diagnostic: {
        normalizedFailureCode: "invalid_json",
        stage: "CONTENT_EXTRACTION",
        providerContentReturned: true,
        jsonParsed: false,
      },
    })
  })

  test("returns empty_response for blank content", async () => {
    mockFinalCompletion("   ")

    await expect(runFinal(1)).resolves.toMatchObject({
      ok: false,
      code: "empty_response",
      diagnostic: {
        normalizedFailureCode: "empty_response",
        stage: "PROVIDER_RESPONSE",
        providerContentReturned: false,
      },
    })
  })

  test("returns schema_validation for invalid required application data", async () => {
    const invalidWireValue: Record<string, unknown> = { ...wireItinerary(1) }
    delete invalidWireValue.summary
    mockFinalCompletion(JSON.stringify(invalidWireValue))

    await expect(runFinal(1)).resolves.toMatchObject({
      ok: false,
      code: "schema_validation",
      diagnostic: {
        normalizedFailureCode: "schema_validation",
        stage: "WIRE_NORMALIZATION",
        runtimeValidated: false,
      },
    })
  })

  test("returns schema_validation for invalid place semantics", async () => {
    const wireValue = wireItinerary(1)
    const place = wireValue.itinerary[0]?.activities[0]?.place

    if (place !== undefined) {
      place.kind = "specific_place"
      place.name = null
    }
    mockFinalCompletion(JSON.stringify(wireValue))

    await expect(runFinal(1)).resolves.toMatchObject({
      ok: false,
      code: "schema_validation",
    })
  })

  test("returns schema_validation when exact duration validation fails", async () => {
    mockFinalCompletion(JSON.stringify(wireItinerary(1)))

    await expect(runFinal(3)).resolves.toMatchObject({
      ok: false,
      code: "schema_validation",
      diagnostic: {
        normalizedFailureCode: "duration_validation",
        stage: "RUNTIME_VALIDATION",
        runtimeValidated: true,
        durationValidated: false,
      },
    })
  })

  test("returns output_truncated for a length finish reason", async () => {
    mockFinalCompletion(JSON.stringify(wireItinerary(1)), "length")

    await expect(runFinal(1)).resolves.toMatchObject({
      ok: false,
      code: "output_truncated",
      diagnostic: {
        normalizedFailureCode: "output_truncated",
        stage: "PROVIDER_RESPONSE",
        finishReason: "length",
      },
    })
  })

  test("normalizes HTTP 429 without retrying", async () => {
    const headers = new Headers({ "retry-after": "30" })
    mockFinalFailure(new RateLimitError(429, undefined, "rate limited", headers))

    await expect(runFinal(1)).resolves.toMatchObject({
      ok: false,
      code: "rate_limited",
      error: "Groq rate limit was reached.",
      retryAfterSeconds: 30,
      diagnostic: {
        normalizedFailureCode: "rate_limited",
        stage: "PROVIDER_REQUEST",
        httpStatus: 429,
        providerErrorCategory: "rate_limited",
        strictSchemaReachedProvider: true,
        retryAfterSeconds: 30,
      },
    })
    expect(openAiMocks.chatCreate).toHaveBeenCalledOnce()
  })

  test("normalizes the SDK timeout class", async () => {
    mockFinalFailure(new APIConnectionTimeoutError())

    await expect(runFinal(1)).resolves.toMatchObject({
      ok: false,
      code: "provider_timeout",
      error: "Groq provider request timed out.",
      diagnostic: {
        normalizedFailureCode: "provider_timeout",
        stage: "PROVIDER_REQUEST",
        strictSchemaReachedProvider: false,
      },
    })
  })

  test("sanitizes provider errors and never returns secret values", async () => {
    mockFinalFailure(new Error(`provider rejected ${process.env.GROQ_API_KEY}`))

    const result = await runFinal(1)

    expect(result).toMatchObject({
      ok: false,
      code: "provider_error",
      error: "Groq provider request failed.",
      diagnostic: {
        normalizedFailureCode: "provider_error",
        stage: "PROVIDER_REQUEST",
      },
    })
    expect(JSON.stringify(result)).not.toContain("unit-test-secret")
  })

  test.each([
    [400, "request_rejected"],
    [401, "authentication_error"],
    [403, "permission_error"],
    [404, "model_or_endpoint_not_found"],
    [413, "request_too_large"],
    [422, "structured_output_or_semantic_failure"],
    [429, "rate_limited"],
    [498, "capacity_exceeded"],
    [499, "request_cancelled"],
    [500, "provider_error"],
    [502, "provider_error"],
    [503, "provider_error"],
  ] as const)(
    "maps HTTP %i to the safe %s diagnostic",
    async (status, normalizedFailureCode) => {
      mockFinalFailure(providerFailure(status))

      await expect(runFinal(1)).resolves.toMatchObject({
        ok: false,
        diagnostic: {
          normalizedFailureCode,
          stage: "PROVIDER_REQUEST",
          httpStatus: status,
          providerErrorCategory: normalizedFailureCode,
          providerErrorType: "invalid_request_error",
          strictSchemaReachedProvider: true,
          providerContentReturned: false,
        },
      })
    }
  )

  test("distinguishes a safely recognizable unsupported parameter rejection", async () => {
    mockFinalFailure(
      providerFailure(400, "The parameter is not supported by this endpoint.")
    )

    await expect(runFinal(1)).resolves.toMatchObject({
      ok: false,
      diagnostic: {
        normalizedFailureCode: "unsupported_parameter",
        httpStatus: 400,
      },
    })
  })

  test("extracts only allowlisted structured provider error metadata", async () => {
    const observer = vi.fn<(metadata: GroqFinalProviderErrorMetadata) => void>()
    mockFinalFailure(
      detailedProviderFailure({
        message: `arbitrary ${process.env.GROQ_API_KEY}`,
        code: "json_validate_failed",
        param: "response_format",
        schemaPath: "$.properties.itinerary.items.properties.activities",
        failedGeneration:
          "max completion tokens reached before generating a valid document",
      })
    )

    const result = await runGroqFinalItinerary(
      {
        messages: finalMessages,
        durationDays: 1,
      },
      undefined,
      { observeProviderError: observer }
    )

    expect(result).toMatchObject({
      ok: false,
      code: "provider_error",
      error: "Groq provider request failed.",
      diagnostic: {
        normalizedFailureCode: "request_rejected",
        httpStatus: 400,
      },
    })
    expect(observer).toHaveBeenCalledOnce()
    expect(observer).toHaveBeenCalledWith({
      httpStatus: 400,
      providerErrorType: "invalid_request_error",
      providerErrorCode: "json_validate_failed",
      providerErrorParameter: "response_format",
      schemaPath: "$.properties.itinerary.items.properties.activities",
      category: "COMPLETION_EXHAUSTION_INDICATED",
      failedGenerationPresent: true,
      generationExhaustionIndicated: true,
      unsupportedSchemaStructureIndicated: false,
    })
    expect(JSON.stringify(observer.mock.calls)).not.toContain("unit-test-secret")
    expect(JSON.stringify(observer.mock.calls)).not.toContain(
      "max completion tokens reached"
    )
  })

  test("extracts an allowlisted schema path from a message and discards the message", async () => {
    const observer = vi.fn<(metadata: GroqFinalProviderErrorMetadata) => void>()
    mockFinalFailure(
      detailedProviderFailure({
        message:
          "Invalid response schema at path: $.properties.hotels.items.properties.address",
        code: "invalid_schema",
        param: "response_format.json_schema.schema",
      })
    )

    await runGroqFinalItinerary(
      { messages: finalMessages, durationDays: 1 },
      undefined,
      { observeProviderError: observer }
    )

    expect(observer).toHaveBeenCalledWith({
      httpStatus: 400,
      providerErrorType: "invalid_request_error",
      providerErrorCode: "invalid_schema",
      providerErrorParameter: "response_format.json_schema.schema",
      schemaPath: "$.properties.hotels.items.properties.address",
      category: "SCHEMA_REQUEST_REJECTED",
      failedGenerationPresent: false,
      generationExhaustionIndicated: false,
      unsupportedSchemaStructureIndicated: true,
    })
    expect(JSON.stringify(observer.mock.calls)).not.toContain(
      "Invalid response schema"
    )
  })

  test("discards unknown codes, paths, parameters, and arbitrary failed content", async () => {
    const observer = vi.fn<(metadata: GroqFinalProviderErrorMetadata) => void>()
    mockFinalFailure(
      detailedProviderFailure({
        message: `private ${process.env.GROQ_API_KEY}`,
        code: "private_code",
        param: "private_parameter",
        schemaPath: "$.properties.privateSecret",
        failedGeneration: "<think>private reasoning trace</think>",
      })
    )

    await runGroqFinalItinerary(
      { messages: finalMessages, durationDays: 1 },
      undefined,
      { observeProviderError: observer }
    )

    expect(observer).toHaveBeenCalledWith({
      httpStatus: 400,
      providerErrorType: "invalid_request_error",
      providerErrorCode: null,
      providerErrorParameter: null,
      schemaPath: null,
      category: "UNKNOWN",
      failedGenerationPresent: true,
      generationExhaustionIndicated: false,
      unsupportedSchemaStructureIndicated: false,
    })
    const serialized = JSON.stringify(observer.mock.calls)
    expect(serialized).not.toContain("unit-test-secret")
    expect(serialized).not.toContain("private reasoning")
    expect(serialized).not.toContain("private_code")
    expect(serialized).not.toContain("private_parameter")
  })

  test("represents missing provider fields as unavailable", async () => {
    const observer = vi.fn<(metadata: GroqFinalProviderErrorMetadata) => void>()
    mockFinalFailure(
      Object.assign(new Error("discard this message"), {
        status: 400,
        headers: new Headers(),
      })
    )

    await runGroqFinalItinerary(
      { messages: finalMessages, durationDays: 1 },
      undefined,
      { observeProviderError: observer }
    )

    expect(observer).toHaveBeenCalledWith({
      httpStatus: 400,
      providerErrorType: null,
      providerErrorCode: null,
      providerErrorParameter: null,
      schemaPath: null,
      category: "UNKNOWN",
      failedGenerationPresent: false,
      generationExhaustionIndicated: false,
      unsupportedSchemaStructureIndicated: false,
    })
  })

  test("ignores diagnostic observer failures and preserves normalized behavior", async () => {
    mockFinalFailure(providerFailure(400))

    const result = await runGroqFinalItinerary(
      { messages: finalMessages, durationDays: 1 },
      undefined,
      {
        observeProviderError: () => {
          throw new Error("local observer failed")
        },
      }
    )

    expect(result).toMatchObject({
      ok: false,
      code: "provider_error",
      error: "Groq provider request failed.",
      diagnostic: {
        normalizedFailureCode: "request_rejected",
        httpStatus: 400,
      },
    })
  })

  test("uses a duration-aware budget that never exceeds the application cap", () => {
    expect(getGroqFinalMaxCompletionTokens(1)).toBe(1_700)
    expect(getGroqFinalMaxCompletionTokens(3)).toBe(2_700)
    expect(getGroqFinalMaxCompletionTokens(7)).toBe(4_700)
    expect(getGroqFinalMaxCompletionTokens(14)).toBe(4_800)
    expect(getGroqFinalMaxCompletionTokens(30)).toBe(4_800)
    expect(getGroqFinalMaxCompletionTokens(100)).toBe(
      GROQ_FINAL_MAX_COMPLETION_TOKENS_CAP
    )
  })
})

function runFinal(durationDays: number) {
  return runGroqFinalItinerary({
    messages: finalMessages,
    durationDays,
  })
}

function mockFinalCompletion(content: string, finishReason = "stop") {
  openAiMocks.chatCreate.mockReturnValueOnce({
    withResponse: vi.fn().mockResolvedValue({
      data: {
        model: "unit-test-model",
        choices: [
          {
            finish_reason: finishReason,
            message: { content },
          },
        ],
        usage: {
          prompt_tokens: 1_200,
          completion_tokens: 600,
          total_tokens: 1_800,
        },
      },
      response: new Response(null, {
        headers: {
          "x-ratelimit-limit-tokens": "8000",
          "x-ratelimit-remaining-tokens": "6200",
          "x-ratelimit-reset-tokens": "7.66s",
        },
      }),
      request_id: null,
    }),
  })
}

function mockFinalFailure(error: unknown) {
  openAiMocks.chatCreate.mockReturnValueOnce({
    withResponse: vi.fn().mockRejectedValue(error),
  })
}

function providerFailure(status: number, message = "provider failure") {
  return Object.assign(new Error(message), {
    status,
    type: "invalid_request_error",
    headers: new Headers(),
  })
}

function detailedProviderFailure({
  message,
  code,
  param,
  schemaPath,
  failedGeneration,
}: {
  message: string
  code?: string
  param?: string
  schemaPath?: string
  failedGeneration?: string
}) {
  const providerError = {
    message,
    type: "invalid_request_error",
    ...(code !== undefined ? { code } : {}),
    ...(param !== undefined ? { param } : {}),
    ...(schemaPath !== undefined ? { schema_path: schemaPath } : {}),
    ...(failedGeneration !== undefined
      ? { failed_generation: failedGeneration }
      : {}),
  }

  return Object.assign(new Error(message), {
    status: 400,
    type: "invalid_request_error",
    code,
    param,
    error: providerError,
    headers: new Headers(),
  })
}

function getFirstChatRequest() {
  const request: unknown = openAiMocks.chatCreate.mock.calls[0]?.[0]

  if (typeof request !== "object" || request === null || Array.isArray(request)) {
    throw new Error("Expected a chat completion request object.")
  }

  return request as Record<string, unknown>
}

function auditStrictWireSchema(value: unknown) {
  const report = {
    objectNodes: 0,
    anyOfBranches: 0,
    problems: [] as string[],
    unsupportedKeywords: [] as string[],
  }
  const supportedKeywords = new Set([
    "additionalProperties",
    "anyOf",
    "enum",
    "items",
    "properties",
    "required",
    "type",
  ])

  function visit(node: unknown, path: string) {
    if (!isObject(node)) {
      return
    }

    for (const keyword of Object.keys(node)) {
      if (!supportedKeywords.has(keyword)) {
        report.unsupportedKeywords.push(`${path}.${keyword}`)
      }
    }

    if (node.type === "object") {
      report.objectNodes += 1

      if (!isObject(node.properties)) {
        report.problems.push(`${path}.properties missing`)
      } else {
        const propertyKeys = Object.keys(node.properties).sort()
        const requiredKeys = readStringArray(node.required)?.sort()

        if (requiredKeys === undefined) {
          report.problems.push(`${path}.required missing or invalid`)
        } else if (JSON.stringify(requiredKeys) !== JSON.stringify(propertyKeys)) {
          report.problems.push(`${path}.required does not match properties`)
        }

        for (const [key, property] of Object.entries(node.properties)) {
          visit(property, `${path}.${key}`)
        }
      }

      if (node.additionalProperties !== false) {
        report.problems.push(`${path}.additionalProperties is not false`)
      }
    }

    if ("items" in node) {
      visit(node.items, `${path}[]`)
    }

    if (Array.isArray(node.anyOf)) {
      report.anyOfBranches += node.anyOf.length
      node.anyOf.forEach((variant, index) =>
        visit(variant, `${path}.anyOf.${index}`)
      )
    }
  }

  visit(value, "root")
  report.unsupportedKeywords.sort()

  return report
}

function readStringArray(value: unknown) {
  return Array.isArray(value) &&
    value.every((item) => typeof item === "string")
    ? [...value]
    : undefined
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function wireItinerary(durationDays: number) {
  return {
    travelPlan: {
      source: "Dhaka",
      destination: "Sylhet",
      durationDays,
      budgetTier: "mid-range",
      groupSize: 2,
      groupType: null,
    },
    summary: "A concise generated itinerary.",
    hotels: [
      {
        name: "Central area stay",
        description: "A practical generated hotel option.",
        area: null,
        address: null,
        priceTier: null,
        estimatedPriceText: "Generated estimate: mid-range nightly pricing.",
      },
    ],
    itinerary: Array.from({ length: durationDays }, (_, index) => ({
      dayNumber: index + 1,
      title: `Day ${index + 1}`,
      activities: [
        {
          title: "Explore the destination",
          description: "Enjoy a concise destination activity.",
          timeOfDay: null,
          timeWindow: "Morning",
          duration: null,
          estimatedPriceText: "Generated estimate: local transport only.",
          place: {
            kind: "generic_activity",
            name: null,
            addressHint: null,
            areaHint: null,
            originHint: null,
            destinationHint: null,
          },
        },
      ],
    })),
    practicalNotes: null,
  }
}

const finalMessages = [
  {
    role: "system" as const,
    content: "Return a concise final itinerary matching the supplied schema.",
  },
  {
    role: "user" as const,
    content: "Generate a one-day itinerary from Dhaka to Sylhet.",
  },
]

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}
