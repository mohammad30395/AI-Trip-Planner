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
  expectedPhase6FullPlaceAnyOfFingerprint,
  expectedPhase6Model,
  getPhase6RequestSnapshot,
  getPhase6SchemaFingerprint,
  phase6ProbeFixtures,
  validateFullPlaceAnyOfResponse,
  type Phase6PlaceVariant,
} from "@/tests/helpers/groq-strict-schema-phase6"

type Phase7ProbeId = "A" | "B"
type Phase7RequestedVariant = "generic_activity" | "transport"
type Phase7OutcomeClassification =
  | "GENERIC_ACTIVITY_ACCEPTED"
  | "GENERIC_ACTIVITY_JSON_FAILED"
  | "GENERIC_ACTIVITY_SUSPECT"
  | "TRANSPORT_ACCEPTED"
  | "TRANSPORT_JSON_FAILED"
  | "TRANSPORT_SUSPECT"
type Phase7ProviderClassification =
  | "SCHEMA_REQUEST_REJECTED"
  | "JSON_VALIDATE_FAILED"
  | "NONCONFORMING_OUTPUT"
  | "OUTPUT_TRUNCATED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "CONFIGURATION_ERROR"
  | "UNKNOWN"

type Phase7ProbeFixture = {
  id: Phase7ProbeId
  purpose: string
  requestedPlaceVariant: Phase7RequestedVariant
  schema: Record<string, unknown>
  userMessage: string
  completionTokenBudget: 512
  validateResponse: (value: unknown) => boolean
}

type Phase7DiagnosticRecord = {
  runIdentifier: "step4a2z-phase7-run-1"
  probe: Phase7ProbeId
  purpose: string
  schemaFingerprint: "da1a8dda005763d4"
  requestedPlaceVariant: Phase7RequestedVariant
  generatedPlaceVariant: Phase6PlaceVariant | null
  completionTokenBudget: 512
  modelIdentifier: "openai/gpt-oss-20b"
  accepted: boolean
  httpStatus: number | null
  outcomeClassification: Phase7OutcomeClassification
  providerErrorClassification: Phase7ProviderClassification | null
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

const phase7RunIdentifier = "step4a2z-phase7-run-1" as const
const expectedPhase7Model = expectedPhase6Model
const expectedPhase7SchemaFingerprint =
  expectedPhase6FullPlaceAnyOfFingerprint
const genericActivityUserMessage =
  "Return a valid confirmation with ok set to true, message set to 'Confirmed', and a place object representing a fictional generic activity. Set kind to 'generic_activity', name to null, and addressHint, areaHint, originHint, and destinationHint to null. Include every schema-required field and no extra fields."
const transportUserMessage =
  "Return a valid confirmation with ok set to true, message set to 'Confirmed', and a place object representing fictional transportation. Set kind to 'transport', name to null, originHint to 'Test Origin', destinationHint to 'Test Destination', and addressHint and areaHint to null. Include every schema-required field and no extra fields."

const phase7ProbeFixtures = {
  A: {
    id: "A",
    purpose: "Full place anyOf requesting generic_activity",
    requestedPlaceVariant: "generic_activity",
    schema: phase6ProbeFixtures.B.schema,
    userMessage: genericActivityUserMessage,
    completionTokenBudget: 512,
    validateResponse: validateGenericActivityResponse,
  },
  B: {
    id: "B",
    purpose: "Full place anyOf requesting transport",
    requestedPlaceVariant: "transport",
    schema: phase6ProbeFixtures.B.schema,
    userMessage: transportUserMessage,
    completionTokenBudget: 512,
    validateResponse: validateTransportResponse,
  },
} as const satisfies Record<Phase7ProbeId, Phase7ProbeFixture>

function auditPhase7ProbeFixtures() {
  const problems: string[] = []

  for (const fixture of Object.values(phase7ProbeFixtures)) {
    if (fixture.schema !== phase6ProbeFixtures.B.schema) {
      problems.push(`Probe ${fixture.id} must reuse the Phase-6 union schema.`)
    }
    if (
      getPhase6SchemaFingerprint({
        ...phase6ProbeFixtures.B,
        schema: fixture.schema,
      }) !== expectedPhase7SchemaFingerprint
    ) {
      problems.push(`Probe ${fixture.id} schema fingerprint must remain locked.`)
    }
    if (fixture.completionTokenBudget !== 512) {
      problems.push(`Probe ${fixture.id} must retain the 512-token budget.`)
    }
  }

  if (phase7ProbeFixtures.A.userMessage !== genericActivityUserMessage) {
    problems.push("Probe A must use the exact authorized generic prompt.")
  }
  if (phase7ProbeFixtures.B.userMessage !== transportUserMessage) {
    problems.push("Probe B must use the exact authorized transport prompt.")
  }

  const differences = diffPhase7Requests()
  if (
    JSON.stringify(differences) !== JSON.stringify(["messages"]) ||
    JSON.stringify(getPhase7MessageDifferences()) !==
      JSON.stringify(["messages[1].content"])
  ) {
    problems.push("Phase-7 requests may differ only at user-message content.")
  }

  return problems
}

function getPhase7RequestSnapshot(fixture: Phase7ProbeFixture) {
  const baseline = getPhase6RequestSnapshot(phase6ProbeFixtures.B)
  const systemMessage = baseline.messages[0]?.content

  if (systemMessage === undefined) {
    throw new Error("The historical system message is unavailable.")
  }

  return {
    ...baseline,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: fixture.userMessage },
    ],
    schema: fixture.schema,
    maxCompletionTokens: fixture.completionTokenBudget,
  } satisfies StrictControlRequestSnapshot
}

function getPhase7OutgoingRequestSnapshot(fixture: Phase7ProbeFixture) {
  const request = getPhase7RequestSnapshot(fixture)

  return {
    model: expectedPhase7Model,
    messages: request.messages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: request.schemaName,
        strict: request.strict,
        schema: request.schema,
      },
    },
    max_completion_tokens: request.maxCompletionTokens,
  } as const
}

function diffPhase7Requests() {
  const generic = getPhase7RequestSnapshot(phase7ProbeFixtures.A)
  const transport = getPhase7RequestSnapshot(phase7ProbeFixtures.B)
  const keys = Object.keys(generic) as (keyof StrictControlRequestSnapshot)[]

  return keys.filter(
    (key) => JSON.stringify(generic[key]) !== JSON.stringify(transport[key])
  )
}

function getPhase7MessageDifferences() {
  const generic = getPhase7RequestSnapshot(phase7ProbeFixtures.A).messages
  const transport = getPhase7RequestSnapshot(phase7ProbeFixtures.B).messages
  const differences: string[] = []

  for (let index = 0; index < Math.max(generic.length, transport.length); index += 1) {
    if (generic[index]?.role !== transport[index]?.role) {
      differences.push(`messages[${index}].role`)
    }
    if (generic[index]?.content !== transport[index]?.content) {
      differences.push(`messages[${index}].content`)
    }
  }

  return differences
}

function validateGenericActivityResponse(value: unknown) {
  if (!validateFullPlaceAnyOfResponse(value)) {
    return false
  }

  const place = getPlace(value)
  return place?.kind === "generic_activity" && place.name === null
}

function validateTransportResponse(value: unknown) {
  if (!validateFullPlaceAnyOfResponse(value)) {
    return false
  }

  const place = getPlace(value)
  return place?.kind === "transport" &&
    place.name === null &&
    typeof place.originHint === "string" &&
    typeof place.destinationHint === "string"
}

function getNextPhase7Probe(
  probe: Phase7ProbeId,
  succeeded: boolean,
  providerClassification: Phase7ProviderClassification | null
): Phase7ProbeId | null {
  if (probe === "B") {
    return null
  }
  if (succeeded) {
    return "B"
  }

  return providerClassification === "JSON_VALIDATE_FAILED" ||
    providerClassification === "NONCONFORMING_OUTPUT" ||
    providerClassification === "OUTPUT_TRUNCATED"
    ? "B"
    : null
}

function createPhase7DiagnosticRecord({
  fixture,
  observation,
  normalizedFailureCode,
  resultOk,
  generatedPlaceVariant,
  configuredSecret,
}: {
  fixture: Phase7ProbeFixture
  observation: GroqStrictCapabilityProviderObservation
  normalizedFailureCode: GroqFailureCode | null
  resultOk: boolean
  generatedPlaceVariant: Phase6PlaceVariant | null
  configuredSecret?: string
}): Phase7DiagnosticRecord {
  const diagnostic = observation.ok
    ? undefined
    : sanitizeGroqSchemaProbeError(observation.error, configuredSecret)
  const rateLimit = observation.ok
    ? getSafeStrictControlRateLimit(undefined)
    : getSafeStrictControlRateLimit(getErrorHeaders(observation.error))
  const usage = observation.ok ? observation.usage : undefined
  const providerErrorClassification = classifyPhase7ProviderError(
    observation,
    normalizedFailureCode,
    diagnostic?.httpStatus,
    diagnostic?.errorCode
  )

  return {
    runIdentifier: phase7RunIdentifier,
    probe: fixture.id,
    purpose: fixture.purpose,
    schemaFingerprint: expectedPhase7SchemaFingerprint,
    requestedPlaceVariant: fixture.requestedPlaceVariant,
    generatedPlaceVariant,
    completionTokenBudget: fixture.completionTokenBudget,
    modelIdentifier: expectedPhase7Model,
    accepted: observation.ok,
    httpStatus: observation.ok ? 200 : diagnostic?.httpStatus ?? null,
    outcomeClassification: classifyPhase7Outcome(
      fixture.id,
      resultOk,
      providerErrorClassification
    ),
    providerErrorClassification,
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

function appendPhase7DiagnosticRecord(
  reportPath: string,
  record: Phase7DiagnosticRecord
) {
  appendFileSync(reportPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    flag: "a",
  })
}

function readPhase7DiagnosticRecords(reportPath: string) {
  const lines = readFileSync(reportPath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)

  return lines.map((line, index) =>
    parsePhase7DiagnosticRecord(JSON.parse(line) as unknown, index + 1)
  )
}

function classifyPhase7Outcome(
  probe: Phase7ProbeId,
  resultOk: boolean,
  providerClassification: Phase7ProviderClassification | null
): Phase7OutcomeClassification {
  if (probe === "A") {
    if (resultOk) {
      return "GENERIC_ACTIVITY_ACCEPTED"
    }
    return providerClassification === "JSON_VALIDATE_FAILED"
      ? "GENERIC_ACTIVITY_JSON_FAILED"
      : "GENERIC_ACTIVITY_SUSPECT"
  }

  if (resultOk) {
    return "TRANSPORT_ACCEPTED"
  }
  return providerClassification === "JSON_VALIDATE_FAILED"
    ? "TRANSPORT_JSON_FAILED"
    : "TRANSPORT_SUSPECT"
}

function classifyPhase7ProviderError(
  observation: GroqStrictCapabilityProviderObservation,
  normalizedFailureCode: GroqFailureCode | null,
  httpStatus: number | undefined,
  providerCode: string | undefined
): Phase7ProviderClassification | null {
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

function parsePhase7DiagnosticRecord(value: unknown, lineNumber: number) {
  const record = asRecord(value)

  if (
    record === undefined ||
    record.runIdentifier !== phase7RunIdentifier ||
    (record.probe !== "A" && record.probe !== "B") ||
    typeof record.purpose !== "string" ||
    record.schemaFingerprint !== expectedPhase7SchemaFingerprint ||
    (record.requestedPlaceVariant !== "generic_activity" &&
      record.requestedPlaceVariant !== "transport") ||
    !isNullablePlaceVariant(record.generatedPlaceVariant) ||
    record.completionTokenBudget !== 512 ||
    record.modelIdentifier !== expectedPhase7Model ||
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
    throw new Error(`Invalid Phase-7 record on JSONL line ${lineNumber}.`)
  }

  return record as Phase7DiagnosticRecord
}

function getPlace(value: unknown) {
  const response = asRecord(value)
  return asRecord(response?.place)
}

function isNullablePlaceVariant(
  value: unknown
): value is Phase6PlaceVariant | null {
  return value === null ||
    value === "specific_place" ||
    value === "generic_activity" ||
    value === "transport"
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
  appendPhase7DiagnosticRecord,
  auditPhase7ProbeFixtures,
  createPhase7DiagnosticRecord,
  diffPhase7Requests,
  expectedPhase7Model,
  expectedPhase7SchemaFingerprint,
  genericActivityUserMessage,
  getNextPhase7Probe,
  getPhase7MessageDifferences,
  getPhase7OutgoingRequestSnapshot,
  getPhase7RequestSnapshot,
  phase7ProbeFixtures,
  phase7RunIdentifier,
  readPhase7DiagnosticRecords,
  transportUserMessage,
  validateGenericActivityResponse,
  validateTransportResponse,
  type Phase7DiagnosticRecord,
  type Phase7ProbeFixture,
  type Phase7ProbeId,
  type Phase7ProviderClassification,
}
