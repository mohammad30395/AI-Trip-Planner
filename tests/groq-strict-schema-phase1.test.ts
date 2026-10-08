import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, test } from "vitest"

import {
  appendPhase1DiagnosticRecord,
  auditPhase1ProbeFixture,
  createPhase1DiagnosticRecord,
  diffPhase1FixtureFromBaseline,
  getNextPhase1Probe,
  getPhase1RequestSnapshot,
  phase1ProbeFixtures,
  readPhase1DiagnosticRecords,
  validatePhase1ProbeResponse,
} from "@/tests/helpers/groq-strict-schema-phase1"

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("Groq strict-schema Phase 1 fixtures", () => {
  test("keeps Probe A identical to the historical Step-2 control", () => {
    expect(auditPhase1ProbeFixture(phase1ProbeFixtures.A)).toEqual([])
    expect(diffPhase1FixtureFromBaseline(phase1ProbeFixtures.A)).toEqual([])
    expect(getPhase1RequestSnapshot(phase1ProbeFixtures.A)).toEqual({
      api: "chat.completions.create",
      modelSource: "GROQ_MODEL",
      messages: [
        {
          role: "system",
          content:
            "Return only data matching the supplied JSON schema for a provider capability test.",
        },
        {
          role: "user",
          content:
            "Return ok as true and a very short message confirming strict structured output.",
        },
      ],
      schemaName: "groq_strict_capability_smoke",
      schema: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          message: { type: "string", minLength: 1 },
        },
        required: ["ok", "message"],
        additionalProperties: false,
      },
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

  test("changes only message.type for Probe B", () => {
    expect(auditPhase1ProbeFixture(phase1ProbeFixtures.B)).toEqual([])
    expect(diffPhase1FixtureFromBaseline(phase1ProbeFixtures.B)).toEqual([
      "schema",
    ])
    expect(phase1ProbeFixtures.B.schema.properties.message).toEqual({
      type: ["string", "null"],
      minLength: 1,
    })
  })

  test("independently replaces message with minimal anyOf for Probe C", () => {
    expect(auditPhase1ProbeFixture(phase1ProbeFixtures.C)).toEqual([])
    expect(diffPhase1FixtureFromBaseline(phase1ProbeFixtures.C)).toEqual([
      "schema",
    ])
    expect(phase1ProbeFixtures.C.schema.properties.message).toEqual({
      anyOf: [
        { type: "string", minLength: 1 },
        { type: "null" },
      ],
    })
    expect(phase1ProbeFixtures.C.schema.properties.message).not.toHaveProperty(
      "type"
    )
  })

  test("stops on failure and never schedules more than A, B, C", () => {
    expect(getNextPhase1Probe("A", false)).toBeNull()
    expect(getNextPhase1Probe("A", true)).toBe("B")
    expect(getNextPhase1Probe("B", false)).toBeNull()
    expect(getNextPhase1Probe("B", true)).toBe("C")
    expect(getNextPhase1Probe("C", false)).toBeNull()
    expect(getNextPhase1Probe("C", true)).toBeNull()
  })

  test("validates both permitted message branches and rejects drift", () => {
    expect(validatePhase1ProbeResponse({ ok: true, message: "accepted" })).toBe(
      true
    )
    expect(validatePhase1ProbeResponse({ ok: true, message: null })).toBe(true)
    expect(validatePhase1ProbeResponse({ ok: true, message: "" })).toBe(false)
    expect(validatePhase1ProbeResponse({ ok: false, message: null })).toBe(false)
    expect(
      validatePhase1ProbeResponse({ ok: true, message: null, extra: true })
    ).toBe(false)
  })
})

describe("Groq strict-schema Phase 1 diagnostics", () => {
  test("appends one safe JSONL record per provider request", () => {
    const reportPath = createTemporaryReportPath()
    const configuredSecret = "unit-test-secret-value"
    const headers = new Headers({
      authorization: `Bearer ${configuredSecret}`,
      "x-account-id": "private-account",
      "x-ratelimit-limit-tokens": "8000",
      "x-ratelimit-remaining-tokens": "7300",
      "x-ratelimit-reset-tokens": "1.4s",
    })
    const control = createPhase1DiagnosticRecord({
      fixture: phase1ProbeFixtures.A,
      resultOk: true,
      normalizedFailureCode: null,
      observation: {
        ok: true,
        finishReason: "stop",
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      },
      configuredSecret,
    })
    const nullable = createPhase1DiagnosticRecord({
      fixture: phase1ProbeFixtures.B,
      resultOk: false,
      normalizedFailureCode: "invalid_json",
      observation: {
        ok: false,
        error: {
          status: 400,
          headers,
          error: {
            code: "json_validate_failed",
            failed_generation: `invalid ${configuredSecret}`,
            raw_body: "must-not-persist",
          },
        },
      },
      configuredSecret,
    })

    appendPhase1DiagnosticRecord(reportPath, control)
    appendPhase1DiagnosticRecord(reportPath, nullable)

    expect(readPhase1DiagnosticRecords(reportPath)).toEqual([
      control,
      nullable,
    ])
    expect(readFileSync(reportPath, "utf8").trim().split("\n")).toHaveLength(2)
    expect(control).toMatchObject({
      outcomeClassification: "BASELINE_PASSED",
      providerErrorClassification: null,
      parsedOutputValid: true,
      schemaValidationPassed: true,
      retryPerformed: false,
    })
    expect(nullable).toMatchObject({
      outcomeClassification: "NULLABLE_STRING_SUSPECT",
      providerErrorClassification: "JSON_VALIDATE_FAILED",
      httpStatus: 400,
      errorCode: "json_validate_failed",
      parsedOutputValid: false,
      schemaValidationPassed: null,
      tokenLimit: 8000,
      remainingTokens: 7300,
      resetSeconds: 2,
      retryPerformed: false,
    })

    const serialized = readFileSync(reportPath, "utf8")
    expect(serialized).not.toContain(configuredSecret)
    expect(serialized).not.toContain("authorization")
    expect(serialized).not.toContain("private-account")
    expect(serialized).not.toContain("must-not-persist")
  })
})

function createTemporaryReportPath() {
  const directory = mkdtempSync(join(tmpdir(), "groq-phase1-test-"))
  temporaryDirectories.push(directory)
  return join(directory, "report.jsonl")
}
