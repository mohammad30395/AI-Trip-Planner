import { appendFileSync, readFileSync, writeFileSync } from "node:fs"

import { groqFinalItineraryWireSchema } from "@/lib/ai/groq-final-schema"
import {
  GROQ_FINAL_ITINERARY_TIMEOUT_MS,
  type GroqFinalProviderErrorCategory,
  type GroqFinalProviderErrorMetadata,
} from "@/lib/ai/groq"
import {
  buildGroqFinalMessages,
  expectedOneDayModel,
  getOneDayTokenBudgetAnalysis,
  inspectValidatedItinerary,
  oneDayExperimentalCompletionBudget,
  oneDayRequirements,
} from "@/tests/helpers/groq-final-one-day"

type FinalResult = Awaited<
  ReturnType<typeof import("@/lib/ai/groq").runGroqFinalItinerary>
>

type RepeatabilityAttemptNumber = 1 | 2 | 3

type RepeatabilityOutcome =
  | "FULL_PIPELINE_SUCCESS"
  | "APPLICATION_VALIDATION_FAILED"
  | GroqFinalProviderErrorCategory

type GroqFinalRepeatabilityRecord = {
  runIdentifier: "step4a3b-one-day-repeatability-run-1"
  attemptNumber: RepeatabilityAttemptNumber
  modelIdentifier: "openai/gpt-oss-20b"
  schemaName: "groq_final_itinerary_wire_response"
  strict: true
  temperature: 0.4
  completionTokenBudget: 3500
  timeoutMs: 90000
  retryCount: 0
  requestedDurationDays: 1
  providerRequestCount: 1
  httpStatus: number | null
  providerErrorType: string | null
  providerErrorCode: string | null
  providerErrorParameter: string | null
  schemaPath: string | null
  outcome: RepeatabilityOutcome
  failedGenerationPresent: boolean
  generationExhaustionIndicated: boolean
  unsupportedSchemaStructureIndicated: boolean
  finishReason: string | null
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  latencyMs: number
  rateLimit: {
    limitTokensPerMinute: number | null
    remainingTokens: number | null
    resetTokensSeconds: number | null
  }
  wireSchemaValid: boolean | null
  normalizationValid: boolean | null
  applicationSchemaValid: boolean | null
  sequentialDaysValid: boolean | null
  durationValid: boolean | null
  actualDayCount: number | null
  storageTransformationCompatible: boolean | null
  fullPipelineSuccess: boolean
}

type RepeatabilityContinuation =
  | { continue: true; waitMs: 75_000 }
  | {
      continue: false
      reason:
        | "ATTEMPT_LIMIT_REACHED"
        | "AUTHENTICATION_OR_CONFIGURATION_FAILURE"
        | "PROVIDER_RATE_LIMITED"
        | "SCHEMA_REQUEST_REJECTED"
        | "PROVIDER_UNAVAILABLE"
        | "UNKNOWN_PROVIDER_FAILURE"
        | "APPLICATION_VALIDATION_FAILED"
        | "RATE_LIMIT_CAPACITY_INSUFFICIENT"
        | "RATE_LIMIT_METADATA_UNCERTAIN"
    }

const groqFinalRepeatabilityRunIdentifier =
  "step4a3b-one-day-repeatability-run-1" as const
const groqFinalRepeatabilityMaximumAttempts = 3 as const
const groqFinalRepeatabilityWaitMs = 75_000 as const

function getRepeatabilityRequestInput() {
  return {
    messages: buildGroqFinalMessages(oneDayRequirements),
    durationDays: 1,
    maxCompletionTokens: oneDayExperimentalCompletionBudget,
  } as const
}

function getRepeatabilityOutgoingRequestSnapshot(
  model: string = expectedOneDayModel
) {
  return {
    model,
    messages: buildGroqFinalMessages(oneDayRequirements),
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "groq_final_itinerary_wire_response",
        strict: true,
        schema: groqFinalItineraryWireSchema,
      },
    },
    temperature: 0.4,
    max_completion_tokens: oneDayExperimentalCompletionBudget,
  } as const
}

function createGroqFinalRepeatabilityRecord({
  attemptNumber,
  result,
  providerError,
  latencyMs,
  providerRequestCount,
}: {
  attemptNumber: RepeatabilityAttemptNumber
  result: FinalResult
  providerError?: GroqFinalProviderErrorMetadata
  latencyMs: number
  providerRequestCount: number
}): GroqFinalRepeatabilityRecord {
  if (providerRequestCount !== 1) {
    throw new Error("Each repeatability attempt must make exactly one request.")
  }

  const diagnostic = result.ok ? result.data.diagnostic : result.diagnostic
  const successDiagnostic = result.ok ? result.data.diagnostic : undefined
  const rateLimit = result.ok ? result.data.rateLimit : diagnostic?.rateLimit
  const inspection = result.ok
    ? inspectValidatedItinerary(result.data.response)
    : undefined
  const sequentialDaysValid = result.ok
    ? result.data.response.itinerary.every(
        (day, index) => day.dayNumber === index + 1
      )
    : null
  const fullPipelineSuccess =
    result.ok &&
    successDiagnostic?.jsonParsed === true &&
    successDiagnostic.wireNormalized === true &&
    successDiagnostic.runtimeValidated === true &&
    successDiagnostic.durationValidated === true &&
    sequentialDaysValid === true &&
    inspection?.actualDayCount === 1 &&
    inspection.storageTransformationCompatible === true

  return {
    runIdentifier: groqFinalRepeatabilityRunIdentifier,
    attemptNumber,
    modelIdentifier: expectedOneDayModel,
    schemaName: "groq_final_itinerary_wire_response",
    strict: true,
    temperature: 0.4,
    completionTokenBudget: oneDayExperimentalCompletionBudget,
    timeoutMs: GROQ_FINAL_ITINERARY_TIMEOUT_MS,
    retryCount: 0,
    requestedDurationDays: 1,
    providerRequestCount: 1,
    httpStatus: result.ok ? 200 : providerError?.httpStatus ?? null,
    providerErrorType: providerError?.providerErrorType ?? null,
    providerErrorCode: providerError?.providerErrorCode ?? null,
    providerErrorParameter: providerError?.providerErrorParameter ?? null,
    schemaPath: providerError?.schemaPath ?? null,
    outcome: fullPipelineSuccess
      ? "FULL_PIPELINE_SUCCESS"
      : result.ok
        ? "APPLICATION_VALIDATION_FAILED"
        : providerError?.category ?? "UNKNOWN",
    failedGenerationPresent:
      providerError?.failedGenerationPresent ?? false,
    generationExhaustionIndicated:
      providerError?.generationExhaustionIndicated ?? false,
    unsupportedSchemaStructureIndicated:
      providerError?.unsupportedSchemaStructureIndicated ?? false,
    finishReason: diagnostic?.finishReason ?? null,
    inputTokens: result.ok ? result.data.usage?.inputTokens ?? null : null,
    outputTokens: result.ok ? result.data.usage?.outputTokens ?? null : null,
    totalTokens: result.ok ? result.data.usage?.totalTokens ?? null : null,
    latencyMs: Math.max(0, Math.round(latencyMs)),
    rateLimit: {
      limitTokensPerMinute: rateLimit?.limitTokensPerMinute ?? null,
      remainingTokens: rateLimit?.remainingTokens ?? null,
      resetTokensSeconds: rateLimit?.resetTokensSeconds ?? null,
    },
    wireSchemaValid: result.ok ? true : null,
    normalizationValid: result.ok
      ? successDiagnostic?.wireNormalized ?? null
      : null,
    applicationSchemaValid: result.ok
      ? successDiagnostic?.runtimeValidated ?? null
      : null,
    sequentialDaysValid,
    durationValid: result.ok
      ? successDiagnostic?.durationValidated ?? null
      : null,
    actualDayCount: inspection?.actualDayCount ?? null,
    storageTransformationCompatible:
      inspection?.storageTransformationCompatible ?? null,
    fullPipelineSuccess,
  }
}

function getRepeatabilityContinuation(
  record: GroqFinalRepeatabilityRecord
): RepeatabilityContinuation {
  if (record.attemptNumber >= groqFinalRepeatabilityMaximumAttempts) {
    return { continue: false, reason: "ATTEMPT_LIMIT_REACHED" }
  }

  switch (record.outcome) {
    case "CONFIGURATION_ERROR":
      return {
        continue: false,
        reason: "AUTHENTICATION_OR_CONFIGURATION_FAILURE",
      }
    case "PROVIDER_RATE_LIMITED":
      return { continue: false, reason: "PROVIDER_RATE_LIMITED" }
    case "SCHEMA_REQUEST_REJECTED":
      return { continue: false, reason: "SCHEMA_REQUEST_REJECTED" }
    case "PROVIDER_UNAVAILABLE":
      return { continue: false, reason: "PROVIDER_UNAVAILABLE" }
    case "UNKNOWN":
      return { continue: false, reason: "UNKNOWN_PROVIDER_FAILURE" }
    case "APPLICATION_VALIDATION_FAILED":
      return { continue: false, reason: "APPLICATION_VALIDATION_FAILED" }
  }

  const requiredTokens =
    getOneDayTokenBudgetAnalysis().estimatedInputTokens +
    oneDayExperimentalCompletionBudget
  const { limitTokensPerMinute, remainingTokens, resetTokensSeconds } =
    record.rateLimit

  if (
    limitTokensPerMinute === null ||
    remainingTokens === null ||
    resetTokensSeconds === null
  ) {
    return { continue: false, reason: "RATE_LIMIT_METADATA_UNCERTAIN" }
  }

  if (
    limitTokensPerMinute < requiredTokens ||
    remainingTokens < requiredTokens
  ) {
    return { continue: false, reason: "RATE_LIMIT_CAPACITY_INSUFFICIENT" }
  }

  return { continue: true, waitMs: groqFinalRepeatabilityWaitMs }
}

function writeGroqFinalRepeatabilityRecord(
  reportPath: string,
  record: GroqFinalRepeatabilityRecord,
  expectedExistingRecords: number
) {
  if (expectedExistingRecords === 0) {
    writeFileSync(reportPath, `${JSON.stringify(record)}\n`, {
      encoding: "utf8",
      flag: "wx",
    })
    return
  }

  const existingRecords = readGroqFinalRepeatabilityRecords(reportPath)
  if (existingRecords.length !== expectedExistingRecords) {
    throw new Error("Repeatability report count does not match request count.")
  }

  appendFileSync(reportPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
  })
}

function readGroqFinalRepeatabilityRecords(reportPath: string) {
  return readFileSync(reportPath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line, index) =>
      parseGroqFinalRepeatabilityRecord(JSON.parse(line) as unknown, index + 1)
    )
}

function parseGroqFinalRepeatabilityRecord(value: unknown, lineNumber: number) {
  const record = asObject(value)
  if (
    record === undefined ||
    record.runIdentifier !== groqFinalRepeatabilityRunIdentifier ||
    !isAttemptNumber(record.attemptNumber) ||
    record.modelIdentifier !== expectedOneDayModel ||
    record.schemaName !== "groq_final_itinerary_wire_response" ||
    record.strict !== true ||
    record.temperature !== 0.4 ||
    record.completionTokenBudget !== oneDayExperimentalCompletionBudget ||
    record.timeoutMs !== GROQ_FINAL_ITINERARY_TIMEOUT_MS ||
    record.retryCount !== 0 ||
    record.requestedDurationDays !== 1 ||
    record.providerRequestCount !== 1 ||
    !isNullableNumber(record.httpStatus) ||
    !isNullableString(record.providerErrorType) ||
    !isNullableString(record.providerErrorCode) ||
    !isNullableString(record.providerErrorParameter) ||
    !isNullableString(record.schemaPath) ||
    !isOutcome(record.outcome) ||
    typeof record.failedGenerationPresent !== "boolean" ||
    typeof record.generationExhaustionIndicated !== "boolean" ||
    typeof record.unsupportedSchemaStructureIndicated !== "boolean" ||
    !isNullableString(record.finishReason) ||
    !isNullableNumber(record.inputTokens) ||
    !isNullableNumber(record.outputTokens) ||
    !isNullableNumber(record.totalTokens) ||
    !isNonNegativeNumber(record.latencyMs) ||
    !isRateLimit(record.rateLimit) ||
    !isNullableBoolean(record.wireSchemaValid) ||
    !isNullableBoolean(record.normalizationValid) ||
    !isNullableBoolean(record.applicationSchemaValid) ||
    !isNullableBoolean(record.sequentialDaysValid) ||
    !isNullableBoolean(record.durationValid) ||
    !isNullableNumber(record.actualDayCount) ||
    !isNullableBoolean(record.storageTransformationCompatible) ||
    typeof record.fullPipelineSuccess !== "boolean"
  ) {
    throw new Error(`Invalid repeatability record on line ${lineNumber}.`)
  }

  return record as GroqFinalRepeatabilityRecord
}

function isAttemptNumber(value: unknown): value is RepeatabilityAttemptNumber {
  return value === 1 || value === 2 || value === 3
}

function isOutcome(value: unknown): value is RepeatabilityOutcome {
  return (
    value === "FULL_PIPELINE_SUCCESS" ||
    value === "APPLICATION_VALIDATION_FAILED" ||
    value === "SCHEMA_REQUEST_REJECTED" ||
    value === "JSON_GENERATION_VALIDATION_FAILED" ||
    value === "COMPLETION_EXHAUSTION_INDICATED" ||
    value === "CONFIGURATION_ERROR" ||
    value === "PROVIDER_RATE_LIMITED" ||
    value === "PROVIDER_UNAVAILABLE" ||
    value === "UNKNOWN"
  )
}

function isRateLimit(value: unknown) {
  const record = asObject(value)
  return (
    record !== undefined &&
    isNullableNumber(record.limitTokensPerMinute) &&
    isNullableNumber(record.remainingTokens) &&
    isNullableNumber(record.resetTokensSeconds)
  )
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string"
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === "boolean"
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNonNegativeNumber(value)
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

export {
  createGroqFinalRepeatabilityRecord,
  getRepeatabilityContinuation,
  getRepeatabilityOutgoingRequestSnapshot,
  getRepeatabilityRequestInput,
  groqFinalRepeatabilityMaximumAttempts,
  groqFinalRepeatabilityRunIdentifier,
  readGroqFinalRepeatabilityRecords,
  writeGroqFinalRepeatabilityRecord,
  type GroqFinalRepeatabilityRecord,
  type RepeatabilityAttemptNumber,
}
