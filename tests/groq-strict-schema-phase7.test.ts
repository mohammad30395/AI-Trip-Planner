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

import { runGroqStrictCapabilitySmoke } from "@/lib/ai/groq"
import {
  expectedPhase6FullPlaceAnyOfFingerprint,
  getPhase6SchemaFingerprint,
  phase6ProbeFixtures,
} from "@/tests/helpers/groq-strict-schema-phase6"
import {
  appendPhase7DiagnosticRecord,
  auditPhase7ProbeFixtures,
  createPhase7DiagnosticRecord,
  diffPhase7Requests,
  expectedPhase7SchemaFingerprint,
  genericActivityUserMessage,
  getNextPhase7Probe,
  getPhase7MessageDifferences,
  getPhase7OutgoingRequestSnapshot,
  getPhase7RequestSnapshot,
  phase7ProbeFixtures,
  readPhase7DiagnosticRecords,
  transportUserMessage,
  validateGenericActivityResponse,
  validateTransportResponse,
} from "@/tests/helpers/groq-strict-schema-phase7"

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

describe("Groq strict-schema Phase 7 fixtures", () => {
  test("reuses the exact accepted complete union for both probes", () => {
    expect(auditPhase7ProbeFixtures()).toEqual([])
    expect(phase7ProbeFixtures.A.schema).toBe(phase6ProbeFixtures.B.schema)
    expect(phase7ProbeFixtures.B.schema).toBe(phase6ProbeFixtures.B.schema)
    expect(expectedPhase7SchemaFingerprint).toBe(
      expectedPhase6FullPlaceAnyOfFingerprint
    )
    expect(
      getPhase6SchemaFingerprint({
        ...phase6ProbeFixtures.B,
        schema: phase7ProbeFixtures.A.schema,
      })
    ).toBe(expectedPhase7SchemaFingerprint)
  })

  test("preserves the exact authorized prompts", () => {
    expect(phase7ProbeFixtures.A.userMessage).toBe(
      "Return a valid confirmation with ok set to true, message set to 'Confirmed', and a place object representing a fictional generic activity. Set kind to 'generic_activity', name to null, and addressHint, areaHint, originHint, and destinationHint to null. Include every schema-required field and no extra fields."
    )
    expect(phase7ProbeFixtures.B.userMessage).toBe(
      "Return a valid confirmation with ok set to true, message set to 'Confirmed', and a place object representing fictional transportation. Set kind to 'transport', name to null, originHint to 'Test Origin', destinationHint to 'Test Destination', and addressHint and areaHint to null. Include every schema-required field and no extra fields."
    )
  })

  test("accepts representative generic_activity and transport responses", () => {
    expect(validateGenericActivityResponse(genericActivityResponse)).toBe(true)
    expect(validateTransportResponse(transportResponse)).toBe(true)
  })

  test("rejects wrong branches, missing fields, invalid names, and extras", () => {
    expect(validateGenericActivityResponse(transportResponse)).toBe(false)
    expect(validateTransportResponse(genericActivityResponse)).toBe(false)
    expect(
      validateGenericActivityResponse({
        ...genericActivityResponse,
        place: { ...genericActivityResponse.place, kind: "unknown" },
      })
    ).toBe(false)
    expect(
      validateGenericActivityResponse({
        ...genericActivityResponse,
        place: { ...genericActivityResponse.place, name: "Not allowed" },
      })
    ).toBe(false)
    expect(
      validateTransportResponse({
        ...transportResponse,
        place: { ...transportResponse.place, originHint: null },
      })
    ).toBe(false)
    expect(
      validateTransportResponse({
        ...transportResponse,
        place: { ...transportResponse.place, areaHint: undefined },
      })
    ).toBe(false)
    expect(
      validateTransportResponse({
        ...transportResponse,
        place: { ...transportResponse.place, extra: true },
      })
    ).toBe(false)
  })

  test("changes only the designated user-message content", () => {
    expect(diffPhase7Requests()).toEqual(["messages"])
    expect(getPhase7MessageDifferences()).toEqual(["messages[1].content"])

    const generic = getPhase7RequestSnapshot(phase7ProbeFixtures.A)
    const transport = getPhase7RequestSnapshot(phase7ProbeFixtures.B)
    expect({ ...transport, messages: generic.messages }).toEqual(generic)
    expect(generic.schema).toBe(transport.schema)
    expect(generic.maxCompletionTokens).toBe(512)
    expect(transport.maxCompletionTokens).toBe(512)
    expect(getPhase7OutgoingRequestSnapshot(phase7ProbeFixtures.A)).toMatchObject({
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
  })

  test("continues after generation failures but stops on blocking failures", () => {
    expect(getNextPhase7Probe("A", true, null)).toBe("B")
    expect(getNextPhase7Probe("A", false, "JSON_VALIDATE_FAILED")).toBe("B")
    expect(getNextPhase7Probe("A", false, "NONCONFORMING_OUTPUT")).toBe("B")
    expect(getNextPhase7Probe("A", false, "OUTPUT_TRUNCATED")).toBe("B")
    expect(getNextPhase7Probe("A", false, "SCHEMA_REQUEST_REJECTED")).toBeNull()
    expect(getNextPhase7Probe("A", false, "PROVIDER_RATE_LIMITED")).toBeNull()
    expect(getNextPhase7Probe("A", false, "PROVIDER_UNAVAILABLE")).toBeNull()
    expect(getNextPhase7Probe("A", false, "CONFIGURATION_ERROR")).toBeNull()
    expect(getNextPhase7Probe("B", true, null)).toBeNull()
    expect(getNextPhase7Probe("B", false, "JSON_VALIDATE_FAILED")).toBeNull()
  })
})

describe("Groq strict-schema Phase 7 outgoing SDK requests", () => {
  test("changes only messages[1].content across complete request bodies", async () => {
    openAiMocks.chatCreate
      .mockResolvedValueOnce(completion(genericActivityResponse))
      .mockResolvedValueOnce(completion(transportResponse))

    await runGroqStrictCapabilitySmoke(undefined, {
      schema: phase7ProbeFixtures.A.schema,
      userMessage: phase7ProbeFixtures.A.userMessage,
      maxCompletionTokens: 512,
      validateResponse: phase7ProbeFixtures.A.validateResponse,
    })
    await runGroqStrictCapabilitySmoke(undefined, {
      schema: phase7ProbeFixtures.B.schema,
      userMessage: phase7ProbeFixtures.B.userMessage,
      maxCompletionTokens: 512,
      validateResponse: phase7ProbeFixtures.B.validateResponse,
    })

    const generic = getChatRequest(0)
    const transport = getChatRequest(1)
    const expectedTransport = structuredClone(generic)
    const messages = expectedTransport.messages

    if (!Array.isArray(messages)) {
      throw new Error("Expected messages in the outgoing request.")
    }
    messages[1] = { role: "user", content: transportUserMessage }

    expect(transport).toEqual(expectedTransport)
    expect(generic).not.toHaveProperty("temperature")
    expect(generic).not.toHaveProperty("reasoning_effort")
    expect(generic).not.toHaveProperty("include_reasoning")
    expect(generic).not.toHaveProperty("stream")
    expect(generic).not.toHaveProperty("tools")
    expect(openAiMocks.clientOptions).toHaveLength(2)
    expect(openAiMocks.clientOptions[0]).toEqual(openAiMocks.clientOptions[1])
    expect(openAiMocks.clientOptions[0]).toMatchObject({
      timeout: 30_000,
      maxRetries: 0,
    })
  })
})

describe("Groq strict-schema Phase 7 diagnostics", () => {
  test("persists one sanitized record per simulated provider call", () => {
    const reportPath = createTemporaryReportPath()
    const configuredSecret = "unit-test-secret-value"
    const headers = new Headers({
      authorization: `Bearer ${configuredSecret}`,
      "x-account-id": "private-account",
      "x-ratelimit-limit-tokens": "8000",
      "x-ratelimit-remaining-tokens": "7000",
      "x-ratelimit-reset-tokens": "2.4s",
    })
    const generic = createPhase7DiagnosticRecord({
      fixture: phase7ProbeFixtures.A,
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
    const transport = createPhase7DiagnosticRecord({
      fixture: phase7ProbeFixtures.B,
      observation: {
        ok: true,
        finishReason: "stop",
        usage: { inputTokens: 500, outputTokens: 200, totalTokens: 700 },
      },
      normalizedFailureCode: null,
      resultOk: true,
      generatedPlaceVariant: "transport",
      configuredSecret,
    })

    appendPhase7DiagnosticRecord(reportPath, generic)
    appendPhase7DiagnosticRecord(reportPath, transport)

    expect(readPhase7DiagnosticRecords(reportPath)).toEqual([generic, transport])
    expect(readFileSync(reportPath, "utf8").trim().split("\n")).toHaveLength(2)
    expect(generic).toMatchObject({
      outcomeClassification: "GENERIC_ACTIVITY_JSON_FAILED",
      providerErrorClassification: "JSON_VALIDATE_FAILED",
      tokenLimit: 8000,
      remainingTokens: 7000,
      resetSeconds: 3,
      retryCount: 0,
    })
    expect(transport).toMatchObject({
      outcomeClassification: "TRANSPORT_ACCEPTED",
      requestedPlaceVariant: "transport",
      generatedPlaceVariant: "transport",
      parsedOutputValid: true,
      schemaValidationPassed: true,
      retryCount: 0,
    })

    const serialized = readFileSync(reportPath, "utf8")
    expect(serialized).not.toContain(configuredSecret)
    expect(serialized).not.toContain("authorization")
    expect(serialized).not.toContain("private-account")
    expect(serialized).not.toContain("must-not-persist")
    expect(serialized).not.toContain(genericActivityUserMessage)
    expect(serialized).not.toContain(transportUserMessage)
  })
})

const genericActivityResponse = {
  ok: true,
  message: "Confirmed",
  place: {
    kind: "generic_activity",
    name: null,
    addressHint: null,
    areaHint: null,
    originHint: null,
    destinationHint: null,
  },
} as const

const transportResponse = {
  ok: true,
  message: "Confirmed",
  place: {
    kind: "transport",
    name: null,
    addressHint: null,
    areaHint: null,
    originHint: "Test Origin",
    destinationHint: "Test Destination",
  },
} as const

function completion(response: unknown) {
  return {
    choices: [
      {
        finish_reason: "stop",
        message: { content: JSON.stringify(response) },
      },
    ],
    model: "openai/gpt-oss-20b",
    usage: { prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 },
  }
}

function getChatRequest(index: number) {
  const request = openAiMocks.chatCreate.mock.calls[index]?.[0]

  if (typeof request !== "object" || request === null || Array.isArray(request)) {
    throw new Error(`Missing mocked chat request ${index}.`)
  }

  return request as Record<string, unknown>
}

function createTemporaryReportPath() {
  const directory = mkdtempSync(join(tmpdir(), "groq-phase7-test-"))
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
