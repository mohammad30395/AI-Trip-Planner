import { readFileSync, writeFileSync } from "node:fs"

import { groqFinalItineraryWireSchema } from "@/lib/ai/groq-final-schema"
import {
  GROQ_BASE_URL,
  GROQ_FINAL_ITINERARY_TIMEOUT_MS,
  type GroqFinalProviderErrorCategory,
  type GroqFinalProviderErrorMetadata,
} from "@/lib/ai/groq"
import {
  buildGroqFinalMessages,
  expectedOneDayModel,
  inspectValidatedItinerary,
  oneDayExperimentalCompletionBudget,
  oneDayRequirements,
} from "@/tests/helpers/groq-final-one-day"

type FinalResult = Awaited<
  ReturnType<typeof import("@/lib/ai/groq").runGroqFinalItinerary>
>

type GroqFinal400DiagnosticRecord = {
  runIdentifier: "step4a3a-final-400-run-1"
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
  errorCategory: GroqFinalProviderErrorCategory | "SUCCESSFUL_GENERATION"
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
  durationValid: boolean | null
  actualDayCount: number | null
  storageTransformationCompatible: boolean | null
}

const groqFinal400RunIdentifier = "step4a3a-final-400-run-1" as const

function getStep4A3OutgoingRequestSnapshot(
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

function getStep4A3ClientSnapshot() {
  return {
    baseURL: GROQ_BASE_URL,
    timeout: GROQ_FINAL_ITINERARY_TIMEOUT_MS,
    maxRetries: 0,
  } as const
}

function createGroqFinal400DiagnosticRecord({
  result,
  providerError,
  latencyMs,
  providerRequestCount,
}: {
  result: FinalResult
  providerError?: GroqFinalProviderErrorMetadata
  latencyMs: number
  providerRequestCount: number
}): GroqFinal400DiagnosticRecord {
  if (providerRequestCount !== 1) {
    throw new Error("The Step 4A.3A report requires exactly one provider request.")
  }

  const diagnostic = result.ok ? result.data.diagnostic : result.diagnostic
  const rateLimit = result.ok ? result.data.rateLimit : diagnostic?.rateLimit
  const inspection = result.ok
    ? inspectValidatedItinerary(result.data.response)
    : undefined

  return {
    runIdentifier: groqFinal400RunIdentifier,
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
    errorCategory: result.ok
      ? "SUCCESSFUL_GENERATION"
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
      ? result.data.diagnostic.wireNormalized
      : null,
    applicationSchemaValid: result.ok
      ? result.data.diagnostic.runtimeValidated
      : null,
    durationValid: result.ok
      ? result.data.diagnostic.durationValidated
      : null,
    actualDayCount: inspection?.actualDayCount ?? null,
    storageTransformationCompatible:
      inspection?.storageTransformationCompatible ?? null,
  }
}

function writeGroqFinal400DiagnosticRecord(
  reportPath: string,
  record: GroqFinal400DiagnosticRecord
) {
  writeFileSync(reportPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    flag: "wx",
  })
}

function readGroqFinal400DiagnosticRecords(reportPath: string) {
  const lines = readFileSync(reportPath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)

  return lines.map((line, index) =>
    parseGroqFinal400DiagnosticRecord(JSON.parse(line) as unknown, index + 1)
  )
}

function parseGroqFinal400DiagnosticRecord(
  value: unknown,
  lineNumber: number
) {
  const record = asObject(value)
  if (
    record === undefined ||
    record.runIdentifier !== groqFinal400RunIdentifier ||
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
    !isErrorCategory(record.errorCategory) ||
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
    !isNullableBoolean(record.durationValid) ||
    !isNullableNumber(record.actualDayCount) ||
    !isNullableBoolean(record.storageTransformationCompatible)
  ) {
    throw new Error(`Invalid Groq final 400 diagnostic on line ${lineNumber}.`)
  }

  return record as GroqFinal400DiagnosticRecord
}

function isErrorCategory(
  value: unknown
): value is GroqFinal400DiagnosticRecord["errorCategory"] {
  return (
    value === "SCHEMA_REQUEST_REJECTED" ||
    value === "JSON_GENERATION_VALIDATION_FAILED" ||
    value === "COMPLETION_EXHAUSTION_INDICATED" ||
    value === "CONFIGURATION_ERROR" ||
    value === "PROVIDER_RATE_LIMITED" ||
    value === "PROVIDER_UNAVAILABLE" ||
    value === "SUCCESSFUL_GENERATION" ||
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
  createGroqFinal400DiagnosticRecord,
  getStep4A3ClientSnapshot,
  getStep4A3OutgoingRequestSnapshot,
  groqFinal400RunIdentifier,
  readGroqFinal400DiagnosticRecords,
  writeGroqFinal400DiagnosticRecord,
  type GroqFinal400DiagnosticRecord,
}
