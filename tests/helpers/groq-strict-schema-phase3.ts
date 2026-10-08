import { appendFileSync, readFileSync } from "node:fs"

import { groqFinalItineraryWireSchema } from "@/lib/ai/groq-final-schema"
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
  expectedPhase2Model,
  getPhase2RequestSnapshot,
  phase2ProbeFixtures,
  validateNullableEnumResponse,
} from "@/tests/helpers/groq-strict-schema-phase2"

type Phase3ProbeId = "A" | "B"

type Phase3OutcomeClassification =
  | "NULLABLE_ENUM_CONTROL_PASSED"
  | "CONTROL_FAILURE"
  | "MINIMAL_PLACE_OBJECT_ACCEPTED"
  | "MINIMAL_PLACE_OBJECT_SUSPECT"

type Phase3ProviderClassification =
  | "SCHEMA_REQUEST_REJECTED"
  | "JSON_VALIDATE_FAILED"
  | "NONCONFORMING_OUTPUT"
  | "OUTPUT_TRUNCATED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "CONFIGURATION_ERROR"
  | "UNKNOWN"

type Phase3ProbeFixture = {
  id: Phase3ProbeId
  purpose: string
  schemaDifference: string
  schema: Record<string, unknown>
  validateResponse: (value: unknown) => boolean
}

type Phase3DiagnosticRecord = {
  probe: Phase3ProbeId
  purpose: string
  requestConfigurationIdentifier: "step4a2u-locked-request"
  schemaDifference: string
  modelIdentifier: "openai/gpt-oss-20b"
  accepted: boolean
  httpStatus: number | null
  outcomeClassification: Phase3OutcomeClassification
  providerErrorClassification: Phase3ProviderClassification | null
  providerErrorType: string | null
  errorCode: string | null
  finishReason: string | null
  parsedOutputValid: boolean | null
  schemaValidationPassed: boolean | null
  discriminatorValidationPassed: boolean | null
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  tokenLimit: number | null
  remainingTokens: number | null
  resetSeconds: number | null
  failedGenerationSummary: FailedGenerationSummary
  retryCount: 0
}

const phase3RequestConfigurationIdentifier =
  "step4a2u-locked-request" as const
const expectedPhase3Model = expectedPhase2Model
const specificPlaceWirePath =
  "itinerary.items.properties.activities.items.properties.place.anyOf[0]" as const

const actualSpecificPlaceSchema =
  groqFinalItineraryWireSchema.properties.itinerary.items.properties.activities
    .items.properties.place.anyOf[0]

const minimalPlaceObjectSchema = {
  ...phase2ProbeFixtures.B.schema,
  properties: {
    ...phase2ProbeFixtures.B.schema.properties,
    place: actualSpecificPlaceSchema,
  },
  required: [...phase2ProbeFixtures.B.schema.required, "place"],
} as const

const phase3ProbeFixtures = {
  A: {
    id: "A",
    purpose: "Known-good Step 4A.2U nullable-enum control",
    schemaDifference: "NONE",
    schema: phase2ProbeFixtures.B.schema,
    validateResponse: validateNullableEnumResponse,
  },
  B: {
    id: "B",
    purpose: "Minimal discriminated specific_place object",
    schemaDifference:
      "add required top-level place using exact specific_place wire branch",
    schema: minimalPlaceObjectSchema,
    validateResponse: validateMinimalPlaceResponse,
  },
} as const satisfies Record<Phase3ProbeId, Phase3ProbeFixture>

function auditPhase3ProbeFixture(fixture: Phase3ProbeFixture) {
  const problems: string[] = []
  const schema = asRecord(fixture.schema)
  const properties = asRecord(schema?.properties)

  if (fixture.id === "A") {
    if (JSON.stringify(fixture.schema) !== JSON.stringify(phase2ProbeFixtures.B.schema)) {
      problems.push("Control must equal the Step 4A.2U nullable-enum fixture.")
    }

    return problems
  }

  if (schema?.type !== "object" || schema.additionalProperties !== false) {
    problems.push("Root must remain a closed object.")
  }

  if (
    !Array.isArray(schema?.required) ||
    JSON.stringify(schema.required) !==
      JSON.stringify(["ok", "message", "place"])
  ) {
    problems.push("Root must require ok, message, and place.")
  }

  if (
    JSON.stringify(properties?.ok) !==
      JSON.stringify(phase2ProbeFixtures.B.schema.properties.ok) ||
    JSON.stringify(properties?.message) !==
      JSON.stringify(phase2ProbeFixtures.B.schema.properties.message)
  ) {
    problems.push("Existing control properties must remain unchanged.")
  }

  const place = asRecord(properties?.place)
  const placeProperties = asRecord(place?.properties)
  const required = readStringArray(place?.required)
  const propertyNames =
    placeProperties === undefined ? [] : Object.keys(placeProperties)

  if (
    JSON.stringify(properties?.place) !==
    JSON.stringify(actualSpecificPlaceSchema)
  ) {
    problems.push("place must equal the current specific_place wire branch.")
  }

  if (place?.type !== "object" || place.additionalProperties !== false) {
    problems.push("place must be a closed object.")
  }

  if (
    required === undefined ||
    JSON.stringify([...required].sort()) !==
      JSON.stringify([...propertyNames].sort())
  ) {
    problems.push("Every place property must be required.")
  }

  if (
    JSON.stringify(asRecord(placeProperties?.kind)?.enum) !==
      JSON.stringify(["specific_place"])
  ) {
    problems.push("kind must use the specific_place discriminator enum.")
  }

  if (asRecord(placeProperties?.name)?.type !== "string") {
    problems.push("specific_place name must be a string.")
  }

  for (const key of [
    "addressHint",
    "areaHint",
    "originHint",
    "destinationHint",
  ]) {
    if (
      JSON.stringify(asRecord(placeProperties?.[key])?.type) !==
      JSON.stringify(["string", "null"])
    ) {
      problems.push(`${key} must remain a nullable string.`)
    }
  }

  if ("anyOf" in (place ?? {})) {
    problems.push("The isolated specific_place branch must not contain anyOf.")
  }

  return problems
}

function getPhase3RequestSnapshot(fixture: Phase3ProbeFixture) {
  return {
    ...getPhase2RequestSnapshot(phase2ProbeFixtures.B),
    schema: fixture.schema,
  } satisfies StrictControlRequestSnapshot
}

function diffPhase3Requests() {
  const control = getPhase3RequestSnapshot(phase3ProbeFixtures.A)
  const candidate = getPhase3RequestSnapshot(phase3ProbeFixtures.B)
  const keys = Object.keys(control) as (keyof StrictControlRequestSnapshot)[]

  return keys.filter(
    (key) => JSON.stringify(control[key]) !== JSON.stringify(candidate[key])
  )
}

function diffPhase3Schemas() {
  return collectSchemaDifferences(
    phase3ProbeFixtures.A.schema,
    phase3ProbeFixtures.B.schema
  ).sort()
}

function getNextPhase3Probe(
  probe: Phase3ProbeId,
  succeeded: boolean
): Phase3ProbeId | null {
  return probe === "A" && succeeded ? "B" : null
}

function validateMinimalPlaceResponse(value: unknown) {
  const response = asRecord(value)

  if (
    response === undefined ||
    Object.keys(response).length !== 3 ||
    response.ok !== true ||
    (response.message !== "Confirmed" && response.message !== null)
  ) {
    return false
  }

  const place = asRecord(response.place)

  if (
    place === undefined ||
    !hasExactKeys(place, [
      "kind",
      "name",
      "addressHint",
      "areaHint",
      "originHint",
      "destinationHint",
    ]) ||
    place.kind !== "specific_place" ||
    typeof place.name !== "string"
  ) {
    return false
  }

  return [
    place.addressHint,
    place.areaHint,
    place.originHint,
    place.destinationHint,
  ].every(isNullableString)
}

function createPhase3DiagnosticRecord({
  fixture,
  observation,
  normalizedFailureCode,
  resultOk,
  configuredSecret,
}: {
  fixture: Phase3ProbeFixture
  observation: GroqStrictCapabilityProviderObservation
  normalizedFailureCode: GroqFailureCode | null
  resultOk: boolean
  configuredSecret?: string
}): Phase3DiagnosticRecord {
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
    requestConfigurationIdentifier: phase3RequestConfigurationIdentifier,
    schemaDifference: fixture.schemaDifference,
    modelIdentifier: expectedPhase3Model,
    accepted: observation.ok,
    httpStatus: observation.ok ? 200 : diagnostic?.httpStatus ?? null,
    outcomeClassification: classifyPhase3Outcome(fixture.id, resultOk),
    providerErrorClassification: classifyPhase3ProviderError(
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
    discriminatorValidationPassed:
      fixture.id === "B" && resultOk ? true : null,
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

function appendPhase3DiagnosticRecord(
  reportPath: string,
  record: Phase3DiagnosticRecord
) {
  appendFileSync(reportPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    flag: "a",
  })
}

function readPhase3DiagnosticRecords(reportPath: string) {
  const lines = readFileSync(reportPath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)

  return lines.map((line, index) =>
    parsePhase3DiagnosticRecord(JSON.parse(line) as unknown, index + 1)
  )
}

function classifyPhase3Outcome(
  probe: Phase3ProbeId,
  resultOk: boolean
): Phase3OutcomeClassification {
  if (probe === "A") {
    return resultOk ? "NULLABLE_ENUM_CONTROL_PASSED" : "CONTROL_FAILURE"
  }

  return resultOk
    ? "MINIMAL_PLACE_OBJECT_ACCEPTED"
    : "MINIMAL_PLACE_OBJECT_SUSPECT"
}

function classifyPhase3ProviderError(
  observation: GroqStrictCapabilityProviderObservation,
  normalizedFailureCode: GroqFailureCode | null,
  httpStatus: number | undefined,
  providerCode: string | undefined
): Phase3ProviderClassification | null {
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

function parsePhase3DiagnosticRecord(value: unknown, lineNumber: number) {
  const record = asRecord(value)

  if (
    record === undefined ||
    (record.probe !== "A" && record.probe !== "B") ||
    typeof record.purpose !== "string" ||
    record.requestConfigurationIdentifier !==
      phase3RequestConfigurationIdentifier ||
    typeof record.schemaDifference !== "string" ||
    record.modelIdentifier !== expectedPhase3Model ||
    typeof record.accepted !== "boolean" ||
    !isNullableNumber(record.httpStatus) ||
    typeof record.outcomeClassification !== "string" ||
    !isNullableString(record.providerErrorClassification) ||
    !isNullableString(record.providerErrorType) ||
    !isNullableString(record.errorCode) ||
    !isNullableString(record.finishReason) ||
    !isNullableBoolean(record.parsedOutputValid) ||
    !isNullableBoolean(record.schemaValidationPassed) ||
    !isNullableBoolean(record.discriminatorValidationPassed) ||
    !isNullableNumber(record.inputTokens) ||
    !isNullableNumber(record.outputTokens) ||
    !isNullableNumber(record.totalTokens) ||
    !isNullableNumber(record.tokenLimit) ||
    !isNullableNumber(record.remainingTokens) ||
    !isNullableNumber(record.resetSeconds) ||
    asRecord(record.failedGenerationSummary) === undefined ||
    record.retryCount !== 0
  ) {
    throw new Error(`Invalid Phase-3 record on JSONL line ${lineNumber}.`)
  }

  return record as Phase3DiagnosticRecord
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return JSON.stringify(actual) === JSON.stringify(expected)
}

function readStringArray(value: unknown) {
  return Array.isArray(value) &&
    value.every((item) => typeof item === "string")
    ? value
    : undefined
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
  actualSpecificPlaceSchema,
  appendPhase3DiagnosticRecord,
  auditPhase3ProbeFixture,
  createPhase3DiagnosticRecord,
  diffPhase3Requests,
  diffPhase3Schemas,
  expectedPhase3Model,
  getNextPhase3Probe,
  getPhase3RequestSnapshot,
  phase3ProbeFixtures,
  phase3RequestConfigurationIdentifier,
  readPhase3DiagnosticRecords,
  specificPlaceWirePath,
  validateMinimalPlaceResponse,
  type Phase3DiagnosticRecord,
  type Phase3OutcomeClassification,
  type Phase3ProbeFixture,
  type Phase3ProbeId,
  type Phase3ProviderClassification,
}
