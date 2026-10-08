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
  expectedPhase4Model,
  getPhase4RequestSnapshot,
  phase4ProbeFixtures,
} from "@/tests/helpers/groq-strict-schema-phase4"

type Phase5ProbeId = "A" | "B" | "C"
type Phase5PromptVariant = "historical-control" | "aligned-place"
type Phase5CompletionTokenBudget = 256 | 512

type Phase5OutcomeClassification =
  | "CONTROL_PASSED"
  | "CONTROL_FAILURE"
  | "ALIGNED_256_ACCEPTED"
  | "ALIGNED_256_JSON_FAILED"
  | "ALIGNED_256_SUSPECT"
  | "ALIGNED_512_ACCEPTED"
  | "ALIGNED_512_JSON_FAILED"
  | "ALIGNED_512_SUSPECT"

type Phase5ProviderClassification =
  | "SCHEMA_REQUEST_REJECTED"
  | "JSON_VALIDATE_FAILED"
  | "NONCONFORMING_OUTPUT"
  | "OUTPUT_TRUNCATED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "CONFIGURATION_ERROR"
  | "UNKNOWN"

type Phase5ProbeFixture = {
  id: Phase5ProbeId
  purpose: string
  promptVariant: Phase5PromptVariant
  completionTokenBudget: Phase5CompletionTokenBudget
  schema: Record<string, unknown>
  userMessage?: string
  validateResponse: (value: unknown) => boolean
}

type Phase5DiagnosticRecord = {
  runIdentifier: "step4a2x-phase5-run-1"
  probe: Phase5ProbeId
  purpose: string
  promptVariant: Phase5PromptVariant
  schemaFingerprint: string
  completionTokenBudget: Phase5CompletionTokenBudget
  modelIdentifier: "openai/gpt-oss-20b"
  accepted: boolean
  httpStatus: number | null
  outcomeClassification: Phase5OutcomeClassification
  providerErrorClassification: Phase5ProviderClassification | null
  providerErrorType: string | null
  errorCode: string | null
  finishReason: string | null
  parsedOutputValid: boolean | null
  schemaValidationPassed: boolean | null
  discriminatorValidationPassed: boolean | null
  requiredFieldsComplete: boolean | null
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  tokenLimit: number | null
  remainingTokens: number | null
  resetSeconds: number | null
  failedGenerationSummary: FailedGenerationSummary
  retryCount: 0
}

const phase5RunIdentifier = "step4a2x-phase5-run-1" as const
const expectedPhase5Model = expectedPhase4Model
const expectedPhase5PlaceSchemaFingerprint = "1f4a13a193a75838" as const

const phase5ProbeFixtures = {
  A: {
    id: "A",
    purpose: "Known-good Step 4A.2W nullable-enum control",
    promptVariant: "historical-control",
    completionTokenBudget: 256,
    schema: phase4ProbeFixtures.A.schema,
    userMessage: undefined,
    validateResponse: phase4ProbeFixtures.A.validateResponse,
  },
  B: {
    id: "B",
    purpose: "Aligned minimal place at 256 completion tokens",
    promptVariant: "aligned-place",
    completionTokenBudget: 256,
    schema: phase4ProbeFixtures.C.schema,
    userMessage: phase4ProbeFixtures.C.userMessage,
    validateResponse: phase4ProbeFixtures.C.validateResponse,
  },
  C: {
    id: "C",
    purpose: "Aligned minimal place at 512 completion tokens",
    promptVariant: "aligned-place",
    completionTokenBudget: 512,
    schema: phase4ProbeFixtures.C.schema,
    userMessage: phase4ProbeFixtures.C.userMessage,
    validateResponse: phase4ProbeFixtures.C.validateResponse,
  },
} as const satisfies Record<Phase5ProbeId, Phase5ProbeFixture>

function auditPhase5ProbeFixtures() {
  const problems: string[] = []

  if (
    JSON.stringify(phase5ProbeFixtures.A.schema) !==
      JSON.stringify(phase4ProbeFixtures.A.schema) ||
    phase5ProbeFixtures.A.userMessage !== undefined ||
    phase5ProbeFixtures.A.completionTokenBudget !== 256
  ) {
    problems.push("Probe A must exactly preserve the Phase-4 control.")
  }

  if (
    JSON.stringify(phase5ProbeFixtures.B.schema) !==
      JSON.stringify(phase4ProbeFixtures.C.schema) ||
    phase5ProbeFixtures.B.userMessage !== phase4ProbeFixtures.C.userMessage ||
    phase5ProbeFixtures.B.completionTokenBudget !== 256
  ) {
    problems.push("Probe B must exactly preserve the Phase-4 aligned request.")
  }

  if (
    JSON.stringify(phase5ProbeFixtures.B.schema) !==
      JSON.stringify(phase5ProbeFixtures.C.schema) ||
    phase5ProbeFixtures.B.userMessage !== phase5ProbeFixtures.C.userMessage
  ) {
    problems.push("Probes B and C must preserve identical schemas and prompts.")
  }

  if (phase5ProbeFixtures.C.completionTokenBudget !== 512) {
    problems.push("Probe C must use a 512-token completion budget.")
  }

  if (
    getPhase5SchemaFingerprint(phase5ProbeFixtures.B) !==
      expectedPhase5PlaceSchemaFingerprint ||
    getPhase5SchemaFingerprint(phase5ProbeFixtures.C) !==
      expectedPhase5PlaceSchemaFingerprint
  ) {
    problems.push("The aligned place schema fingerprint must remain locked.")
  }

  return problems
}

function getPhase5RequestSnapshot(fixture: Phase5ProbeFixture) {
  const phase4Fixture = fixture.id === "A"
    ? phase4ProbeFixtures.A
    : phase4ProbeFixtures.C
  const phase4Snapshot = getPhase4RequestSnapshot(phase4Fixture)
  const historicalSystemMessage = phase4Snapshot.messages[0]?.content
  const historicalUserMessage = phase4Snapshot.messages[1]?.content

  if (
    historicalSystemMessage === undefined ||
    historicalUserMessage === undefined
  ) {
    throw new Error("The strict-control messages are unavailable.")
  }

  return {
    ...phase4Snapshot,
    messages: [
      { role: "system", content: historicalSystemMessage },
      {
        role: "user",
        content: fixture.userMessage ?? historicalUserMessage,
      },
    ],
    schema: fixture.schema,
    maxCompletionTokens: fixture.completionTokenBudget,
  } satisfies StrictControlRequestSnapshot
}

function diffPhase5Requests(
  left: Phase5ProbeFixture,
  right: Phase5ProbeFixture
) {
  const leftSnapshot = getPhase5RequestSnapshot(left)
  const rightSnapshot = getPhase5RequestSnapshot(right)
  const keys = Object.keys(leftSnapshot) as (keyof StrictControlRequestSnapshot)[]

  return keys.filter(
    (key) =>
      JSON.stringify(leftSnapshot[key]) !== JSON.stringify(rightSnapshot[key])
  )
}

function getNextPhase5Probe(
  probe: Phase5ProbeId,
  succeeded: boolean,
  providerClassification: Phase5ProviderClassification | null
): Phase5ProbeId | null {
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

function getPhase5SchemaFingerprint(fixture: Phase5ProbeFixture) {
  return createHash("sha256")
    .update(JSON.stringify(fixture.schema))
    .digest("hex")
    .slice(0, 16)
}

function createPhase5DiagnosticRecord({
  fixture,
  observation,
  normalizedFailureCode,
  resultOk,
  configuredSecret,
}: {
  fixture: Phase5ProbeFixture
  observation: GroqStrictCapabilityProviderObservation
  normalizedFailureCode: GroqFailureCode | null
  resultOk: boolean
  configuredSecret?: string
}): Phase5DiagnosticRecord {
  const diagnostic = observation.ok
    ? undefined
    : sanitizeGroqSchemaProbeError(observation.error, configuredSecret)
  const rateLimit = observation.ok
    ? getSafeStrictControlRateLimit(undefined)
    : getSafeStrictControlRateLimit(getErrorHeaders(observation.error))
  const usage = observation.ok ? observation.usage : undefined
  const providerErrorClassification = classifyPhase5ProviderError(
    observation,
    normalizedFailureCode,
    diagnostic?.httpStatus,
    diagnostic?.errorCode
  )
  const candidateValidationPassed = fixture.id !== "A" && resultOk

  return {
    runIdentifier: phase5RunIdentifier,
    probe: fixture.id,
    purpose: fixture.purpose,
    promptVariant: fixture.promptVariant,
    schemaFingerprint: getPhase5SchemaFingerprint(fixture),
    completionTokenBudget: fixture.completionTokenBudget,
    modelIdentifier: expectedPhase5Model,
    accepted: observation.ok,
    httpStatus: observation.ok ? 200 : diagnostic?.httpStatus ?? null,
    outcomeClassification: classifyPhase5Outcome(
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
    discriminatorValidationPassed: candidateValidationPassed ? true : null,
    requiredFieldsComplete: candidateValidationPassed ? true : null,
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

function appendPhase5DiagnosticRecord(
  reportPath: string,
  record: Phase5DiagnosticRecord
) {
  appendFileSync(reportPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    flag: "a",
  })
}

function readPhase5DiagnosticRecords(reportPath: string) {
  const lines = readFileSync(reportPath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)

  return lines.map((line, index) =>
    parsePhase5DiagnosticRecord(JSON.parse(line) as unknown, index + 1)
  )
}

function classifyPhase5Outcome(
  probe: Phase5ProbeId,
  resultOk: boolean,
  providerClassification: Phase5ProviderClassification | null
): Phase5OutcomeClassification {
  if (probe === "A") {
    return resultOk ? "CONTROL_PASSED" : "CONTROL_FAILURE"
  }

  if (probe === "B") {
    if (resultOk) {
      return "ALIGNED_256_ACCEPTED"
    }
    return providerClassification === "JSON_VALIDATE_FAILED"
      ? "ALIGNED_256_JSON_FAILED"
      : "ALIGNED_256_SUSPECT"
  }

  if (resultOk) {
    return "ALIGNED_512_ACCEPTED"
  }
  return providerClassification === "JSON_VALIDATE_FAILED"
    ? "ALIGNED_512_JSON_FAILED"
    : "ALIGNED_512_SUSPECT"
}

function classifyPhase5ProviderError(
  observation: GroqStrictCapabilityProviderObservation,
  normalizedFailureCode: GroqFailureCode | null,
  httpStatus: number | undefined,
  providerCode: string | undefined
): Phase5ProviderClassification | null {
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

function parsePhase5DiagnosticRecord(value: unknown, lineNumber: number) {
  const record = asRecord(value)

  if (
    record === undefined ||
    record.runIdentifier !== phase5RunIdentifier ||
    (record.probe !== "A" && record.probe !== "B" && record.probe !== "C") ||
    typeof record.purpose !== "string" ||
    (record.promptVariant !== "historical-control" &&
      record.promptVariant !== "aligned-place") ||
    typeof record.schemaFingerprint !== "string" ||
    (record.completionTokenBudget !== 256 &&
      record.completionTokenBudget !== 512) ||
    record.modelIdentifier !== expectedPhase5Model ||
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
    !isNullableBoolean(record.requiredFieldsComplete) ||
    !isNullableNumber(record.inputTokens) ||
    !isNullableNumber(record.outputTokens) ||
    !isNullableNumber(record.totalTokens) ||
    !isNullableNumber(record.tokenLimit) ||
    !isNullableNumber(record.remainingTokens) ||
    !isNullableNumber(record.resetSeconds) ||
    asRecord(record.failedGenerationSummary) === undefined ||
    record.retryCount !== 0
  ) {
    throw new Error(`Invalid Phase-5 record on JSONL line ${lineNumber}.`)
  }

  return record as Phase5DiagnosticRecord
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
  appendPhase5DiagnosticRecord,
  auditPhase5ProbeFixtures,
  createPhase5DiagnosticRecord,
  diffPhase5Requests,
  expectedPhase5Model,
  expectedPhase5PlaceSchemaFingerprint,
  getNextPhase5Probe,
  getPhase5RequestSnapshot,
  getPhase5SchemaFingerprint,
  phase5ProbeFixtures,
  phase5RunIdentifier,
  readPhase5DiagnosticRecords,
  type Phase5DiagnosticRecord,
  type Phase5OutcomeClassification,
  type Phase5ProbeFixture,
  type Phase5ProbeId,
  type Phase5PromptVariant,
  type Phase5ProviderClassification,
}
