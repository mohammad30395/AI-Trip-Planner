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
  summarizeFailedGeneration,
  type FailedGenerationSummary,
  type StrictControlRequestSnapshot,
} from "@/tests/helpers/groq-strict-control"
import {
  expectedPhase1Model,
  getPhase1RequestSnapshot,
  phase1ProbeFixtures,
  validatePhase1ProbeResponse,
} from "@/tests/helpers/groq-strict-schema-phase1"

type Phase2ProbeId = "A" | "B"

type Phase2OutcomeClassification =
  | "NULLABLE_STRING_CONTROL_PASSED"
  | "CONTROL_FAILURE"
  | "NULLABLE_ENUM_ACCEPTED"
  | "NULLABLE_ENUM_SUSPECT"

type Phase2ProviderClassification =
  | "SCHEMA_REQUEST_REJECTED"
  | "JSON_VALIDATE_FAILED"
  | "NONCONFORMING_OUTPUT"
  | "OUTPUT_TRUNCATED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "CONFIGURATION_ERROR"
  | "UNKNOWN"

type Phase2ProbeFixture = {
  id: Phase2ProbeId
  purpose: string
  schemaDifference: string
  schema: Record<string, unknown>
  validateResponse: (value: unknown) => boolean
}

type Phase2DiagnosticRecord = {
  probe: Phase2ProbeId
  purpose: string
  baselineIdentifier: "step4a2t-nullable-string"
  schemaDifference: string
  modelIdentifier: "openai/gpt-oss-20b"
  accepted: boolean
  httpStatus: number | null
  outcomeClassification: Phase2OutcomeClassification
  providerErrorClassification: Phase2ProviderClassification | null
  providerErrorType: string | null
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
  retryCount: 0
}

const phase2BaselineIdentifier = "step4a2t-nullable-string" as const
const expectedPhase2Model = expectedPhase1Model

const nullableEnumSchema = {
  ...phase1ProbeFixtures.B.schema,
  properties: {
    ...phase1ProbeFixtures.B.schema.properties,
    message: {
      ...phase1ProbeFixtures.B.schema.properties.message,
      enum: ["Confirmed", null],
    },
  },
} as const

const phase2ProbeFixtures = {
  A: {
    id: "A",
    purpose: "Known-good Step 4A.2T nullable-string control",
    schemaDifference: "NONE",
    schema: phase1ProbeFixtures.B.schema,
    validateResponse: validatePhase1ProbeResponse,
  },
  B: {
    id: "B",
    purpose: "Nullable string with enum constraint",
    schemaDifference:
      'message.enum added: ["Confirmed", null]; all existing keywords preserved',
    schema: nullableEnumSchema,
    validateResponse: validateNullableEnumResponse,
  },
} as const satisfies Record<Phase2ProbeId, Phase2ProbeFixture>

function auditPhase2ProbeFixture(fixture: Phase2ProbeFixture) {
  const problems: string[] = []
  const schema = asRecord(fixture.schema)
  const properties = asRecord(schema?.properties)
  const message = asRecord(properties?.message)

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

  if (
    !Array.isArray(message?.type) ||
    JSON.stringify(message.type) !== JSON.stringify(["string", "null"])
  ) {
    problems.push("message must retain the nullable string union.")
  }

  if (message?.minLength !== 1) {
    problems.push("message must retain minLength 1.")
  }

  if (
    fixture.id === "A" &&
    Object.prototype.hasOwnProperty.call(message, "enum")
  ) {
    problems.push("The control must not contain an enum constraint.")
  }

  if (
    fixture.id === "B" &&
    (!Array.isArray(message?.enum) ||
      JSON.stringify(message.enum) !== JSON.stringify(["Confirmed", null]))
  ) {
    problems.push("The candidate must use the exact nullable enum.")
  }

  return problems
}

function getPhase2RequestSnapshot(fixture: Phase2ProbeFixture) {
  return {
    ...getPhase1RequestSnapshot(phase1ProbeFixtures.B),
    schema: fixture.schema,
  } satisfies StrictControlRequestSnapshot
}

function diffPhase2Requests() {
  const control = getPhase2RequestSnapshot(phase2ProbeFixtures.A)
  const candidate = getPhase2RequestSnapshot(phase2ProbeFixtures.B)
  const keys = Object.keys(control) as (keyof StrictControlRequestSnapshot)[]

  return keys.filter(
    (key) => JSON.stringify(control[key]) !== JSON.stringify(candidate[key])
  )
}

function diffPhase2Schemas() {
  return collectSchemaDifferences(
    phase2ProbeFixtures.A.schema,
    phase2ProbeFixtures.B.schema
  )
}

function getNextPhase2Probe(
  probe: Phase2ProbeId,
  succeeded: boolean
): Phase2ProbeId | null {
  return probe === "A" && succeeded ? "B" : null
}

function validateNullableEnumResponse(value: unknown) {
  const response = asRecord(value)

  return (
    response !== undefined &&
    Object.keys(response).length === 2 &&
    response.ok === true &&
    (response.message === "Confirmed" || response.message === null)
  )
}

function createPhase2DiagnosticRecord({
  fixture,
  observation,
  normalizedFailureCode,
  resultOk,
  configuredSecret,
}: {
  fixture: Phase2ProbeFixture
  observation: GroqStrictCapabilityProviderObservation
  normalizedFailureCode: GroqFailureCode | null
  resultOk: boolean
  configuredSecret?: string
}): Phase2DiagnosticRecord {
  const diagnostic = observation.ok
    ? undefined
    : sanitizeGroqSchemaProbeError(observation.error, configuredSecret)
  const rateLimit = observation.ok
    ? getSafeStrictControlRateLimit(undefined)
    : getSafeStrictControlRateLimit(getErrorHeaders(observation.error))
  const usage = observation.ok ? observation.usage : undefined

  return {
    probe: fixture.id,
    purpose: fixture.purpose,
    baselineIdentifier: phase2BaselineIdentifier,
    schemaDifference: fixture.schemaDifference,
    modelIdentifier: expectedPhase2Model,
    accepted: observation.ok,
    httpStatus: observation.ok ? 200 : diagnostic?.httpStatus ?? null,
    outcomeClassification: classifyPhase2Outcome(fixture.id, resultOk),
    providerErrorClassification: classifyPhase2ProviderError(
      observation,
      normalizedFailureCode,
      diagnostic?.httpStatus,
      diagnostic?.errorCode
    ),
    providerErrorType: diagnostic?.errorType ?? null,
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
    retryCount: 0,
  }
}

function appendPhase2DiagnosticRecord(
  reportPath: string,
  record: Phase2DiagnosticRecord
) {
  appendFileSync(reportPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    flag: "a",
  })
}

function readPhase2DiagnosticRecords(reportPath: string) {
  const lines = readFileSync(reportPath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)

  return lines.map((line, index) =>
    parsePhase2DiagnosticRecord(JSON.parse(line) as unknown, index + 1)
  )
}

function classifyPhase2Outcome(
  probe: Phase2ProbeId,
  resultOk: boolean
): Phase2OutcomeClassification {
  if (probe === "A") {
    return resultOk ? "NULLABLE_STRING_CONTROL_PASSED" : "CONTROL_FAILURE"
  }

  return resultOk ? "NULLABLE_ENUM_ACCEPTED" : "NULLABLE_ENUM_SUSPECT"
}

function classifyPhase2ProviderError(
  observation: GroqStrictCapabilityProviderObservation,
  normalizedFailureCode: GroqFailureCode | null,
  httpStatus: number | undefined,
  providerCode: string | undefined
): Phase2ProviderClassification | null {
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

  if (normalizedFailureCode === "schema_validation") {
    return "NONCONFORMING_OUTPUT"
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

function collectSchemaDifferences(
  controlValue: unknown,
  candidateValue: unknown,
  path = ""
): string[] {
  if (JSON.stringify(controlValue) === JSON.stringify(candidateValue)) {
    return []
  }

  const control = asRecord(controlValue)
  const candidate = asRecord(candidateValue)

  if (control === undefined || candidate === undefined) {
    return [path]
  }

  const keys = new Set([...Object.keys(control), ...Object.keys(candidate)])

  return [...keys].flatMap((key) =>
    collectSchemaDifferences(
      control[key],
      candidate[key],
      path.length === 0 ? key : `${path}.${key}`
    )
  )
}

function parsePhase2DiagnosticRecord(value: unknown, lineNumber: number) {
  const record = asRecord(value)

  if (
    record === undefined ||
    (record.probe !== "A" && record.probe !== "B") ||
    typeof record.purpose !== "string" ||
    record.baselineIdentifier !== phase2BaselineIdentifier ||
    typeof record.schemaDifference !== "string" ||
    record.modelIdentifier !== expectedPhase2Model ||
    typeof record.accepted !== "boolean" ||
    !isNullableNumber(record.httpStatus) ||
    typeof record.outcomeClassification !== "string" ||
    !isNullableString(record.providerErrorClassification) ||
    !isNullableString(record.providerErrorType) ||
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
    record.retryCount !== 0
  ) {
    throw new Error(`Invalid Phase-2 record on JSONL line ${lineNumber}.`)
  }

  return record as Phase2DiagnosticRecord
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
  appendPhase2DiagnosticRecord,
  auditPhase2ProbeFixture,
  createPhase2DiagnosticRecord,
  diffPhase2Requests,
  diffPhase2Schemas,
  expectedPhase2Model,
  getNextPhase2Probe,
  getPhase2RequestSnapshot,
  phase2BaselineIdentifier,
  phase2ProbeFixtures,
  readPhase2DiagnosticRecords,
  validateNullableEnumResponse,
  type Phase2DiagnosticRecord,
  type Phase2OutcomeClassification,
  type Phase2ProbeFixture,
  type Phase2ProbeId,
  type Phase2ProviderClassification,
}
