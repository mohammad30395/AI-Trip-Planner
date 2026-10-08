import { appendFileSync, readFileSync, writeFileSync } from "node:fs"

import type { GroqFinalProviderErrorMetadata } from "@/lib/ai/groq"
import {
  createGroqFinalDurationScreeningRecord,
  getDurationBudgetPlan,
  getDurationScreeningContinuation,
  getDurationScreeningOutgoingRequestSnapshot,
  getDurationScreeningRequestInput,
  type GroqFinalDurationScreeningRecord,
  type ScreeningDuration,
} from "@/tests/helpers/groq-final-duration-screening"

type FinalResult = Awaited<
  ReturnType<typeof import("@/lib/ai/groq").runGroqFinalItinerary>
>

type TargetedAttemptNumber = 1 | 2 | 3 | 4 | 5

type GroqFinalTargetedRepeatabilityRecord = Omit<
  GroqFinalDurationScreeningRecord,
  "runIdentifier" | "attemptNumber"
> & {
  runIdentifier: "step4a4b-targeted-repeatability-run-1"
  attemptNumber: TargetedAttemptNumber
}

const groqFinalTargetedRepeatabilityRunIdentifier =
  "step4a4b-targeted-repeatability-run-1" as const
const targetedRepeatabilityDurations = [4, 3, 4, 3, 1] as const
const groqFinalTargetedRepeatabilityMaximumRequests = 5 as const

function getTargetedRepeatabilityDuration(
  attemptNumber: TargetedAttemptNumber
): ScreeningDuration {
  return targetedRepeatabilityDurations[attemptNumber - 1]
}

function getTargetedRepeatabilityRequestInput(
  attemptNumber: TargetedAttemptNumber
) {
  return getDurationScreeningRequestInput(
    getTargetedRepeatabilityDuration(attemptNumber)
  )
}

function getTargetedRepeatabilityOutgoingRequestSnapshot(
  attemptNumber: TargetedAttemptNumber
) {
  return getDurationScreeningOutgoingRequestSnapshot(
    getTargetedRepeatabilityDuration(attemptNumber)
  )
}

function createGroqFinalTargetedRepeatabilityRecord({
  attemptNumber,
  result,
  providerError,
  latencyMs,
  providerRequestCount,
}: {
  attemptNumber: TargetedAttemptNumber
  result: FinalResult
  providerError?: GroqFinalProviderErrorMetadata
  latencyMs: number
  providerRequestCount: number
}): GroqFinalTargetedRepeatabilityRecord {
  const requestedDurationDays =
    getTargetedRepeatabilityDuration(attemptNumber)
  const baseRecord = createGroqFinalDurationScreeningRecord({
    attemptNumber,
    requestedDurationDays,
    result,
    providerError,
    latencyMs,
    providerRequestCount,
  })

  return {
    ...baseRecord,
    runIdentifier: groqFinalTargetedRepeatabilityRunIdentifier,
  }
}

function getTargetedRepeatabilityContinuation(
  record: GroqFinalTargetedRepeatabilityRecord
) {
  const nextDuration = targetedRepeatabilityDurations.at(record.attemptNumber)
  return getDurationScreeningContinuation(
    record,
    nextDuration === undefined
      ? undefined
      : getDurationBudgetPlan(nextDuration)
  )
}

function writeGroqFinalTargetedRepeatabilityRecord(
  reportPath: string,
  record: GroqFinalTargetedRepeatabilityRecord,
  expectedExistingRecords: number
) {
  if (expectedExistingRecords === 0) {
    writeFileSync(reportPath, `${JSON.stringify(record)}\n`, {
      encoding: "utf8",
      flag: "wx",
    })
    return
  }

  const existingRecords = readGroqFinalTargetedRepeatabilityRecords(reportPath)
  if (existingRecords.length !== expectedExistingRecords) {
    throw new Error("Targeted report count does not match provider-call count.")
  }

  appendFileSync(reportPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
  })
}

function readGroqFinalTargetedRepeatabilityRecords(reportPath: string) {
  return readFileSync(reportPath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line, index) =>
      parseGroqFinalTargetedRepeatabilityRecord(
        JSON.parse(line) as unknown,
        index + 1
      )
    )
}

function parseGroqFinalTargetedRepeatabilityRecord(
  value: unknown,
  lineNumber: number
) {
  const record = asObject(value)
  if (
    record === undefined ||
    record.runIdentifier !== groqFinalTargetedRepeatabilityRunIdentifier ||
    !isAttemptNumber(record.attemptNumber) ||
    !isScreeningDuration(record.requestedDurationDays) ||
    record.requestedDurationDays !==
      getTargetedRepeatabilityDuration(record.attemptNumber) ||
    record.modelIdentifier !== "openai/gpt-oss-20b" ||
    record.schemaName !== "groq_final_itinerary_wire_response" ||
    record.strict !== true ||
    record.temperature !== 0.4 ||
    record.timeoutMs !== 90_000 ||
    record.retryCount !== 0 ||
    record.providerRequestCount !== 1 ||
    !isNullableNumber(record.httpStatus) ||
    !isNullableString(record.providerErrorType) ||
    !isNullableString(record.providerErrorCode) ||
    !isNullableString(record.providerErrorParameter) ||
    !isNullableString(record.schemaPath) ||
    !isOutcome(record.outcome) ||
    typeof record.failedGenerationPresent !== "boolean" ||
    typeof record.completionExhaustionIndicated !== "boolean" ||
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
    !isNullableBoolean(record.validDayActivityStructures) ||
    !isNullableBoolean(record.durationValid) ||
    !isNullableNumber(record.actualDayCount) ||
    !isNullableBoolean(record.storageTransformationCompatible) ||
    !isNullableBoolean(record.reasonablyCoherent) ||
    typeof record.fullPipelineSuccess !== "boolean"
  ) {
    throw new Error(`Invalid targeted record on line ${lineNumber}.`)
  }

  const plan = getDurationBudgetPlan(record.requestedDurationDays)
  if (
    record.selectedCompletionBudget !== plan.selectedCompletionBudget ||
    record.defaultCompletionBudget !== plan.defaultCompletionBudget ||
    record.estimatedInputTokens !== plan.estimatedInputTokens ||
    record.estimatedMaximumRequestTokens !==
      plan.estimatedMaximumRequestTokens ||
    record.estimatedTpmMargin !== plan.estimatedTpmMargin
  ) {
    throw new Error(`Invalid targeted budget on line ${lineNumber}.`)
  }

  return record as GroqFinalTargetedRepeatabilityRecord
}

function isAttemptNumber(value: unknown): value is TargetedAttemptNumber {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
}

function isScreeningDuration(value: unknown): value is ScreeningDuration {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
}

function isOutcome(
  value: unknown
): value is GroqFinalTargetedRepeatabilityRecord["outcome"] {
  return (
    value === "FULL_PIPELINE_SUCCESS" ||
    value === "JSON_GENERATION_VALIDATION_FAILED" ||
    value === "COMPLETION_EXHAUSTION_INDICATED" ||
    value === "SCHEMA_REQUEST_REJECTED" ||
    value === "CONFIGURATION_ERROR" ||
    value === "PROVIDER_RATE_LIMITED" ||
    value === "PROVIDER_UNAVAILABLE" ||
    value === "PROVIDER_TIMEOUT" ||
    value === "OUTPUT_TRUNCATED" ||
    value === "INVALID_JSON" ||
    value === "DURATION_MISMATCH" ||
    value === "APPLICATION_VALIDATION_FAILED" ||
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
  createGroqFinalTargetedRepeatabilityRecord,
  getTargetedRepeatabilityContinuation,
  getTargetedRepeatabilityDuration,
  getTargetedRepeatabilityOutgoingRequestSnapshot,
  getTargetedRepeatabilityRequestInput,
  groqFinalTargetedRepeatabilityMaximumRequests,
  groqFinalTargetedRepeatabilityRunIdentifier,
  readGroqFinalTargetedRepeatabilityRecords,
  targetedRepeatabilityDurations,
  writeGroqFinalTargetedRepeatabilityRecord,
  type GroqFinalTargetedRepeatabilityRecord,
  type TargetedAttemptNumber,
}
