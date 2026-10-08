import { appendFileSync, readFileSync, writeFileSync } from "node:fs"

import type { FinalItineraryResponse } from "@/lib/ai/contract"
import { groqFinalItineraryWireSchema } from "@/lib/ai/groq-final-schema"
import {
  GROQ_FINAL_ITINERARY_TIMEOUT_MS,
  getGroqFinalMaxCompletionTokens,
  type GroqFinalProviderErrorMetadata,
} from "@/lib/ai/groq"
import type { FinalItineraryRequirements } from "@/lib/ai/itinerary"
import { toStoredFinalItineraryPayload } from "@/lib/ai/itinerary-storage"
import {
  buildGroqFinalMessages,
  completeOneDayWireFixture,
  expectedOneDayModel,
  forbiddenProviderFields,
  oneDayRequirements,
} from "@/tests/helpers/groq-final-one-day"

type FinalResult = Awaited<
  ReturnType<typeof import("@/lib/ai/groq").runGroqFinalItinerary>
>

type ScreeningDuration = 1 | 2 | 3 | 4 | 5
type ScreeningAttemptNumber = 1 | 2 | 3 | 4 | 5

type DurationBudgetPlan = {
  durationDays: ScreeningDuration
  defaultCompletionBudget: number
  selectedCompletionBudget: number
  estimatedInputTokens: number
  estimatedMaximumRequestTokens: number
  estimatedTpmMargin: number
  representativeOutputEstimatedTokens: number
}

type DurationScreeningOutcome =
  | "FULL_PIPELINE_SUCCESS"
  | "JSON_GENERATION_VALIDATION_FAILED"
  | "COMPLETION_EXHAUSTION_INDICATED"
  | "SCHEMA_REQUEST_REJECTED"
  | "CONFIGURATION_ERROR"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "OUTPUT_TRUNCATED"
  | "INVALID_JSON"
  | "DURATION_MISMATCH"
  | "APPLICATION_VALIDATION_FAILED"
  | "UNKNOWN"

type GroqFinalDurationScreeningRecord = {
  runIdentifier: "step4a4a-duration-screening-run-1"
  attemptNumber: ScreeningAttemptNumber
  requestedDurationDays: ScreeningDuration
  modelIdentifier: "openai/gpt-oss-20b"
  schemaName: "groq_final_itinerary_wire_response"
  strict: true
  temperature: 0.4
  selectedCompletionBudget: number
  defaultCompletionBudget: number
  estimatedInputTokens: number
  estimatedMaximumRequestTokens: number
  estimatedTpmMargin: number
  timeoutMs: 90000
  retryCount: 0
  providerRequestCount: 1
  httpStatus: number | null
  providerErrorType: string | null
  providerErrorCode: string | null
  providerErrorParameter: string | null
  schemaPath: string | null
  outcome: DurationScreeningOutcome
  failedGenerationPresent: boolean
  completionExhaustionIndicated: boolean
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
  validDayActivityStructures: boolean | null
  durationValid: boolean | null
  actualDayCount: number | null
  storageTransformationCompatible: boolean | null
  reasonablyCoherent: boolean | null
  fullPipelineSuccess: boolean
}

type DurationScreeningContinuation =
  | { continue: true; waitMs: number }
  | {
      continue: false
      reason:
        | "ATTEMPT_LIMIT_REACHED"
        | "AUTHENTICATION_OR_CONFIGURATION_FAILURE"
        | "PROVIDER_RATE_LIMITED"
        | "SCHEMA_REQUEST_REJECTED"
        | "PROVIDER_UNAVAILABLE"
        | "PROVIDER_TIMEOUT"
        | "COMPLETION_CAPACITY_REACHED"
        | "UNKNOWN_PROVIDER_FAILURE"
        | "RATE_LIMIT_CAPACITY_INSUFFICIENT"
        | "RATE_LIMIT_METADATA_UNCERTAIN"
    }

const groqFinalDurationScreeningRunIdentifier =
  "step4a4a-duration-screening-run-1" as const
const screeningDurations = [1, 2, 3, 5] as const
const groqFinalDurationScreeningMaximumRequests = 4 as const
const evidencedFreePlanTokensPerMinute = 8_000 as const
const minimumTpmMargin = 800 as const
const minimumSpacingMs = 75_000 as const
const baselineExperimentalCompletionBudget = 3_500 as const
const additionalDayCompletionAllowance = 550 as const

function getDurationRequirements(
  durationDays: ScreeningDuration
): FinalItineraryRequirements {
  return { ...oneDayRequirements, durationDays }
}

function getDurationBudgetPlan(
  durationDays: ScreeningDuration
): DurationBudgetPlan {
  const requirements = getDurationRequirements(durationDays)
  const promptBytes = buildGroqFinalMessages(requirements).reduce(
    (total, message) => total + Buffer.byteLength(message.content, "utf8"),
    0
  )
  const schemaBytes = Buffer.byteLength(
    JSON.stringify(groqFinalItineraryWireSchema),
    "utf8"
  )
  const representativeOutputBytes = Buffer.byteLength(
    JSON.stringify(buildRepresentativeWireFixture(durationDays)),
    "utf8"
  )
  const estimatedInputTokens = estimateTokens(promptBytes + schemaBytes) + 200
  const selectedCompletionBudget =
    baselineExperimentalCompletionBudget +
    (durationDays - 1) * additionalDayCompletionAllowance

  return {
    durationDays,
    defaultCompletionBudget: getGroqFinalMaxCompletionTokens(durationDays),
    selectedCompletionBudget,
    estimatedInputTokens,
    estimatedMaximumRequestTokens:
      estimatedInputTokens + selectedCompletionBudget,
    estimatedTpmMargin:
      evidencedFreePlanTokensPerMinute -
      estimatedInputTokens -
      selectedCompletionBudget,
    representativeOutputEstimatedTokens: estimateTokens(
      representativeOutputBytes
    ),
  }
}

function getDurationScreeningRequestInput(durationDays: ScreeningDuration) {
  const plan = getDurationBudgetPlan(durationDays)
  return {
    messages: buildGroqFinalMessages(getDurationRequirements(durationDays)),
    durationDays,
    maxCompletionTokens: plan.selectedCompletionBudget,
  } as const
}

function getDurationScreeningOutgoingRequestSnapshot(
  durationDays: ScreeningDuration,
  model: string = expectedOneDayModel
) {
  const plan = getDurationBudgetPlan(durationDays)
  return {
    model,
    messages: buildGroqFinalMessages(getDurationRequirements(durationDays)),
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "groq_final_itinerary_wire_response",
        strict: true,
        schema: groqFinalItineraryWireSchema,
      },
    },
    temperature: 0.4,
    max_completion_tokens: plan.selectedCompletionBudget,
  } as const
}

function buildRepresentativeWireFixture(durationDays: ScreeningDuration) {
  return {
    ...structuredClone(completeOneDayWireFixture),
    travelPlan: {
      ...completeOneDayWireFixture.travelPlan,
      durationDays,
    },
    itinerary: Array.from({ length: durationDays }, (_, index) => ({
      dayNumber: index + 1,
      title:
        index === 0
          ? completeOneDayWireFixture.itinerary[0].title
          : `Cox's Bazar exploration day ${index + 1}`,
      activities: structuredClone(
        completeOneDayWireFixture.itinerary[0].activities
      ),
    })),
  }
}

function inspectDurationItinerary(
  itinerary: FinalItineraryResponse,
  requestedDurationDays: ScreeningDuration
) {
  const activities = itinerary.itinerary.flatMap((day) => day.activities)
  const serialized = JSON.stringify(itinerary)
  const forbiddenMetadataAbsent = forbiddenProviderFields.every(
    (field) => !serialized.includes(`\"${field}\"`)
  )
  const sequentialDaysValid = itinerary.itinerary.every(
    (day, index) => day.dayNumber === index + 1
  )
  const validDayActivityStructures = itinerary.itinerary.every(
    (day) => day.title.trim().length > 0 && day.activities.length > 0
  )
  const placeObjectsValid = activities.every((activity) => {
    const place = activity.place
    if (place === undefined) {
      return false
    }
    if (place.kind === "specific_place") {
      return typeof place.name === "string" && place.name.trim().length > 0
    }
    return place.name === null || place.name === undefined
  })

  let storageTransformationCompatible = false
  try {
    const stored = toStoredFinalItineraryPayload(itinerary)
    storageTransformationCompatible =
      stored.itinerary.length === requestedDurationDays &&
      stored.itinerary.every(
        (day, index) =>
          day.dayNumber === index + 1 && day.activities.length > 0
      )
  } catch {
    storageTransformationCompatible = false
  }

  const reasonablyCoherent =
    itinerary.travelPlan.source === oneDayRequirements.source &&
    itinerary.travelPlan.destination === oneDayRequirements.destination &&
    itinerary.travelPlan.durationDays === requestedDurationDays &&
    itinerary.itinerary.length === requestedDurationDays &&
    itinerary.hotels.length >= 2 &&
    itinerary.hotels.length <= 4 &&
    sequentialDaysValid &&
    validDayActivityStructures &&
    placeObjectsValid &&
    forbiddenMetadataAbsent

  return {
    actualDayCount: itinerary.itinerary.length,
    sequentialDaysValid,
    validDayActivityStructures,
    placeObjectsValid,
    forbiddenMetadataAbsent,
    storageTransformationCompatible,
    reasonablyCoherent,
  }
}

function createGroqFinalDurationScreeningRecord({
  attemptNumber,
  requestedDurationDays,
  result,
  providerError,
  latencyMs,
  providerRequestCount,
}: {
  attemptNumber: ScreeningAttemptNumber
  requestedDurationDays: ScreeningDuration
  result: FinalResult
  providerError?: GroqFinalProviderErrorMetadata
  latencyMs: number
  providerRequestCount: number
}): GroqFinalDurationScreeningRecord {
  if (providerRequestCount !== 1) {
    throw new Error("Each screening attempt must make exactly one request.")
  }

  const plan = getDurationBudgetPlan(requestedDurationDays)
  const diagnostic = result.ok ? result.data.diagnostic : result.diagnostic
  const successDiagnostic = result.ok ? result.data.diagnostic : undefined
  const rateLimit = result.ok ? result.data.rateLimit : diagnostic?.rateLimit
  const inspection = result.ok
    ? inspectDurationItinerary(result.data.response, requestedDurationDays)
    : undefined
  const fullPipelineSuccess =
    result.ok &&
    successDiagnostic?.finishReason === "stop" &&
    successDiagnostic.jsonParsed === true &&
    successDiagnostic.wireNormalized === true &&
    successDiagnostic.runtimeValidated === true &&
    successDiagnostic.durationValidated === true &&
    inspection?.sequentialDaysValid === true &&
    inspection.validDayActivityStructures === true &&
    inspection.storageTransformationCompatible === true &&
    inspection.reasonablyCoherent === true

  return {
    runIdentifier: groqFinalDurationScreeningRunIdentifier,
    attemptNumber,
    requestedDurationDays,
    modelIdentifier: expectedOneDayModel,
    schemaName: "groq_final_itinerary_wire_response",
    strict: true,
    temperature: 0.4,
    selectedCompletionBudget: plan.selectedCompletionBudget,
    defaultCompletionBudget: plan.defaultCompletionBudget,
    estimatedInputTokens: plan.estimatedInputTokens,
    estimatedMaximumRequestTokens: plan.estimatedMaximumRequestTokens,
    estimatedTpmMargin: plan.estimatedTpmMargin,
    timeoutMs: GROQ_FINAL_ITINERARY_TIMEOUT_MS,
    retryCount: 0,
    providerRequestCount: 1,
    httpStatus: result.ok
      ? 200
      : providerError?.httpStatus ?? diagnostic?.httpStatus ?? null,
    providerErrorType:
      providerError?.providerErrorType ?? diagnostic?.providerErrorType ?? null,
    providerErrorCode: providerError?.providerErrorCode ?? null,
    providerErrorParameter: providerError?.providerErrorParameter ?? null,
    schemaPath: providerError?.schemaPath ?? null,
    outcome: classifyOutcome(result, providerError, fullPipelineSuccess),
    failedGenerationPresent:
      providerError?.failedGenerationPresent ?? false,
    completionExhaustionIndicated:
      providerError?.generationExhaustionIndicated ??
      diagnostic?.normalizedFailureCode === "output_truncated",
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
    sequentialDaysValid: inspection?.sequentialDaysValid ?? null,
    validDayActivityStructures:
      inspection?.validDayActivityStructures ?? null,
    durationValid: result.ok
      ? successDiagnostic?.durationValidated ?? null
      : null,
    actualDayCount: inspection?.actualDayCount ?? null,
    storageTransformationCompatible:
      inspection?.storageTransformationCompatible ?? null,
    reasonablyCoherent: inspection?.reasonablyCoherent ?? null,
    fullPipelineSuccess,
  }
}

function getDurationScreeningContinuation(
  record: Pick<GroqFinalDurationScreeningRecord, "outcome" | "rateLimit">,
  nextPlan: DurationBudgetPlan | undefined
): DurationScreeningContinuation {
  if (nextPlan === undefined) {
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
    case "PROVIDER_TIMEOUT":
      return { continue: false, reason: "PROVIDER_TIMEOUT" }
    case "COMPLETION_EXHAUSTION_INDICATED":
    case "OUTPUT_TRUNCATED":
      return { continue: false, reason: "COMPLETION_CAPACITY_REACHED" }
    case "UNKNOWN":
      return { continue: false, reason: "UNKNOWN_PROVIDER_FAILURE" }
  }

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
    limitTokensPerMinute < nextPlan.estimatedMaximumRequestTokens ||
    nextPlan.estimatedTpmMargin < minimumTpmMargin
  ) {
    return { continue: false, reason: "RATE_LIMIT_CAPACITY_INSUFFICIENT" }
  }

  return {
    continue: true,
    waitMs: Math.max(
      minimumSpacingMs,
      Math.ceil((resetTokensSeconds + 5) * 1_000)
    ),
  }
}

function writeGroqFinalDurationScreeningRecord(
  reportPath: string,
  record: GroqFinalDurationScreeningRecord,
  expectedExistingRecords: number
) {
  if (expectedExistingRecords === 0) {
    writeFileSync(reportPath, `${JSON.stringify(record)}\n`, {
      encoding: "utf8",
      flag: "wx",
    })
    return
  }

  const existingRecords = readGroqFinalDurationScreeningRecords(reportPath)
  if (existingRecords.length !== expectedExistingRecords) {
    throw new Error("Screening report count does not match provider-call count.")
  }

  appendFileSync(reportPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
  })
}

function readGroqFinalDurationScreeningRecords(reportPath: string) {
  return readFileSync(reportPath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line, index) =>
      parseGroqFinalDurationScreeningRecord(
        JSON.parse(line) as unknown,
        index + 1
      )
    )
}

function classifyOutcome(
  result: FinalResult,
  providerError: GroqFinalProviderErrorMetadata | undefined,
  fullPipelineSuccess: boolean
): DurationScreeningOutcome {
  if (fullPipelineSuccess) {
    return "FULL_PIPELINE_SUCCESS"
  }
  if (result.ok) {
    return "APPLICATION_VALIDATION_FAILED"
  }
  if (providerError !== undefined) {
    return providerError.category
  }
  switch (result.code) {
    case "provider_timeout":
      return "PROVIDER_TIMEOUT"
    case "output_truncated":
      return "OUTPUT_TRUNCATED"
    case "invalid_json":
      return "INVALID_JSON"
    case "schema_validation":
      return result.diagnostic?.normalizedFailureCode === "duration_validation"
        ? "DURATION_MISMATCH"
        : "APPLICATION_VALIDATION_FAILED"
    case "configuration":
      return "CONFIGURATION_ERROR"
    default:
      return "UNKNOWN"
  }
}

function parseGroqFinalDurationScreeningRecord(
  value: unknown,
  lineNumber: number
) {
  const record = asObject(value)
  if (
    record === undefined ||
    record.runIdentifier !== groqFinalDurationScreeningRunIdentifier ||
    !isAttemptNumber(record.attemptNumber) ||
    !isScreeningDuration(record.requestedDurationDays) ||
    record.modelIdentifier !== expectedOneDayModel ||
    record.schemaName !== "groq_final_itinerary_wire_response" ||
    record.strict !== true ||
    record.temperature !== 0.4 ||
    !isNonNegativeNumber(record.selectedCompletionBudget) ||
    !isNonNegativeNumber(record.defaultCompletionBudget) ||
    !isNonNegativeNumber(record.estimatedInputTokens) ||
    !isNonNegativeNumber(record.estimatedMaximumRequestTokens) ||
    !isNonNegativeNumber(record.estimatedTpmMargin) ||
    record.timeoutMs !== GROQ_FINAL_ITINERARY_TIMEOUT_MS ||
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
    throw new Error(`Invalid duration screening record on line ${lineNumber}.`)
  }

  const expectedPlan = getDurationBudgetPlan(record.requestedDurationDays)
  if (
    record.selectedCompletionBudget !== expectedPlan.selectedCompletionBudget ||
    record.defaultCompletionBudget !== expectedPlan.defaultCompletionBudget ||
    record.estimatedInputTokens !== expectedPlan.estimatedInputTokens ||
    record.estimatedMaximumRequestTokens !==
      expectedPlan.estimatedMaximumRequestTokens ||
    record.estimatedTpmMargin !== expectedPlan.estimatedTpmMargin
  ) {
    throw new Error(`Invalid duration budget on line ${lineNumber}.`)
  }

  return record as GroqFinalDurationScreeningRecord
}

function isScreeningDuration(value: unknown): value is ScreeningDuration {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
}

function isAttemptNumber(value: unknown): value is ScreeningAttemptNumber {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
}

function isOutcome(value: unknown): value is DurationScreeningOutcome {
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

function estimateTokens(bytes: number) {
  return Math.ceil(bytes / 4)
}

export {
  buildRepresentativeWireFixture,
  createGroqFinalDurationScreeningRecord,
  evidencedFreePlanTokensPerMinute,
  getDurationBudgetPlan,
  getDurationRequirements,
  getDurationScreeningContinuation,
  getDurationScreeningOutgoingRequestSnapshot,
  getDurationScreeningRequestInput,
  groqFinalDurationScreeningMaximumRequests,
  groqFinalDurationScreeningRunIdentifier,
  inspectDurationItinerary,
  minimumTpmMargin,
  readGroqFinalDurationScreeningRecords,
  screeningDurations,
  writeGroqFinalDurationScreeningRecord,
  type DurationBudgetPlan,
  type GroqFinalDurationScreeningRecord,
  type ScreeningAttemptNumber,
  type ScreeningDuration,
}
