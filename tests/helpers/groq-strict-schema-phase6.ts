import { createHash } from "node:crypto"
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
  expectedPhase5Model,
  expectedPhase5PlaceSchemaFingerprint,
  getPhase5RequestSnapshot,
  phase5ProbeFixtures,
} from "@/tests/helpers/groq-strict-schema-phase5"

type Phase6ProbeId = "A" | "B"
type Phase6PlaceVariant =
  | "specific_place"
  | "generic_activity"
  | "transport"
type Phase6SchemaDiffClassification =
  | "NONE_SINGLE_BRANCH_CONTROL"
  | "PLACE_SCHEMA_TO_EXACT_THREE_VARIANT_ANYOF"
type Phase6OutcomeClassification =
  | "CONTROL_PASSED"
  | "CONTROL_FAILURE"
  | "FULL_PLACE_ANYOF_ACCEPTED"
  | "FULL_PLACE_ANYOF_JSON_FAILED"
  | "FULL_PLACE_ANYOF_SUSPECT"
type Phase6ProviderClassification =
  | "SCHEMA_REQUEST_REJECTED"
  | "JSON_VALIDATE_FAILED"
  | "NONCONFORMING_OUTPUT"
  | "OUTPUT_TRUNCATED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "CONFIGURATION_ERROR"
  | "UNKNOWN"

type Phase6ProbeFixture = {
  id: Phase6ProbeId
  purpose: string
  schemaDiffClassification: Phase6SchemaDiffClassification
  schema: Record<string, unknown>
  userMessage: string
  completionTokenBudget: 512
  requestedPlaceVariant: "specific_place"
  validateResponse: (value: unknown) => boolean
}

type Phase6DiagnosticRecord = {
  runIdentifier: "step4a2y-phase6-run-1"
  probe: Phase6ProbeId
  purpose: string
  schemaFingerprint: string
  schemaDiffClassification: Phase6SchemaDiffClassification
  requestedPlaceVariant: "specific_place"
  generatedPlaceVariant: Phase6PlaceVariant | null
  completionTokenBudget: 512
  modelIdentifier: "openai/gpt-oss-20b"
  accepted: boolean
  httpStatus: number | null
  outcomeClassification: Phase6OutcomeClassification
  providerErrorClassification: Phase6ProviderClassification | null
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

const phase6RunIdentifier = "step4a2y-phase6-run-1" as const
const expectedPhase6Model = expectedPhase5Model
const expectedPhase6SingleBranchFingerprint =
  expectedPhase5PlaceSchemaFingerprint
const expectedPhase6FullPlaceAnyOfFingerprint = "da1a8dda005763d4" as const
const completePlaceAnyOfSchema =
  groqFinalItineraryWireSchema.properties.itinerary.items.properties.activities
    .items.properties.place

const fullPlaceAnyOfResponseSchema = {
  ...phase5ProbeFixtures.C.schema,
  properties: {
    ...phase5ProbeFixtures.C.schema.properties,
    place: completePlaceAnyOfSchema,
  },
} as const

const alignedPlaceUserMessage = phase5ProbeFixtures.C.userMessage

if (alignedPlaceUserMessage === undefined) {
  throw new Error("The accepted aligned place message is unavailable.")
}

const phase6ProbeFixtures = {
  A: {
    id: "A",
    purpose: "Accepted Step 4A.2X specific_place control",
    schemaDiffClassification: "NONE_SINGLE_BRANCH_CONTROL",
    schema: phase5ProbeFixtures.C.schema,
    userMessage: alignedPlaceUserMessage,
    completionTokenBudget: 512,
    requestedPlaceVariant: "specific_place",
    validateResponse: phase5ProbeFixtures.C.validateResponse,
  },
  B: {
    id: "B",
    purpose: "Exact three-variant place anyOf",
    schemaDiffClassification:
      "PLACE_SCHEMA_TO_EXACT_THREE_VARIANT_ANYOF",
    schema: fullPlaceAnyOfResponseSchema,
    userMessage: alignedPlaceUserMessage,
    completionTokenBudget: 512,
    requestedPlaceVariant: "specific_place",
    validateResponse: validateFullPlaceAnyOfResponse,
  },
} as const satisfies Record<Phase6ProbeId, Phase6ProbeFixture>

function auditPhase6ProbeFixtures() {
  const problems: string[] = []

  if (
    JSON.stringify(phase6ProbeFixtures.A.schema) !==
      JSON.stringify(phase5ProbeFixtures.C.schema) ||
    phase6ProbeFixtures.A.userMessage !== phase5ProbeFixtures.C.userMessage ||
    phase6ProbeFixtures.A.completionTokenBudget !== 512
  ) {
    problems.push("Probe A must exactly preserve the accepted Phase-5 candidate.")
  }

  if (
    getPhase6SchemaFingerprint(phase6ProbeFixtures.A) !==
    expectedPhase6SingleBranchFingerprint
  ) {
    problems.push("Probe A fingerprint must remain locked to Step 4A.2X.")
  }

  if (
    getPhase6SchemaFingerprint(phase6ProbeFixtures.B) !==
    expectedPhase6FullPlaceAnyOfFingerprint
  ) {
    problems.push("Probe B fingerprint must remain locked to the exact union.")
  }

  const candidatePlace = getRootPlaceSchema(phase6ProbeFixtures.B.schema)

  if (
    JSON.stringify(candidatePlace) !== JSON.stringify(completePlaceAnyOfSchema)
  ) {
    problems.push("Probe B place must equal the production wire place anyOf.")
  }

  if (!Array.isArray(completePlaceAnyOfSchema.anyOf) ||
    completePlaceAnyOfSchema.anyOf.length !== 3) {
    problems.push("The production place schema must contain exactly three branches.")
  }

  const expectedKinds: Phase6PlaceVariant[] = [
    "specific_place",
    "generic_activity",
    "transport",
  ]
  const expectedRequired = [
    "kind",
    "name",
    "addressHint",
    "areaHint",
    "originHint",
    "destinationHint",
  ]

  completePlaceAnyOfSchema.anyOf.forEach((branch, index) => {
    if (branch.type !== "object" || branch.additionalProperties !== false) {
      problems.push(`Place branch ${index} must remain a closed object.`)
    }
    if (JSON.stringify(branch.required) !== JSON.stringify(expectedRequired)) {
      problems.push(`Place branch ${index} must retain every required property.`)
    }
    if (
      JSON.stringify(branch.properties.kind.enum) !==
      JSON.stringify([expectedKinds[index]])
    ) {
      problems.push(`Place branch ${index} discriminator must remain unchanged.`)
    }
    const expectedNameType = index === 0 ? "string" : "null"
    if (branch.properties.name.type !== expectedNameType) {
      problems.push(`Place branch ${index} name type must remain unchanged.`)
    }
    for (const key of [
      "addressHint",
      "areaHint",
      "originHint",
      "destinationHint",
    ] as const) {
      if (
        JSON.stringify(branch.properties[key].type) !==
        JSON.stringify(["string", "null"])
      ) {
        problems.push(`Place branch ${index} ${key} must remain nullable.`)
      }
    }
  })

  const candidateWithControlPlace = replaceRootPlaceSchema(
    phase6ProbeFixtures.B.schema,
    getRootPlaceSchema(phase6ProbeFixtures.A.schema)
  )
  if (
    JSON.stringify(candidateWithControlPlace) !==
    JSON.stringify(phase6ProbeFixtures.A.schema)
  ) {
    problems.push("Probe B may differ from Probe A only at properties.place.")
  }

  if (
    phase6ProbeFixtures.A.userMessage !== phase6ProbeFixtures.B.userMessage ||
    phase6ProbeFixtures.A.completionTokenBudget !==
      phase6ProbeFixtures.B.completionTokenBudget
  ) {
    problems.push("Probe messages and completion budgets must remain identical.")
  }

  return problems
}

function getPhase6RequestSnapshot(fixture: Phase6ProbeFixture) {
  const baseline = getPhase5RequestSnapshot(phase5ProbeFixtures.C)

  return {
    ...baseline,
    schema: fixture.schema,
  } satisfies StrictControlRequestSnapshot
}

function getPhase6OutgoingRequestSnapshot(fixture: Phase6ProbeFixture) {
  const request = getPhase6RequestSnapshot(fixture)

  return {
    model: expectedPhase6Model,
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

function diffPhase6Requests() {
  const control = getPhase6RequestSnapshot(phase6ProbeFixtures.A)
  const candidate = getPhase6RequestSnapshot(phase6ProbeFixtures.B)
  const keys = Object.keys(control) as (keyof StrictControlRequestSnapshot)[]

  return keys.filter(
    (key) => JSON.stringify(control[key]) !== JSON.stringify(candidate[key])
  )
}

function getPhase6SchemaFingerprint(fixture: Phase6ProbeFixture) {
  return createHash("sha256")
    .update(JSON.stringify(fixture.schema))
    .digest("hex")
    .slice(0, 16)
}

function getNextPhase6Probe(
  probe: Phase6ProbeId,
  succeeded: boolean
): Phase6ProbeId | null {
  return probe === "A" && succeeded ? "B" : null
}

function validateFullPlaceAnyOfResponse(value: unknown) {
  const response = asRecord(value)

  if (
    response === undefined ||
    !hasExactKeys(response, ["ok", "message", "place"]) ||
    response.ok !== true ||
    (response.message !== "Confirmed" && response.message !== null)
  ) {
    return false
  }

  return validateCompletePlace(response.place)
}

function validateCompletePlace(value: unknown) {
  const place = asRecord(value)

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
    !isNullableString(place.addressHint) ||
    !isNullableString(place.areaHint) ||
    !isNullableString(place.originHint) ||
    !isNullableString(place.destinationHint)
  ) {
    return false
  }

  if (place.kind === "specific_place") {
    return typeof place.name === "string"
  }

  return (place.kind === "generic_activity" || place.kind === "transport") &&
    place.name === null
}

function getGeneratedPlaceVariant(value: unknown): Phase6PlaceVariant | null {
  const response = asRecord(value)
  const place = asRecord(response?.place)

  return place?.kind === "specific_place" ||
    place?.kind === "generic_activity" ||
    place?.kind === "transport"
    ? place.kind
    : null
}

function createPhase6DiagnosticRecord({
  fixture,
  observation,
  normalizedFailureCode,
  resultOk,
  generatedPlaceVariant,
  configuredSecret,
}: {
  fixture: Phase6ProbeFixture
  observation: GroqStrictCapabilityProviderObservation
  normalizedFailureCode: GroqFailureCode | null
  resultOk: boolean
  generatedPlaceVariant: Phase6PlaceVariant | null
  configuredSecret?: string
}): Phase6DiagnosticRecord {
  const diagnostic = observation.ok
    ? undefined
    : sanitizeGroqSchemaProbeError(observation.error, configuredSecret)
  const rateLimit = observation.ok
    ? getSafeStrictControlRateLimit(undefined)
    : getSafeStrictControlRateLimit(getErrorHeaders(observation.error))
  const usage = observation.ok ? observation.usage : undefined
  const providerErrorClassification = classifyPhase6ProviderError(
    observation,
    normalizedFailureCode,
    diagnostic?.httpStatus,
    diagnostic?.errorCode
  )

  return {
    runIdentifier: phase6RunIdentifier,
    probe: fixture.id,
    purpose: fixture.purpose,
    schemaFingerprint: getPhase6SchemaFingerprint(fixture),
    schemaDiffClassification: fixture.schemaDiffClassification,
    requestedPlaceVariant: fixture.requestedPlaceVariant,
    generatedPlaceVariant,
    completionTokenBudget: fixture.completionTokenBudget,
    modelIdentifier: expectedPhase6Model,
    accepted: observation.ok,
    httpStatus: observation.ok ? 200 : diagnostic?.httpStatus ?? null,
    outcomeClassification: classifyPhase6Outcome(
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

function appendPhase6DiagnosticRecord(
  reportPath: string,
  record: Phase6DiagnosticRecord
) {
  appendFileSync(reportPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    flag: "a",
  })
}

function readPhase6DiagnosticRecords(reportPath: string) {
  const lines = readFileSync(reportPath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)

  return lines.map((line, index) =>
    parsePhase6DiagnosticRecord(JSON.parse(line) as unknown, index + 1)
  )
}

function classifyPhase6Outcome(
  probe: Phase6ProbeId,
  resultOk: boolean,
  providerClassification: Phase6ProviderClassification | null
): Phase6OutcomeClassification {
  if (probe === "A") {
    return resultOk ? "CONTROL_PASSED" : "CONTROL_FAILURE"
  }
  if (resultOk) {
    return "FULL_PLACE_ANYOF_ACCEPTED"
  }
  return providerClassification === "JSON_VALIDATE_FAILED"
    ? "FULL_PLACE_ANYOF_JSON_FAILED"
    : "FULL_PLACE_ANYOF_SUSPECT"
}

function classifyPhase6ProviderError(
  observation: GroqStrictCapabilityProviderObservation,
  normalizedFailureCode: GroqFailureCode | null,
  httpStatus: number | undefined,
  providerCode: string | undefined
): Phase6ProviderClassification | null {
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

function parsePhase6DiagnosticRecord(value: unknown, lineNumber: number) {
  const record = asRecord(value)

  if (
    record === undefined ||
    record.runIdentifier !== phase6RunIdentifier ||
    (record.probe !== "A" && record.probe !== "B") ||
    typeof record.purpose !== "string" ||
    typeof record.schemaFingerprint !== "string" ||
    (record.schemaDiffClassification !== "NONE_SINGLE_BRANCH_CONTROL" &&
      record.schemaDiffClassification !==
        "PLACE_SCHEMA_TO_EXACT_THREE_VARIANT_ANYOF") ||
    record.requestedPlaceVariant !== "specific_place" ||
    !isNullablePlaceVariant(record.generatedPlaceVariant) ||
    record.completionTokenBudget !== 512 ||
    record.modelIdentifier !== expectedPhase6Model ||
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
    throw new Error(`Invalid Phase-6 record on JSONL line ${lineNumber}.`)
  }

  return record as Phase6DiagnosticRecord
}

function getRootPlaceSchema(schema: Record<string, unknown>) {
  const properties = asRecord(schema.properties)

  if (properties === undefined || !("place" in properties)) {
    throw new Error("The probe root place schema is unavailable.")
  }

  return properties.place
}

function replaceRootPlaceSchema(
  schema: Record<string, unknown>,
  place: unknown
) {
  const properties = asRecord(schema.properties)

  if (properties === undefined) {
    throw new Error("The probe root properties are unavailable.")
  }

  return {
    ...schema,
    properties: {
      ...properties,
      place,
    },
  }
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  return JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...keys].sort())
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
  appendPhase6DiagnosticRecord,
  auditPhase6ProbeFixtures,
  completePlaceAnyOfSchema,
  createPhase6DiagnosticRecord,
  diffPhase6Requests,
  expectedPhase6Model,
  expectedPhase6FullPlaceAnyOfFingerprint,
  expectedPhase6SingleBranchFingerprint,
  fullPlaceAnyOfResponseSchema,
  getGeneratedPlaceVariant,
  getNextPhase6Probe,
  getPhase6OutgoingRequestSnapshot,
  getPhase6RequestSnapshot,
  getPhase6SchemaFingerprint,
  phase6ProbeFixtures,
  phase6RunIdentifier,
  readPhase6DiagnosticRecords,
  validateCompletePlace,
  validateFullPlaceAnyOfResponse,
  type Phase6DiagnosticRecord,
  type Phase6PlaceVariant,
  type Phase6ProbeFixture,
  type Phase6ProbeId,
  type Phase6ProviderClassification,
}
