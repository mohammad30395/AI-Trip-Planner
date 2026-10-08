import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, test } from "vitest"

import {
  actualSpecificPlaceSchema,
  appendPhase3DiagnosticRecord,
  auditPhase3ProbeFixture,
  createPhase3DiagnosticRecord,
  diffPhase3Requests,
  diffPhase3Schemas,
  getNextPhase3Probe,
  getPhase3RequestSnapshot,
  phase3ProbeFixtures,
  readPhase3DiagnosticRecords,
  specificPlaceWirePath,
  validateMinimalPlaceResponse,
} from "@/tests/helpers/groq-strict-schema-phase3"
import { phase2ProbeFixtures } from "@/tests/helpers/groq-strict-schema-phase2"

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("Groq strict-schema Phase 3 fixtures", () => {
  test("recovers the exact accepted Phase-2 nullable-enum baseline", () => {
    expect(auditPhase3ProbeFixture(phase3ProbeFixtures.A)).toEqual([])
    expect(phase3ProbeFixtures.A.schema).toEqual(phase2ProbeFixtures.B.schema)
  })

  test("extracts the exact specific_place branch from the wire schema", () => {
    expect(specificPlaceWirePath).toBe(
      "itinerary.items.properties.activities.items.properties.place.anyOf[0]"
    )
    expect(actualSpecificPlaceSchema).toEqual({
      type: "object",
      additionalProperties: false,
      required: [
        "kind",
        "name",
        "addressHint",
        "areaHint",
        "originHint",
        "destinationHint",
      ],
      properties: {
        kind: { type: "string", enum: ["specific_place"] },
        name: { type: "string" },
        addressHint: { type: ["string", "null"] },
        areaHint: { type: ["string", "null"] },
        originHint: { type: ["string", "null"] },
        destinationHint: { type: ["string", "null"] },
      },
    })
  })

  test("adds only the required place property to the control schema", () => {
    expect(auditPhase3ProbeFixture(phase3ProbeFixtures.B)).toEqual([])
    expect(diffPhase3Requests()).toEqual(["schema"])
    expect(diffPhase3Schemas()).toEqual(["properties.place", "required"])
    expect(phase3ProbeFixtures.B.schema.properties.ok).toEqual(
      phase2ProbeFixtures.B.schema.properties.ok
    )
    expect(phase3ProbeFixtures.B.schema.properties.message).toEqual(
      phase2ProbeFixtures.B.schema.properties.message
    )
    expect(phase3ProbeFixtures.B.schema.properties.place).toBe(
      actualSpecificPlaceSchema
    )
    expect(phase3ProbeFixtures.B.schema.required).toEqual([
      "ok",
      "message",
      "place",
    ])
  })

  test("preserves every non-schema request field", () => {
    const control = getPhase3RequestSnapshot(phase3ProbeFixtures.A)
    const candidate = getPhase3RequestSnapshot(phase3ProbeFixtures.B)

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

  test("accepts the complete minimal specific_place object", () => {
    expect(validateMinimalPlaceResponse(validMinimalPlaceResponse())).toBe(true)
  })

  test.each([
    ["missing place", { ok: true, message: "Confirmed" }],
    [
      "wrong discriminator",
      validMinimalPlaceResponse({ kind: "generic_activity" }),
    ],
    [
      "missing required nested field",
      withoutProperty(validMinimalPlaceResponse().place, "addressHint"),
    ],
    [
      "unexpected nested property",
      validMinimalPlaceResponse({ unexpected: true }),
    ],
    [
      "unexpected top-level property",
      { ...validMinimalPlaceResponse(), unexpected: true },
    ],
    ["invalid message", { ...validMinimalPlaceResponse(), message: "Other" }],
  ])("rejects %s", (_name, value) => {
    const candidate =
      _name === "missing required nested field"
        ? { ...validMinimalPlaceResponse(), place: value }
        : value

    expect(validateMinimalPlaceResponse(candidate)).toBe(false)
  })

  test("stops after control failure and never schedules beyond Probe B", () => {
    expect(getNextPhase3Probe("A", false)).toBeNull()
    expect(getNextPhase3Probe("A", true)).toBe("B")
    expect(getNextPhase3Probe("B", false)).toBeNull()
    expect(getNextPhase3Probe("B", true)).toBeNull()
  })
})

describe("Groq strict-schema Phase 3 diagnostics", () => {
  test("persists one sanitized record per request", () => {
    const reportPath = createTemporaryReportPath()
    const configuredSecret = "unit-test-secret-value"
    const headers = new Headers({
      authorization: `Bearer ${configuredSecret}`,
      "x-account-id": "private-account",
      "x-ratelimit-limit-tokens": "8000",
      "x-ratelimit-remaining-tokens": "7100",
      "x-ratelimit-reset-tokens": "1.8s",
    })
    const control = createPhase3DiagnosticRecord({
      fixture: phase3ProbeFixtures.A,
      resultOk: true,
      normalizedFailureCode: null,
      observation: {
        ok: true,
        finishReason: "stop",
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      },
      configuredSecret,
    })
    const candidate = createPhase3DiagnosticRecord({
      fixture: phase3ProbeFixtures.B,
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

    appendPhase3DiagnosticRecord(reportPath, control)
    appendPhase3DiagnosticRecord(reportPath, candidate)

    expect(readPhase3DiagnosticRecords(reportPath)).toEqual([
      control,
      candidate,
    ])
    expect(readFileSync(reportPath, "utf8").trim().split("\n")).toHaveLength(2)
    expect(control).toMatchObject({
      outcomeClassification: "NULLABLE_ENUM_CONTROL_PASSED",
      discriminatorValidationPassed: null,
      retryCount: 0,
    })
    expect(candidate).toMatchObject({
      outcomeClassification: "MINIMAL_PLACE_OBJECT_SUSPECT",
      providerErrorClassification: "JSON_VALIDATE_FAILED",
      providerErrorType: "invalid_request_error",
      httpStatus: 400,
      errorCode: "json_validate_failed",
      parsedOutputValid: false,
      schemaValidationPassed: null,
      discriminatorValidationPassed: null,
      tokenLimit: 8000,
      remainingTokens: 7100,
      resetSeconds: 2,
      retryCount: 0,
    })

    const serialized = readFileSync(reportPath, "utf8")
    expect(serialized).not.toContain(configuredSecret)
    expect(serialized).not.toContain("authorization")
    expect(serialized).not.toContain("private-account")
    expect(serialized).not.toContain("must-not-persist")
  })
})

function validMinimalPlaceResponse(
  placeOverrides: Record<string, unknown> = {}
) {
  return {
    ok: true,
    message: "Confirmed",
    place: {
      kind: "specific_place",
      name: "Example museum",
      addressHint: null,
      areaHint: null,
      originHint: null,
      destinationHint: null,
      ...placeOverrides,
    },
  }
}

function withoutProperty(value: Record<string, unknown>, key: string) {
  const copy = { ...value }
  delete copy[key]
  return copy
}

function createTemporaryReportPath() {
  const directory = mkdtempSync(join(tmpdir(), "groq-phase3-test-"))
  temporaryDirectories.push(directory)
  return join(directory, "report.jsonl")
}
