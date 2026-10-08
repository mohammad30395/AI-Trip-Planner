import { createHash } from "node:crypto"
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
  expectedPhase3Model,
  getPhase3RequestSnapshot,
  phase3ProbeFixtures,
} from "@/tests/helpers/groq-strict-schema-phase3"

type Phase4ProbeId = "A" | "B" | "C"
type Phase4PromptVariant = "historical" | "aligned"

type Phase4OutcomeClassification =
  | "CONTROL_PASSED"
  | "CONTROL_FAILURE"
  | "HISTORICAL_PLACE_ACCEPTED"
  | "HISTORICAL_PLACE_JSON_FAILED"
  | "HISTORICAL_PLACE_SUSPECT"
  | "ALIGNED_PLACE_ACCEPTED"
  | "ALIGNED_PLACE_SUSPECT"

type Phase4ProviderClassification =
  | "SCHEMA_REQUEST_REJECTED"
  | "JSON_VALIDATE_FAILED"
  | "NONCONFORMING_OUTPUT"
  | "OUTPUT_TRUNCATED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "CONFIGURATION_ERROR"
  | "UNKNOWN"

type Phase4ProbeFixture = {
  id: Phase4ProbeId
  purpose: string
  promptVariant: Phase4PromptVariant
  schema: Record<string, unknown>
  userMessage?: string
  validateResponse: (value: unknown) => boolean
}

type Phase4DiagnosticRecord = {
  runIdentifier: "step4a2w-phase4-run-1"
  probe: Phase4ProbeId
  purpose: string
  promptVariant: Phase4PromptVariant
  schemaFingerprint: string
  modelIdentifier: "openai/gpt-oss-20b"
  accepted: boolean
  httpStatus: number | null
  outcomeClassification: Phase4OutcomeClassification
  providerErrorClassification: Phase4ProviderClassification | null
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

const phase4RunIdentifier = "step4a2w-phase4-run-1" as const
const expectedPhase4Model = expectedPhase3Model

const historicalRequestSnapshot = getPhase3RequestSnapshot(
  phase3ProbeFixtures.A
)
const historicalSystemMessage = historicalRequestSnapshot.messages[0]?.content
const historicalUserMessage = historicalRequestSnapshot.messages[1]?.content

if (
  historicalSystemMessage === undefined ||
  historicalUserMessage === undefined
) {
  throw new Error("Historical strict-control messages are unavailable.")
}

const alignedPlaceUserMessage =
  'Return a valid confirmation with ok set to true, message set to "Confirmed", and a place object representing one fictional test location. Set kind to "specific_place", name to "Test Place", and addressHint, areaHint, originHint, and destinationHint to null. Include every schema-required field and no extra fields.'

const phase4ProbeFixtures = {
  A: {
    id: "A",
    purpose: "Known-good nullable-enum control",
    promptVariant: "historical",
    schema: phase3ProbeFixtures.A.schema,
    userMessage: undefined,
    validateResponse: phase3ProbeFixtures.A.validateResponse,
  },
  B: {
    id: "B",
    purpose: "Minimal place schema with historical prompt",
    promptVariant: "historical",
    schema: phase3ProbeFixtures.B.schema,
    userMessage: undefined,
    validateResponse: phase3ProbeFixtures.B.validateResponse,
  },
  C: {
    id: "C",
    purpose: "Minimal place schema with aligned synthetic prompt",
    promptVariant: "aligned",
    schema: phase3ProbeFixtures.B.schema,
    userMessage: alignedPlaceUserMessage,
    validateResponse: phase3ProbeFixtures.B.validateResponse,
  },
} as const satisfies Record<Phase4ProbeId, Phase4ProbeFixture>

function auditPhase4ProbeFixtures() {
  const problems: string[] = []

  if (
    JSON.stringify(phase4ProbeFixtures.A.schema) !==
    JSON.stringify(phase3ProbeFixtures.A.schema)
  ) {
    problems.push("Probe A must preserve the Phase-3 control schema.")
  }

  if (
    JSON.stringify(phase4ProbeFixtures.B.schema) !==
      JSON.stringify(phase3ProbeFixtures.B.schema) ||
    JSON.stringify(phase4ProbeFixtures.C.schema) !==
      JSON.stringify(phase3ProbeFixtures.B.schema)
  ) {
    problems.push("Probes B and C must preserve the Phase-3 place schema.")
  }

  if (
    JSON.stringify(phase4ProbeFixtures.B.schema) !==
    JSON.stringify(phase4ProbeFixtures.C.schema)
  ) {
    problems.push("Probes B and C must have byte-equivalent schemas.")
  }

  if (phase4ProbeFixtures.C.userMessage !== alignedPlaceUserMessage) {
    problems.push("Probe C must use the aligned synthetic user message.")
  }

  return problems
}

function getPhase4RequestSnapshot(fixture: Phase4ProbeFixture) {
  const phase3Fixture = fixture.id === "A"
    ? phase3ProbeFixtures.A
    : phase3ProbeFixtures.B
  const snapshot = getPhase3RequestSnapshot(phase3Fixture)

  return {
    ...snapshot,
    messages: [
      { role: "system", content: historicalSystemMessage },
      {
        role: "user",
        content: fixture.userMessage ?? historicalUserMessage,
      },
    ],
  } satisfies StrictControlRequestSnapshot
}

function diffPhase4Requests(
  left: Phase4ProbeFixture,
  right: Phase4ProbeFixture
) {
  const leftSnapshot = getPhase4RequestSnapshot(left)
  const rightSnapshot = getPhase4RequestSnapshot(right)
  const keys = Object.keys(leftSnapshot) as (keyof StrictControlRequestSnapshot)[]

  return keys.filter(
    (key) =>
      JSON.stringify(leftSnapshot[key]) !== JSON.stringify(rightSnapshot[key])
  )
}

function getPhase4MessageDifferences() {
  const historical = getPhase4RequestSnapshot(phase4ProbeFixtures.B).messages
  const aligned = getPhase4RequestSnapshot(phase4ProbeFixtures.C).messages
  const differences: string[] = []

  for (let index = 0; index < Math.max(historical.length, aligned.length); index += 1) {
    if (historical[index]?.role !== aligned[index]?.role) {
      differences.push(`messages[${index}].role`)
    }
    if (historical[index]?.content !== aligned[index]?.content) {
      differences.push(`messages[${index}].content`)
    }
  }

  return differences
}

function getNextPhase4Probe(
  probe: Phase4ProbeId,
  succeeded: boolean,
  providerClassification: Phase4ProviderClassification | null
): Phase4ProbeId | null {
  if (probe === "A") {
    return succeeded ? "B" : null
  }

  if (probe === "C") {
    return null
  }

  if (succeeded) {
    return "C"
  }

  return providerClassification === "JSON_VALIDATE_FAILED" ||
    providerClassification === "NONCONFORMING_OUTPUT" ||
    providerClassification === "OUTPUT_TRUNCATED"
    ? "C"
    : null
}

function getPhase4SchemaFingerprint(fixture: Phase4ProbeFixture) {
  return createHash("sha256")
    .update(JSON.stringify(fixture.schema))
    .digest("hex")
    .slice(0, 16)
}

function createPhase4DiagnosticRecord({
  fixture,
  observation,
  normalizedFailureCode,
  resultOk,
  configuredSecret,
}: {
  fixture: Phase4ProbeFixture
  observation: GroqStrictCapabilityProviderObservation
  normalizedFailureCode: GroqFailureCode | null
  resultOk: boolean
  configuredSecret?: string
}): Phase4DiagnosticRecord {
  const diagnostic = observation.ok
    ? undefined
    : sanitizeGroqSchemaProbeError(observation.error, configuredSecret)
  const rateLimit = observation.ok
    ? getSafeStrictControlRateLimit(undefined)
    : getSafeStrictControlRateLimit(getErrorHeaders(observation.error))
  const usage = observation.ok ? observation.usage : undefined
  const providerErrorClassification = classifyPhase4ProviderError(
    observation,
    normalizedFailureCode,
    diagnostic?.httpStatus,
    diagnostic?.errorCode
  )

  return {
    runIdentifier: phase4RunIdentifier,
    probe: fixture.id,
    purpose: fixture.purpose,
    promptVariant: fixture.promptVariant,
    schemaFingerprint: getPhase4SchemaFingerprint(fixture),
    modelIdentifier: expectedPhase4Model,
    accepted: observation.ok,
    httpStatus: observation.ok ? 200 : diagnostic?.httpStatus ?? null,
    outcomeClassification: classifyPhase4Outcome(
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

function appendPhase4DiagnosticRecord(
  reportPath: string,
  record: Phase4DiagnosticRecord
) {
  appendFileSync(reportPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    flag: "a",
  })
}

function readPhase4DiagnosticRecords(reportPath: string) {
  const lines = readFileSync(reportPath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)

  return lines.map((line, index) =>
    parsePhase4DiagnosticRecord(JSON.parse(line) as unknown, index + 1)
  )
}

function classifyPhase4Outcome(
  probe: Phase4ProbeId,
  resultOk: boolean,
  providerClassification: Phase4ProviderClassification | null
): Phase4OutcomeClassification {
  if (probe === "A") {
    return resultOk ? "CONTROL_PASSED" : "CONTROL_FAILURE"
  }
  if (probe === "B") {
    if (resultOk) {
      return "HISTORICAL_PLACE_ACCEPTED"
    }
    return providerClassification === "JSON_VALIDATE_FAILED"
      ? "HISTORICAL_PLACE_JSON_FAILED"
      : "HISTORICAL_PLACE_SUSPECT"
  }

  return resultOk ? "ALIGNED_PLACE_ACCEPTED" : "ALIGNED_PLACE_SUSPECT"
}

function classifyPhase4ProviderError(
  observation: GroqStrictCapabilityProviderObservation,
  normalizedFailureCode: GroqFailureCode | null,
  httpStatus: number | undefined,
  providerCode: string | undefined
): Phase4ProviderClassification | null {
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

function parsePhase4DiagnosticRecord(value: unknown, lineNumber: number) {
  const record = asRecord(value)

  if (
    record === undefined ||
    record.runIdentifier !== phase4RunIdentifier ||
    (record.probe !== "A" && record.probe !== "B" && record.probe !== "C") ||
    typeof record.purpose !== "string" ||
    (record.promptVariant !== "historical" &&
      record.promptVariant !== "aligned") ||
    typeof record.schemaFingerprint !== "string" ||
    record.modelIdentifier !== expectedPhase4Model ||
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
    throw new Error(`Invalid Phase-4 record on JSONL line ${lineNumber}.`)
  }

  return record as Phase4DiagnosticRecord
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
  alignedPlaceUserMessage,
  appendPhase4DiagnosticRecord,
  auditPhase4ProbeFixtures,
  createPhase4DiagnosticRecord,
  diffPhase4Requests,
  expectedPhase4Model,
  getNextPhase4Probe,
  getPhase4MessageDifferences,
  getPhase4RequestSnapshot,
  getPhase4SchemaFingerprint,
  historicalSystemMessage,
  historicalUserMessage,
  phase4ProbeFixtures,
  phase4RunIdentifier,
  readPhase4DiagnosticRecords,
  type Phase4DiagnosticRecord,
  type Phase4OutcomeClassification,
  type Phase4ProbeFixture,
  type Phase4ProbeId,
  type Phase4PromptVariant,
  type Phase4ProviderClassification,
}
