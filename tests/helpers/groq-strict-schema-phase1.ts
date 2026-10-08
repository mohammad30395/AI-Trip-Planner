import { appendFileSync, readFileSync } from "node:fs"

import type {
  GroqFailureCode,
  GroqStrictCapabilityProviderObservation,
} from "@/lib/ai/groq"
import {
  getErrorHeaders,
  sanitizeGroqSchemaProbeError,
} from "@/tests/helpers/groq-schema-probes"
import {
  getSafeStrictControlRateLimit,
  historicalStep2ControlRequest,
  summarizeFailedGeneration,
  type FailedGenerationSummary,
  type StrictControlRequestSnapshot,
} from "@/tests/helpers/groq-strict-control"

type Phase1ProbeId = "A" | "B" | "C"

type Phase1OutcomeClassification =
  | "BASELINE_PASSED"
  | "CONTROL_FAILURE"
  | "NULLABLE_STRING_ACCEPTED"
  | "NULLABLE_STRING_SUSPECT"
  | "ANYOF_ACCEPTED"
  | "ANYOF_SUSPECT"

type Phase1ProviderClassification =
  | "SCHEMA_REQUEST_REJECTED"
  | "JSON_VALIDATE_FAILED"
  | "OUTPUT_TRUNCATED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "CONFIGURATION_ERROR"
  | "UNKNOWN"

type Phase1ProbeFixture = {
  id: Phase1ProbeId
  purpose: string
  schemaDifference: string
  schema: Record<string, unknown>
}

type Phase1DiagnosticRecord = {
  probe: Phase1ProbeId
  purpose: string
  baselineIdentifier: "step2-c99b866"
  schemaDifference: string
  modelIdentifier: "openai/gpt-oss-20b"
  accepted: boolean
  httpStatus: number | null
  outcomeClassification: Phase1OutcomeClassification
  providerErrorClassification: Phase1ProviderClassification | null
  errorCode: string | null
  finishReason: string | null
  parsedOutputValid: boolean | null
  schemaValidationPassed: boolean | null
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  tokenLimit: number | null
  remainingTokens: number | null
  resetSeconds: number | null
  failedGenerationSummary: FailedGenerationSummary
  retryPerformed: false
}

const phase1BaselineIdentifier = "step2-c99b866" as const
const expectedPhase1Model = "openai/gpt-oss-20b" as const

const historicalControlSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    message: { type: "string", minLength: 1 },
  },
  required: ["ok", "message"],
  additionalProperties: false,
} as const

const nullableStringSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    message: { type: ["string", "null"], minLength: 1 },
  },
  required: ["ok", "message"],
  additionalProperties: false,
} as const

const minimalAnyOfSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    message: {
      anyOf: [
        { type: "string", minLength: 1 },
        { type: "null" },
      ],
    },
  },
  required: ["ok", "message"],
  additionalProperties: false,
} as const

const phase1ProbeFixtures = {
  A: {
    id: "A",
    purpose: "Historical strict control",
    schemaDifference: "NONE",
    schema: historicalControlSchema,
  },
  B: {
    id: "B",
    purpose: "Nullable string type union",
    schemaDifference:
      "message.type: string -> [string, null]; minLength: 1 preserved",
    schema: nullableStringSchema,
  },
  C: {
    id: "C",
    purpose: "Minimal anyOf string/null union",
    schemaDifference:
      "message: nonempty string -> anyOf(nonempty string, null)",
    schema: minimalAnyOfSchema,
  },
} as const satisfies Record<Phase1ProbeId, Phase1ProbeFixture>

function auditPhase1ProbeFixture(fixture: Phase1ProbeFixture) {
  const problems: string[] = []
  const schema = asRecord(fixture.schema)
  const properties = asRecord(schema?.properties)

  if (schema?.type !== "object") {
    problems.push("Root type must be object.")
  }

  if (schema?.additionalProperties !== false) {
    problems.push("Root object must set additionalProperties to false.")
  }

  if (
    !Array.isArray(schema?.required) ||
    JSON.stringify(schema.required) !== JSON.stringify(["ok", "message"])
  ) {
    problems.push("Root object must require ok and message.")
  }

  if (asRecord(properties?.ok)?.type !== "boolean") {
    problems.push("ok must remain boolean.")
  }

  if (properties?.message === undefined) {
    problems.push("message schema is required.")
  }

  return problems
}

function getPhase1RequestSnapshot(fixture: Phase1ProbeFixture) {
  return {
    ...historicalStep2ControlRequest,
    schema: fixture.schema,
  } satisfies StrictControlRequestSnapshot
}

function diffPhase1FixtureFromBaseline(fixture: Phase1ProbeFixture) {
  const baseline = getPhase1RequestSnapshot(phase1ProbeFixtures.A)
  const candidate = getPhase1RequestSnapshot(fixture)
  const keys = Object.keys(baseline) as (keyof StrictControlRequestSnapshot)[]

  return keys.filter(
    (key) => JSON.stringify(baseline[key]) !== JSON.stringify(candidate[key])
  )
}

function getNextPhase1Probe(
  probe: Phase1ProbeId,
  succeeded: boolean
): Phase1ProbeId | null {
  if (!succeeded || probe === "C") {
    return null
  }

  return probe === "A" ? "B" : "C"
}

function validatePhase1ProbeResponse(value: unknown) {
  const response = asRecord(value)

  return (
    response !== undefined &&
    Object.keys(response).length === 2 &&
    response.ok === true &&
    (response.message === null ||
      (typeof response.message === "string" &&
        response.message.trim().length > 0))
  )
}

function createPhase1DiagnosticRecord({
  fixture,
  observation,
  normalizedFailureCode,
  resultOk,
  configuredSecret,
}: {
  fixture: Phase1ProbeFixture
  observation: GroqStrictCapabilityProviderObservation
  normalizedFailureCode: GroqFailureCode | null
  resultOk: boolean
  configuredSecret?: string
}): Phase1DiagnosticRecord {
  const diagnostic = observation.ok
    ? undefined
    : sanitizeGroqSchemaProbeError(observation.error, configuredSecret)
  const rateLimit = observation.ok
    ? getSafeStrictControlRateLimit(undefined)
    : getSafeStrictControlRateLimit(getErrorHeaders(observation.error))
  const usage = observation.ok ? observation.usage : undefined
  const providerErrorClassification = classifyProviderError(
    observation,
    normalizedFailureCode,
    diagnostic?.httpStatus,
    diagnostic?.errorCode
  )

  return {
    probe: fixture.id,
    purpose: fixture.purpose,
    baselineIdentifier: phase1BaselineIdentifier,
    schemaDifference: fixture.schemaDifference,
    modelIdentifier: expectedPhase1Model,
    accepted: observation.ok,
    httpStatus: observation.ok ? 200 : diagnostic?.httpStatus ?? null,
    outcomeClassification: classifyProbeOutcome(fixture.id, resultOk),
    providerErrorClassification,
    errorCode: diagnostic?.errorCode ?? normalizedFailureCode,
    finishReason: observation.ok ? observation.finishReason ?? null : null,
    parsedOutputValid: getParsedOutputValidity(resultOk, normalizedFailureCode),
    schemaValidationPassed: getSchemaValidationResult(
      resultOk,
      normalizedFailureCode
    ),
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    totalTokens: usage?.totalTokens ?? null,
    tokenLimit: rateLimit.tokenLimit,
    remainingTokens: rateLimit.remainingTokens,
    resetSeconds: rateLimit.resetSeconds,
    failedGenerationSummary: observation.ok
      ? summarizeFailedGeneration(undefined)
      : summarizeFailedGeneration(observation.error, configuredSecret),
    retryPerformed: false,
  }
}

function appendPhase1DiagnosticRecord(
  reportPath: string,
  record: Phase1DiagnosticRecord
) {
  appendFileSync(reportPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    flag: "a",
  })
}

function readPhase1DiagnosticRecords(reportPath: string) {
  const lines = readFileSync(reportPath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)

  return lines.map((line, index) =>
    parsePhase1DiagnosticRecord(JSON.parse(line) as unknown, index + 1)
  )
}

function classifyProbeOutcome(
  probe: Phase1ProbeId,
  resultOk: boolean
): Phase1OutcomeClassification {
  if (probe === "A") {
    return resultOk ? "BASELINE_PASSED" : "CONTROL_FAILURE"
  }

  if (probe === "B") {
    return resultOk ? "NULLABLE_STRING_ACCEPTED" : "NULLABLE_STRING_SUSPECT"
  }

  return resultOk ? "ANYOF_ACCEPTED" : "ANYOF_SUSPECT"
}

function classifyProviderError(
  observation: GroqStrictCapabilityProviderObservation,
  normalizedFailureCode: GroqFailureCode | null,
  httpStatus: number | undefined,
  providerCode: string | undefined
): Phase1ProviderClassification | null {
  if (normalizedFailureCode === "configuration") {
    return "CONFIGURATION_ERROR"
  }

  if (normalizedFailureCode === "rate_limited" || httpStatus === 429) {
    return "PROVIDER_RATE_LIMITED"
  }

  if (normalizedFailureCode === "output_truncated") {
    return "OUTPUT_TRUNCATED"
  }

  if (
    normalizedFailureCode === "invalid_json" ||
    providerCode === "json_validate_failed"
  ) {
    return "JSON_VALIDATE_FAILED"
  }

  if (httpStatus === 400) {
    return "SCHEMA_REQUEST_REJECTED"
  }

  if (
    normalizedFailureCode === "provider_timeout" ||
    normalizedFailureCode === "provider_error" ||
    (!observation.ok && httpStatus !== undefined && httpStatus >= 500)
  ) {
    return "PROVIDER_UNAVAILABLE"
  }

  return normalizedFailureCode === null ? null : "UNKNOWN"
}

function getParsedOutputValidity(
  resultOk: boolean,
  failureCode: GroqFailureCode | null
) {
  if (resultOk || failureCode === "schema_validation") {
    return true
  }

  if (failureCode === "invalid_json") {
    return false
  }

  return null
}

function getSchemaValidationResult(
  resultOk: boolean,
  failureCode: GroqFailureCode | null
) {
  if (resultOk) {
    return true
  }

  if (failureCode === "schema_validation") {
    return false
  }

  return null
}

function parsePhase1DiagnosticRecord(value: unknown, lineNumber: number) {
  const record = asRecord(value)

  if (
    record === undefined ||
    (record.probe !== "A" && record.probe !== "B" && record.probe !== "C") ||
    typeof record.purpose !== "string" ||
    record.baselineIdentifier !== phase1BaselineIdentifier ||
    typeof record.schemaDifference !== "string" ||
    record.modelIdentifier !== expectedPhase1Model ||
    typeof record.accepted !== "boolean" ||
    !isNullableNumber(record.httpStatus) ||
    typeof record.outcomeClassification !== "string" ||
    !isNullableString(record.providerErrorClassification) ||
    !isNullableString(record.errorCode) ||
    !isNullableString(record.finishReason) ||
    !isNullableBoolean(record.parsedOutputValid) ||
    !isNullableBoolean(record.schemaValidationPassed) ||
    !isNullableNumber(record.inputTokens) ||
    !isNullableNumber(record.outputTokens) ||
    !isNullableNumber(record.totalTokens) ||
    !isNullableNumber(record.tokenLimit) ||
    !isNullableNumber(record.remainingTokens) ||
    !isNullableNumber(record.resetSeconds) ||
    asRecord(record.failedGenerationSummary) === undefined ||
    record.retryPerformed !== false
  ) {
    throw new Error(`Invalid Phase-1 record on JSONL line ${lineNumber}.`)
  }

  return record as Phase1DiagnosticRecord
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string"
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === "boolean"
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value))
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

export {
  appendPhase1DiagnosticRecord,
  auditPhase1ProbeFixture,
  createPhase1DiagnosticRecord,
  diffPhase1FixtureFromBaseline,
  expectedPhase1Model,
  getNextPhase1Probe,
  getPhase1RequestSnapshot,
  phase1BaselineIdentifier,
  phase1ProbeFixtures,
  readPhase1DiagnosticRecords,
  validatePhase1ProbeResponse,
  type Phase1DiagnosticRecord,
  type Phase1OutcomeClassification,
  type Phase1ProbeFixture,
  type Phase1ProbeId,
  type Phase1ProviderClassification,
}
