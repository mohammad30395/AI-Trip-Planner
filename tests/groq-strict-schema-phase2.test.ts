import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, test } from "vitest"

import { phase1ProbeFixtures } from "@/tests/helpers/groq-strict-schema-phase1"
import {
  appendPhase2DiagnosticRecord,
  auditPhase2ProbeFixture,
  createPhase2DiagnosticRecord,
  diffPhase2Requests,
  diffPhase2Schemas,
  getNextPhase2Probe,
  getPhase2RequestSnapshot,
  phase2ProbeFixtures,
  readPhase2DiagnosticRecords,
  validateNullableEnumResponse,
} from "@/tests/helpers/groq-strict-schema-phase2"

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("Groq strict-schema Phase 2 fixtures", () => {
  test("recovers the exact accepted Phase-1 nullable-string baseline", () => {
    expect(auditPhase2ProbeFixture(phase2ProbeFixtures.A)).toEqual([])
    expect(phase2ProbeFixtures.A.schema).toEqual(
      phase1ProbeFixtures.B.schema
    )
    expect(phase2ProbeFixtures.A.schema.properties.message).toEqual({
      type: ["string", "null"],
      minLength: 1,
    })
  })

  test("adds only the nullable enum keyword to the candidate schema", () => {
    expect(auditPhase2ProbeFixture(phase2ProbeFixtures.B)).toEqual([])
    expect(diffPhase2Requests()).toEqual(["schema"])
    expect(diffPhase2Schemas()).toEqual(["properties.message.enum"])
    expect(phase2ProbeFixtures.B.schema.properties.message).toEqual({
      type: ["string", "null"],
      minLength: 1,
      enum: ["Confirmed", null],
    })
  })

  test("preserves the complete locked non-schema request configuration", () => {
    const control = getPhase2RequestSnapshot(phase2ProbeFixtures.A)
    const candidate = getPhase2RequestSnapshot(phase2ProbeFixtures.B)

    expect({ ...candidate, schema: control.schema }).toEqual(control)
    expect(candidate).toMatchObject({
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

  test("accepts both enum outcomes and rejects nonconforming output", () => {
    expect(validateNullableEnumResponse({ ok: true, message: "Confirmed" })).toBe(
      true
    )
    expect(validateNullableEnumResponse({ ok: true, message: null })).toBe(true)
    expect(validateNullableEnumResponse({ ok: true, message: "Unsupported" })).toBe(
      false
    )
    expect(validateNullableEnumResponse({ ok: true, message: "" })).toBe(false)
    expect(
      validateNullableEnumResponse({ ok: true, message: null, extra: true })
    ).toBe(false)
  })

  test("stops after control failure and never schedules beyond Probe B", () => {
    expect(getNextPhase2Probe("A", false)).toBeNull()
    expect(getNextPhase2Probe("A", true)).toBe("B")
    expect(getNextPhase2Probe("B", false)).toBeNull()
    expect(getNextPhase2Probe("B", true)).toBeNull()
  })
})

describe("Groq strict-schema Phase 2 diagnostics", () => {
  test("persists exactly one sanitized record per request", () => {
    const reportPath = createTemporaryReportPath()
    const configuredSecret = "unit-test-secret-value"
    const headers = new Headers({
      authorization: `Bearer ${configuredSecret}`,
      "x-account-id": "private-account",
      "x-ratelimit-limit-tokens": "8000",
      "x-ratelimit-remaining-tokens": "7200",
      "x-ratelimit-reset-tokens": "2.1s",
    })
    const control = createPhase2DiagnosticRecord({
      fixture: phase2ProbeFixtures.A,
      resultOk: true,
      normalizedFailureCode: null,
      observation: {
        ok: true,
        finishReason: "stop",
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      },
      configuredSecret,
    })
    const candidate = createPhase2DiagnosticRecord({
      fixture: phase2ProbeFixtures.B,
      resultOk: false,
      normalizedFailureCode: "invalid_json",
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

    appendPhase2DiagnosticRecord(reportPath, control)
    appendPhase2DiagnosticRecord(reportPath, candidate)

    expect(readPhase2DiagnosticRecords(reportPath)).toEqual([
      control,
      candidate,
    ])
    expect(readFileSync(reportPath, "utf8").trim().split("\n")).toHaveLength(2)
    expect(control).toMatchObject({
      outcomeClassification: "NULLABLE_STRING_CONTROL_PASSED",
      providerErrorClassification: null,
      parsedOutputValid: true,
      schemaValidationPassed: true,
      retryCount: 0,
    })
    expect(candidate).toMatchObject({
      outcomeClassification: "NULLABLE_ENUM_SUSPECT",
      providerErrorClassification: "JSON_VALIDATE_FAILED",
      providerErrorType: "invalid_request_error",
      httpStatus: 400,
      errorCode: "json_validate_failed",
      parsedOutputValid: false,
      schemaValidationPassed: null,
      tokenLimit: 8000,
      remainingTokens: 7200,
      resetSeconds: 3,
      retryCount: 0,
    })

    const serialized = readFileSync(reportPath, "utf8")
    expect(serialized).not.toContain(configuredSecret)
    expect(serialized).not.toContain("authorization")
    expect(serialized).not.toContain("private-account")
    expect(serialized).not.toContain("must-not-persist")
  })
})

function createTemporaryReportPath() {
  const directory = mkdtempSync(join(tmpdir(), "groq-phase2-test-"))
  temporaryDirectories.push(directory)
  return join(directory, "report.jsonl")
}
