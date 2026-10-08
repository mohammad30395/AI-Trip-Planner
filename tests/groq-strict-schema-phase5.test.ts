import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, test } from "vitest"

import {
  getPhase4RequestSnapshot,
  phase4ProbeFixtures,
} from "@/tests/helpers/groq-strict-schema-phase4"
import {
  appendPhase5DiagnosticRecord,
  auditPhase5ProbeFixtures,
  createPhase5DiagnosticRecord,
  diffPhase5Requests,
  expectedPhase5PlaceSchemaFingerprint,
  getNextPhase5Probe,
  getPhase5RequestSnapshot,
  getPhase5SchemaFingerprint,
  phase5ProbeFixtures,
  readPhase5DiagnosticRecords,
} from "@/tests/helpers/groq-strict-schema-phase5"

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("Groq strict-schema Phase 5 fixtures", () => {
  test("recovers the exact Phase-4 control and aligned place request", () => {
    expect(auditPhase5ProbeFixtures()).toEqual([])
    expect(phase5ProbeFixtures.A.schema).toBe(phase4ProbeFixtures.A.schema)
    expect(phase5ProbeFixtures.A.userMessage).toBeUndefined()
    expect(getPhase5RequestSnapshot(phase5ProbeFixtures.A)).toEqual(
      getPhase4RequestSnapshot(phase4ProbeFixtures.A)
    )

    expect(getPhase5RequestSnapshot(phase5ProbeFixtures.B)).toEqual(
      getPhase4RequestSnapshot(phase4ProbeFixtures.C)
    )
    expect(phase5ProbeFixtures.B.schema).toBe(phase4ProbeFixtures.C.schema)
    expect(phase5ProbeFixtures.B.userMessage).toBe(
      phase4ProbeFixtures.C.userMessage
    )
  })

  test("locks the aligned place schema fingerprint", () => {
    expect(getPhase5SchemaFingerprint(phase5ProbeFixtures.B)).toBe(
      expectedPhase5PlaceSchemaFingerprint
    )
    expect(getPhase5SchemaFingerprint(phase5ProbeFixtures.C)).toBe(
      expectedPhase5PlaceSchemaFingerprint
    )
  })

  test("changes only maxCompletionTokens between Probes B and C", () => {
    expect(diffPhase5Requests(phase5ProbeFixtures.B, phase5ProbeFixtures.C)).toEqual([
      "maxCompletionTokens",
    ])

    const request256 = getPhase5RequestSnapshot(phase5ProbeFixtures.B)
    const request512 = getPhase5RequestSnapshot(phase5ProbeFixtures.C)

    expect({ ...request512, maxCompletionTokens: 256 }).toEqual(request256)
    expect(request256.maxCompletionTokens).toBe(256)
    expect(request512.maxCompletionTokens).toBe(512)
    expect(request256).toMatchObject({
      api: "chat.completions.create",
      modelSource: "GROQ_MODEL",
      schemaName: "groq_strict_capability_smoke",
      strict: true,
      temperature: null,
      reasoningEffort: null,
      includeReasoning: null,
      stream: null,
      tools: null,
      timeoutMs: 30_000,
      retries: 0,
      clientInvocation:
        "runGroqStrictCapabilitySmoke -> runGroqStructuredOutput -> chat.completions.create",
    })
  })

  test("retains the existing exact minimal-place validator behavior", () => {
    const validResponse = {
      ok: true,
      message: "Confirmed",
      place: {
        kind: "specific_place",
        name: "Test Place",
        addressHint: null,
        areaHint: null,
        originHint: null,
        destinationHint: null,
      },
    }
    const validate = phase5ProbeFixtures.B.validateResponse

    expect(validate(validResponse)).toBe(true)
    expect(
      validate({
        ...validResponse,
        place: { ...validResponse.place, name: undefined },
      })
    ).toBe(false)
    expect(
      validate({
        ...validResponse,
        place: { ...validResponse.place, kind: "area" },
      })
    ).toBe(false)
    expect(validate({ ...validResponse, message: "Unexpected" })).toBe(false)
    expect(validate({ ...validResponse, extra: true })).toBe(false)
    expect(validate({
      ...validResponse,
      place: { ...validResponse.place, extra: true },
    })).toBe(false)
  })

  test("enforces the control, infrastructure, and three-probe stop decisions", () => {
    expect(getNextPhase5Probe("A", false, "UNKNOWN")).toBeNull()
    expect(getNextPhase5Probe("A", true, null)).toBe("B")
    expect(getNextPhase5Probe("B", true, null)).toBe("C")
    expect(getNextPhase5Probe("B", false, "JSON_VALIDATE_FAILED")).toBe("C")
    expect(getNextPhase5Probe("B", false, "NONCONFORMING_OUTPUT")).toBe("C")
    expect(getNextPhase5Probe("B", false, "OUTPUT_TRUNCATED")).toBe("C")
    expect(getNextPhase5Probe("B", false, "SCHEMA_REQUEST_REJECTED")).toBeNull()
    expect(getNextPhase5Probe("B", false, "PROVIDER_RATE_LIMITED")).toBeNull()
    expect(getNextPhase5Probe("B", false, "PROVIDER_UNAVAILABLE")).toBeNull()
    expect(getNextPhase5Probe("B", false, "CONFIGURATION_ERROR")).toBeNull()
    expect(getNextPhase5Probe("C", true, null)).toBeNull()
    expect(getNextPhase5Probe("C", false, "JSON_VALIDATE_FAILED")).toBeNull()
  })
})

describe("Groq strict-schema Phase 5 diagnostics", () => {
  test("persists one complete sanitized record per simulated request", () => {
    const reportPath = createTemporaryReportPath()
    const configuredSecret = "unit-test-secret-value"
    const headers = new Headers({
      authorization: `Bearer ${configuredSecret}`,
      "x-account-id": "private-account",
      "x-ratelimit-limit-tokens": "8000",
      "x-ratelimit-remaining-tokens": "7000",
      "x-ratelimit-reset-tokens": "2.4s",
    })
    const control = createPhase5DiagnosticRecord({
      fixture: phase5ProbeFixtures.A,
      resultOk: true,
      normalizedFailureCode: null,
      observation: {
        ok: true,
        finishReason: "stop",
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      },
      configuredSecret,
    })
    const aligned256 = createPhase5DiagnosticRecord({
      fixture: phase5ProbeFixtures.B,
      resultOk: false,
      normalizedFailureCode: "provider_error",
      observation: {
        ok: false,
        error: {
          status: 400,
          headers,
          error: {
            type: "invalid_request_error",
            code: "json_validate_failed",
            failed_generation:
              `max completion tokens reached before valid JSON ${configuredSecret}`,
            raw_body: "must-not-persist",
          },
        },
      },
      configuredSecret,
    })
    const aligned512 = createPhase5DiagnosticRecord({
      fixture: phase5ProbeFixtures.C,
      resultOk: true,
      normalizedFailureCode: null,
      observation: {
        ok: true,
        finishReason: "stop",
        usage: { inputTokens: 150, outputTokens: 30, totalTokens: 180 },
      },
      configuredSecret,
    })

    for (const record of [control, aligned256, aligned512]) {
      appendPhase5DiagnosticRecord(reportPath, record)
    }

    expect(readPhase5DiagnosticRecords(reportPath)).toEqual([
      control,
      aligned256,
      aligned512,
    ])
    expect(readFileSync(reportPath, "utf8").trim().split("\n")).toHaveLength(3)
    expect(control).toMatchObject({
      completionTokenBudget: 256,
      outcomeClassification: "CONTROL_PASSED",
      retryCount: 0,
    })
    expect(aligned256).toMatchObject({
      completionTokenBudget: 256,
      outcomeClassification: "ALIGNED_256_JSON_FAILED",
      providerErrorClassification: "JSON_VALIDATE_FAILED",
      providerErrorType: "invalid_request_error",
      errorCode: "json_validate_failed",
      discriminatorValidationPassed: null,
      requiredFieldsComplete: null,
      tokenLimit: 8000,
      remainingTokens: 7000,
      resetSeconds: 3,
      retryCount: 0,
    })
    expect(aligned256.failedGenerationSummary).toMatchObject({
      present: true,
      mentionsTokenLimit: true,
    })
    expect(aligned512).toMatchObject({
      completionTokenBudget: 512,
      outcomeClassification: "ALIGNED_512_ACCEPTED",
      parsedOutputValid: true,
      schemaValidationPassed: true,
      discriminatorValidationPassed: true,
      requiredFieldsComplete: true,
      retryCount: 0,
    })
    expect(aligned256.schemaFingerprint).toBe(aligned512.schemaFingerprint)

    const serialized = readFileSync(reportPath, "utf8")
    expect(serialized).not.toContain(configuredSecret)
    expect(serialized).not.toContain("authorization")
    expect(serialized).not.toContain("private-account")
    expect(serialized).not.toContain("must-not-persist")
    expect(serialized).not.toContain(phase4ProbeFixtures.C.userMessage)
  })
})

function createTemporaryReportPath() {
  const directory = mkdtempSync(join(tmpdir(), "groq-phase5-test-"))
  temporaryDirectories.push(directory)
  return join(directory, "report.jsonl")
}
