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
} from "@/lib/ai/groq"

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
    expectStrictObjects(groqFinalItineraryWireSchema, "root")
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
        },
      },
    })
    expect(body).toMatchObject({
      model: "unit-test-model",
      messages: finalMessages,
      temperature: 0.4,
      reasoning_effort: "low",
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
    expect(body).not.toHaveProperty("tools")
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
    })
  })

  test("returns empty_response for blank content", async () => {
    mockFinalCompletion("   ")

    await expect(runFinal(1)).resolves.toMatchObject({
      ok: false,
      code: "empty_response",
    })
  })

  test("returns schema_validation for invalid required application data", async () => {
    const invalidWireValue: Record<string, unknown> = { ...wireItinerary(1) }
    delete invalidWireValue.summary
    mockFinalCompletion(JSON.stringify(invalidWireValue))

    await expect(runFinal(1)).resolves.toMatchObject({
      ok: false,
      code: "schema_validation",
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
    })
  })

  test("returns output_truncated for a length finish reason", async () => {
    mockFinalCompletion(JSON.stringify(wireItinerary(1)), "length")

    await expect(runFinal(1)).resolves.toMatchObject({
      ok: false,
      code: "output_truncated",
    })
  })

  test("normalizes HTTP 429 without retrying", async () => {
    const headers = new Headers({ "retry-after": "30" })
    mockFinalFailure(new RateLimitError(429, undefined, "rate limited", headers))

    await expect(runFinal(1)).resolves.toEqual({
      ok: false,
      code: "rate_limited",
      error: "Groq rate limit was reached.",
      retryAfterSeconds: 30,
    })
    expect(openAiMocks.chatCreate).toHaveBeenCalledOnce()
  })

  test("normalizes the SDK timeout class", async () => {
    mockFinalFailure(new APIConnectionTimeoutError())

    await expect(runFinal(1)).resolves.toEqual({
      ok: false,
      code: "provider_timeout",
      error: "Groq provider request timed out.",
    })
  })

  test("sanitizes provider errors and never returns secret values", async () => {
    mockFinalFailure(new Error(`provider rejected ${process.env.GROQ_API_KEY}`))

    const result = await runFinal(1)

    expect(result).toEqual({
      ok: false,
      code: "provider_error",
      error: "Groq provider request failed.",
    })
    expect(JSON.stringify(result)).not.toContain("unit-test-secret")
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
        },
      }),
      request_id: null,
    }),
  })
}

function mockFinalFailure(error: Error) {
  openAiMocks.chatCreate.mockReturnValueOnce({
    withResponse: vi.fn().mockRejectedValue(error),
  })
}

function getFirstChatRequest() {
  const request: unknown = openAiMocks.chatCreate.mock.calls[0]?.[0]

  if (typeof request !== "object" || request === null || Array.isArray(request)) {
    throw new Error("Expected a chat completion request object.")
  }

  return request as Record<string, unknown>
}

function expectStrictObjects(value: unknown, path: string) {
  if (!isObject(value)) {
    return
  }

  if (value.type === "object") {
    expect(value.additionalProperties, `${path}.additionalProperties`).toBe(false)
    expect(value.properties, `${path}.properties`).toSatisfy(isObject)

    if (isObject(value.properties)) {
      expect(
        [...asStringArray(value.required)].sort(),
        `${path}.required`
      ).toEqual(Object.keys(value.properties).sort())

      for (const [key, property] of Object.entries(value.properties)) {
        expectStrictObjects(property, `${path}.${key}`)
      }
    }
  }

  if ("items" in value) {
    expectStrictObjects(value.items, `${path}[]`)
  }

  if (Array.isArray(value.anyOf)) {
    value.anyOf.forEach((variant, index) =>
      expectStrictObjects(variant, `${path}.anyOf.${index}`)
    )
  }
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error("Expected a string array.")
  }

  return value
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
