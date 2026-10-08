import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, test } from "vitest"

import { phase3ProbeFixtures } from "@/tests/helpers/groq-strict-schema-phase3"
import {
  alignedPlaceUserMessage,
  appendPhase4DiagnosticRecord,
  auditPhase4ProbeFixtures,
  createPhase4DiagnosticRecord,
  diffPhase4Requests,
  getNextPhase4Probe,
  getPhase4MessageDifferences,
  getPhase4RequestSnapshot,
  getPhase4SchemaFingerprint,
  historicalSystemMessage,
  historicalUserMessage,
  phase4ProbeFixtures,
  readPhase4DiagnosticRecords,
} from "@/tests/helpers/groq-strict-schema-phase4"

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("Groq strict-schema Phase 4 fixtures", () => {
  test("recovers the committed Phase-3 control and place schemas", () => {
    expect(auditPhase4ProbeFixtures()).toEqual([])
    expect(phase4ProbeFixtures.A.schema).toBe(phase3ProbeFixtures.A.schema)
    expect(phase4ProbeFixtures.B.schema).toBe(phase3ProbeFixtures.B.schema)
    expect(phase4ProbeFixtures.C.schema).toBe(phase3ProbeFixtures.B.schema)
    expect(JSON.stringify(phase4ProbeFixtures.B.schema)).toBe(
      JSON.stringify(phase4ProbeFixtures.C.schema)
    )
  })

  test("keeps Probe A versus B isolated to the response schema", () => {
    expect(diffPhase4Requests(phase4ProbeFixtures.A, phase4ProbeFixtures.B)).toEqual([
      "schema",
    ])
  })

  test("changes only the designated user content between Probes B and C", () => {
    expect(diffPhase4Requests(phase4ProbeFixtures.B, phase4ProbeFixtures.C)).toEqual([
      "messages",
    ])
    expect(getPhase4MessageDifferences()).toEqual(["messages[1].content"])

    const historical = getPhase4RequestSnapshot(phase4ProbeFixtures.B)
    const aligned = getPhase4RequestSnapshot(phase4ProbeFixtures.C)

    expect(historical.messages).toEqual([
      { role: "system", content: historicalSystemMessage },
      { role: "user", content: historicalUserMessage },
    ])
    expect(aligned.messages).toEqual([
      { role: "system", content: historicalSystemMessage },
      { role: "user", content: alignedPlaceUserMessage },
    ])
    expect({ ...aligned, messages: historical.messages }).toEqual(historical)
  })

  test("preserves the locked provider request configuration", () => {
    expect(getPhase4RequestSnapshot(phase4ProbeFixtures.C)).toMatchObject({
      api: "chat.completions.create",
      modelSource: "GROQ_MODEL",
      schemaName: "groq_strict_capability_smoke",
      strict: true,
      temperature: null,
      maxCompletionTokens: 256,
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

  test("uses different schema fingerprints only when schemas differ", () => {
    expect(getPhase4SchemaFingerprint(phase4ProbeFixtures.A)).not.toBe(
      getPhase4SchemaFingerprint(phase4ProbeFixtures.B)
    )
    expect(getPhase4SchemaFingerprint(phase4ProbeFixtures.B)).toBe(
      getPhase4SchemaFingerprint(phase4ProbeFixtures.C)
    )
  })

  test("enforces control and infrastructure stop decisions", () => {
    expect(getNextPhase4Probe("A", false, "UNKNOWN")).toBeNull()
    expect(getNextPhase4Probe("A", true, null)).toBe("B")
    expect(getNextPhase4Probe("B", true, null)).toBe("C")
    expect(getNextPhase4Probe("B", false, "JSON_VALIDATE_FAILED")).toBe("C")
    expect(getNextPhase4Probe("B", false, "NONCONFORMING_OUTPUT")).toBe("C")
    expect(getNextPhase4Probe("B", false, "OUTPUT_TRUNCATED")).toBe("C")
    expect(getNextPhase4Probe("B", false, "SCHEMA_REQUEST_REJECTED")).toBeNull()
    expect(getNextPhase4Probe("B", false, "PROVIDER_RATE_LIMITED")).toBeNull()
    expect(getNextPhase4Probe("B", false, "PROVIDER_UNAVAILABLE")).toBeNull()
    expect(getNextPhase4Probe("B", false, "CONFIGURATION_ERROR")).toBeNull()
    expect(getNextPhase4Probe("C", true, null)).toBeNull()
  })
})

describe("Groq strict-schema Phase 4 diagnostics", () => {
  test("persists one sanitized record per simulated request", () => {
    const reportPath = createTemporaryReportPath()
    const configuredSecret = "unit-test-secret-value"
    const headers = new Headers({
      authorization: `Bearer ${configuredSecret}`,
      "x-account-id": "private-account",
      "x-ratelimit-limit-tokens": "8000",
      "x-ratelimit-remaining-tokens": "7000",
      "x-ratelimit-reset-tokens": "2.4s",
    })
    const control = createPhase4DiagnosticRecord({
      fixture: phase4ProbeFixtures.A,
      resultOk: true,
      normalizedFailureCode: null,
      observation: {
        ok: true,
        finishReason: "stop",
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      },
      configuredSecret,
    })
    const historicalPlace = createPhase4DiagnosticRecord({
      fixture: phase4ProbeFixtures.B,
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
            failed_generation: `invalid ${configuredSecret}`,
            raw_body: "must-not-persist",
          },
        },
      },
      configuredSecret,
    })
    const alignedPlace = createPhase4DiagnosticRecord({
      fixture: phase4ProbeFixtures.C,
      resultOk: true,
      normalizedFailureCode: null,
      observation: {
        ok: true,
        finishReason: "stop",
        usage: { inputTokens: 150, outputTokens: 30, totalTokens: 180 },
      },
      configuredSecret,
    })

    for (const record of [control, historicalPlace, alignedPlace]) {
      appendPhase4DiagnosticRecord(reportPath, record)
    }

    expect(readPhase4DiagnosticRecords(reportPath)).toEqual([
      control,
      historicalPlace,
      alignedPlace,
    ])
    expect(readFileSync(reportPath, "utf8").trim().split("\n")).toHaveLength(3)
    expect(control).toMatchObject({
      outcomeClassification: "CONTROL_PASSED",
      retryCount: 0,
    })
    expect(historicalPlace).toMatchObject({
      outcomeClassification: "HISTORICAL_PLACE_JSON_FAILED",
      providerErrorClassification: "JSON_VALIDATE_FAILED",
      providerErrorType: "invalid_request_error",
      errorCode: "json_validate_failed",
      tokenLimit: 8000,
      remainingTokens: 7000,
      resetSeconds: 3,
      retryCount: 0,
    })
    expect(alignedPlace).toMatchObject({
      outcomeClassification: "ALIGNED_PLACE_ACCEPTED",
      parsedOutputValid: true,
      schemaValidationPassed: true,
      retryCount: 0,
    })
    expect(historicalPlace.schemaFingerprint).toBe(
      alignedPlace.schemaFingerprint
    )

    const serialized = readFileSync(reportPath, "utf8")
    expect(serialized).not.toContain(configuredSecret)
    expect(serialized).not.toContain("authorization")
    expect(serialized).not.toContain("private-account")
    expect(serialized).not.toContain("must-not-persist")
    expect(serialized).not.toContain(historicalUserMessage)
    expect(serialized).not.toContain(alignedPlaceUserMessage)
  })
})

function createTemporaryReportPath() {
  const directory = mkdtempSync(join(tmpdir(), "groq-phase4-test-"))
  temporaryDirectories.push(directory)
  return join(directory, "report.jsonl")
}
