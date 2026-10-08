import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const openAiMocks = vi.hoisted(() => ({
  chatCreate: vi.fn(),
  clientOptions: [] as unknown[],
}))

vi.mock("openai", () => {
  class MockAPIConnectionTimeoutError extends Error {}
  class MockAPIUserAbortError extends Error {}
  class MockRateLimitError extends Error {}
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

import { groqFinalItineraryWireSchema } from "@/lib/ai/groq-final-schema"
import { runGroqStrictCapabilitySmoke } from "@/lib/ai/groq"
import {
  getPhase5RequestSnapshot,
  phase5ProbeFixtures,
} from "@/tests/helpers/groq-strict-schema-phase5"
import {
  appendPhase6DiagnosticRecord,
  auditPhase6ProbeFixtures,
  completePlaceAnyOfSchema,
  createPhase6DiagnosticRecord,
  diffPhase6Requests,
  expectedPhase6FullPlaceAnyOfFingerprint,
  expectedPhase6SingleBranchFingerprint,
  getGeneratedPlaceVariant,
  getNextPhase6Probe,
  getPhase6OutgoingRequestSnapshot,
  getPhase6RequestSnapshot,
  getPhase6SchemaFingerprint,
  phase6ProbeFixtures,
  readPhase6DiagnosticRecords,
  validateCompletePlace,
  validateFullPlaceAnyOfResponse,
} from "@/tests/helpers/groq-strict-schema-phase6"

const originalGroqApiKey = process.env.GROQ_API_KEY
const originalGroqModel = process.env.GROQ_MODEL
const temporaryDirectories: string[] = []

beforeEach(() => {
  process.env.GROQ_API_KEY = "unit-test-secret"
  process.env.GROQ_MODEL = "openai/gpt-oss-20b"
  openAiMocks.chatCreate.mockReset()
  openAiMocks.clientOptions.length = 0
})

afterEach(() => {
  restoreEnvironmentVariable("GROQ_API_KEY", originalGroqApiKey)
  restoreEnvironmentVariable("GROQ_MODEL", originalGroqModel)

  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("Groq strict-schema Phase 6 fixtures", () => {
  test("recovers the accepted Phase-5 candidate exactly", () => {
    expect(auditPhase6ProbeFixtures()).toEqual([])
    expect(phase6ProbeFixtures.A.schema).toBe(phase5ProbeFixtures.C.schema)
    expect(phase6ProbeFixtures.A.userMessage).toBe(
      phase5ProbeFixtures.C.userMessage
    )
    expect(phase6ProbeFixtures.A.completionTokenBudget).toBe(512)
    expect(getPhase6SchemaFingerprint(phase6ProbeFixtures.A)).toBe(
      expectedPhase6SingleBranchFingerprint
    )
    expect(getPhase6RequestSnapshot(phase6ProbeFixtures.A)).toEqual(
      getPhase5RequestSnapshot(phase5ProbeFixtures.C)
    )
  })

  test("derives the exact complete place anyOf from the production wire schema", () => {
    const productionPlace =
      groqFinalItineraryWireSchema.properties.itinerary.items.properties
        .activities.items.properties.place
    const candidateProperties = asRecord(phase6ProbeFixtures.B.schema.properties)

    expect(completePlaceAnyOfSchema).toBe(productionPlace)
    expect(candidateProperties?.place).toBe(productionPlace)
    expect(getPhase6SchemaFingerprint(phase6ProbeFixtures.B)).toBe(
      expectedPhase6FullPlaceAnyOfFingerprint
    )
    expect(productionPlace.anyOf).toHaveLength(3)
    expect(
      productionPlace.anyOf.map((branch) => branch.properties.kind.enum[0])
    ).toEqual(["specific_place", "generic_activity", "transport"])

    for (const [index, branch] of productionPlace.anyOf.entries()) {
      expect(branch.type).toBe("object")
      expect(branch.additionalProperties).toBe(false)
      expect(branch.required).toEqual([
        "kind",
        "name",
        "addressHint",
        "areaHint",
        "originHint",
        "destinationHint",
      ])
      expect(branch.properties.name.type).toBe(index === 0 ? "string" : "null")
      expect(branch.properties.addressHint.type).toEqual(["string", "null"])
      expect(branch.properties.areaHint.type).toEqual(["string", "null"])
      expect(branch.properties.originHint.type).toEqual(["string", "null"])
      expect(branch.properties.destinationHint.type).toEqual(["string", "null"])
    }
  })

  test("accepts representative values for every exact union branch", () => {
    const specificPlace = createResponse({
      kind: "specific_place",
      name: "Test Place",
      addressHint: null,
      areaHint: "Test Area",
      originHint: null,
      destinationHint: null,
    })
    const genericActivity = createResponse({
      kind: "generic_activity",
      name: null,
      addressHint: null,
      areaHint: null,
      originHint: null,
      destinationHint: null,
    })
    const transport = createResponse({
      kind: "transport",
      name: null,
      addressHint: null,
      areaHint: null,
      originHint: "Test Station",
      destinationHint: "Test Hotel",
    })

    for (const response of [specificPlace, genericActivity, transport]) {
      expect(validateFullPlaceAnyOfResponse(response)).toBe(true)
      expect(validateCompletePlace(response.place)).toBe(true)
      expect(getGeneratedPlaceVariant(response)).toBe(response.place.kind)
    }
  })

  test("rejects invalid discriminators, names, required fields, and extras", () => {
    const validPlace = {
      kind: "specific_place",
      name: "Test Place",
      addressHint: null,
      areaHint: null,
      originHint: null,
      destinationHint: null,
    }

    expect(validateCompletePlace({ ...validPlace, kind: "unknown" })).toBe(false)
    expect(validateCompletePlace({ ...validPlace, name: null })).toBe(false)
    expect(validateCompletePlace({ ...validPlace, addressHint: undefined })).toBe(false)
    expect(validateCompletePlace({ ...validPlace, unexpected: true })).toBe(false)
    expect(
      validateCompletePlace({
        ...validPlace,
        kind: "generic_activity",
        name: "Not allowed",
      })
    ).toBe(false)
    expect(
      validateFullPlaceAnyOfResponse({
        ...createResponse(validPlace),
        unexpected: true,
      })
    ).toBe(false)
  })

  test("isolates the semantic request change to the root place schema", () => {
    expect(diffPhase6Requests()).toEqual(["schema"])

    const control = getPhase6OutgoingRequestSnapshot(phase6ProbeFixtures.A)
    const candidate = getPhase6OutgoingRequestSnapshot(phase6ProbeFixtures.B)
    const normalizedCandidate = replaceOutgoingPlaceSchema(
      candidate,
      readOutgoingPlaceSchema(control)
    )

    expect(normalizedCandidate).toEqual(control)
    expect(control).toMatchObject({
      model: "openai/gpt-oss-20b",
      max_completion_tokens: 512,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "groq_strict_capability_smoke",
          strict: true,
        },
      },
    })
    expect(getPhase6SchemaFingerprint(phase6ProbeFixtures.A)).not.toBe(
      getPhase6SchemaFingerprint(phase6ProbeFixtures.B)
    )
  })

  test("stops after a failed control and never exceeds two probes", () => {
    expect(getNextPhase6Probe("A", false)).toBeNull()
    expect(getNextPhase6Probe("A", true)).toBe("B")
    expect(getNextPhase6Probe("B", true)).toBeNull()
    expect(getNextPhase6Probe("B", false)).toBeNull()
  })
})

describe("Groq strict-schema Phase 6 outgoing SDK requests", () => {
  test("changes only response_format.json_schema.schema.properties.place", async () => {
    const response = createResponse({
      kind: "specific_place",
      name: "Test Place",
      addressHint: null,
      areaHint: null,
      originHint: null,
      destinationHint: null,
    })
    openAiMocks.chatCreate.mockResolvedValue(completion(response))

    await runGroqStrictCapabilitySmoke(undefined, {
      schema: phase6ProbeFixtures.A.schema,
      userMessage: phase6ProbeFixtures.A.userMessage,
      maxCompletionTokens: 512,
      validateResponse: phase6ProbeFixtures.A.validateResponse,
    })
    await runGroqStrictCapabilitySmoke(undefined, {
      schema: phase6ProbeFixtures.B.schema,
      userMessage: phase6ProbeFixtures.B.userMessage,
      maxCompletionTokens: 512,
      validateResponse: phase6ProbeFixtures.B.validateResponse,
    })

    const control = getChatRequest(0)
    const candidate = getChatRequest(1)
    const expectedCandidate = replaceOutgoingPlaceSchema(
      control,
      readOutgoingPlaceSchema(candidate)
    )

    expect(candidate).toEqual(expectedCandidate)
    expect(control).not.toHaveProperty("temperature")
    expect(control).not.toHaveProperty("reasoning_effort")
    expect(control).not.toHaveProperty("include_reasoning")
    expect(control).not.toHaveProperty("stream")
    expect(control).not.toHaveProperty("tools")
    expect(openAiMocks.clientOptions).toHaveLength(2)
    expect(openAiMocks.clientOptions[0]).toEqual(openAiMocks.clientOptions[1])
    expect(openAiMocks.clientOptions[0]).toMatchObject({
      timeout: 30_000,
      maxRetries: 0,
    })
  })
})

describe("Groq strict-schema Phase 6 diagnostics", () => {
  test("persists exactly one complete sanitized record per simulated call", () => {
    const reportPath = createTemporaryReportPath()
    const configuredSecret = "unit-test-secret-value"
    const headers = new Headers({
      authorization: `Bearer ${configuredSecret}`,
      "x-account-id": "private-account",
      "x-ratelimit-limit-tokens": "8000",
      "x-ratelimit-remaining-tokens": "7100",
      "x-ratelimit-reset-tokens": "3.2s",
    })
    const control = createPhase6DiagnosticRecord({
      fixture: phase6ProbeFixtures.A,
      observation: {
        ok: true,
        finishReason: "stop",
        usage: { inputTokens: 300, outputTokens: 200, totalTokens: 500 },
      },
      normalizedFailureCode: null,
      resultOk: true,
      generatedPlaceVariant: "specific_place",
      configuredSecret,
    })
    const candidate = createPhase6DiagnosticRecord({
      fixture: phase6ProbeFixtures.B,
      observation: {
        ok: false,
        error: {
          status: 400,
          headers,
          error: {
            type: "invalid_request_error",
            code: "json_validate_failed",
            failed_generation: `invalid ${configuredSecret}`,
            raw_body: "must-not-persist",
          },
        },
      },
      normalizedFailureCode: "provider_error",
      resultOk: false,
      generatedPlaceVariant: null,
      configuredSecret,
    })

    appendPhase6DiagnosticRecord(reportPath, control)
    appendPhase6DiagnosticRecord(reportPath, candidate)

    expect(readPhase6DiagnosticRecords(reportPath)).toEqual([control, candidate])
    expect(readFileSync(reportPath, "utf8").trim().split("\n")).toHaveLength(2)
    expect(control).toMatchObject({
      outcomeClassification: "CONTROL_PASSED",
      generatedPlaceVariant: "specific_place",
      retryCount: 0,
    })
    expect(candidate).toMatchObject({
      outcomeClassification: "FULL_PLACE_ANYOF_JSON_FAILED",
      providerErrorClassification: "JSON_VALIDATE_FAILED",
      generatedPlaceVariant: null,
      tokenLimit: 8000,
      remainingTokens: 7100,
      resetSeconds: 4,
      retryCount: 0,
    })

    const serialized = readFileSync(reportPath, "utf8")
    expect(serialized).not.toContain(configuredSecret)
    expect(serialized).not.toContain("authorization")
    expect(serialized).not.toContain("private-account")
    expect(serialized).not.toContain("must-not-persist")
    expect(serialized).not.toContain(phase6ProbeFixtures.A.userMessage)
  })
})

function createResponse(place: Record<string, unknown>) {
  return {
    ok: true,
    message: "Confirmed",
    place,
  }
}

function completion(response: unknown) {
  return {
    choices: [
      {
        finish_reason: "stop",
        message: { content: JSON.stringify(response) },
      },
    ],
    model: "openai/gpt-oss-20b",
    usage: { prompt_tokens: 300, completion_tokens: 200, total_tokens: 500 },
  }
}

function getChatRequest(index: number) {
  const request = openAiMocks.chatCreate.mock.calls[index]?.[0]
  const record = asRecord(request)

  if (record === undefined) {
    throw new Error(`Missing mocked chat request ${index}.`)
  }

  return record
}

function readOutgoingPlaceSchema(request: unknown) {
  const root = asRecord(request)
  const responseFormat = asRecord(root?.response_format)
  const jsonSchema = asRecord(responseFormat?.json_schema)
  const schema = asRecord(jsonSchema?.schema)
  const properties = asRecord(schema?.properties)

  if (properties === undefined || !("place" in properties)) {
    throw new Error("Outgoing place schema is unavailable.")
  }

  return properties.place
}

function replaceOutgoingPlaceSchema(request: unknown, place: unknown) {
  const clone = structuredClone(request)
  const root = asRecord(clone)
  const responseFormat = asRecord(root?.response_format)
  const jsonSchema = asRecord(responseFormat?.json_schema)
  const schema = asRecord(jsonSchema?.schema)
  const properties = asRecord(schema?.properties)

  if (properties === undefined) {
    throw new Error("Outgoing schema properties are unavailable.")
  }

  properties.place = place
  return clone
}

function createTemporaryReportPath() {
  const directory = mkdtempSync(join(tmpdir(), "groq-phase6-test-"))
  temporaryDirectories.push(directory)
  return join(directory, "report.jsonl")
}

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
