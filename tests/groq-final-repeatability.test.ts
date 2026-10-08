import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import { parseFinalItineraryResponse } from "@/lib/ai/contract"
import { normalizeGroqFinalItineraryWire } from "@/lib/ai/groq-final-schema"
import type { GroqFinalProviderErrorMetadata } from "@/lib/ai/groq"
import {
  getStep4A3ClientSnapshot,
  getStep4A3OutgoingRequestSnapshot,
} from "@/tests/helpers/groq-final-400-diagnostic"
import {
  createGroqFinalRepeatabilityRecord,
  getRepeatabilityContinuation,
  getRepeatabilityOutgoingRequestSnapshot,
  getRepeatabilityRequestInput,
  groqFinalRepeatabilityMaximumAttempts,
  readGroqFinalRepeatabilityRecords,
  writeGroqFinalRepeatabilityRecord,
  type GroqFinalRepeatabilityRecord,
} from "@/tests/helpers/groq-final-repeatability"
import {
  buildGroqFinalMessages,
  completeOneDayWireFixture,
  oneDayRequirements,
} from "@/tests/helpers/groq-final-one-day"

describe("Step 4A.3B exact request preservation", () => {
  test("is identical to the established Step 4A.3A request and client", () => {
    expect(getRepeatabilityOutgoingRequestSnapshot()).toEqual(
      getStep4A3OutgoingRequestSnapshot()
    )
    expect(getRepeatabilityRequestInput()).toEqual({
      messages: buildGroqFinalMessages(oneDayRequirements),
      durationDays: 1,
      maxCompletionTokens: 3_500,
    })
    expect(getStep4A3ClientSnapshot()).toEqual({
      baseURL: "https://api.groq.com/openai/v1",
      timeout: 90_000,
      maxRetries: 0,
    })

    const request = getRepeatabilityOutgoingRequestSnapshot()
    expect(request).not.toHaveProperty("reasoning")
    expect(request).not.toHaveProperty("reasoning_effort")
    expect(request).not.toHaveProperty("include_reasoning")
    expect(request).not.toHaveProperty("stream")
    expect(request).not.toHaveProperty("tools")
  })
})

describe("Step 4A.3B repeatability accounting and stop rules", () => {
  test("writes one sanitized record per request and never overwrites", () => {
    const reportPath = join(
      mkdtempSync(join(tmpdir(), "groq-final-repeatability-")),
      "report.jsonl"
    )
    const records = [1, 2, 3].map((attemptNumber) =>
      successRecord(attemptNumber as 1 | 2 | 3)
    )

    records.forEach((record, index) =>
      writeGroqFinalRepeatabilityRecord(reportPath, record, index)
    )

    expect(readGroqFinalRepeatabilityRecords(reportPath)).toEqual(records)
    expect(() =>
      writeGroqFinalRepeatabilityRecord(reportPath, records[2]!, 0)
    ).toThrow()
    expect(
      readGroqFinalRepeatabilityRecords(reportPath).reduce(
        (total, record) => total + record.providerRequestCount,
        0
      )
    ).toBe(3)

    const serialized = JSON.stringify(records)
    expect(serialized).not.toContain("message")
    expect(serialized).not.toContain("failed_generation")
    expect(serialized).not.toContain("reasoning")
    expect(serialized).not.toContain("authorization")
    expect(serialized).not.toContain("apiKey")
    expect(serialized).not.toContain("Hotel Sea Crown")
    expect(serialized).not.toContain("itinerary\":")
  })

  test("enforces three attempts, sequential spacing, and blocking failures", () => {
    expect(groqFinalRepeatabilityMaximumAttempts).toBe(3)
    expect(getRepeatabilityContinuation(successRecord(1))).toEqual({
      continue: true,
      waitMs: 75_000,
    })
    expect(getRepeatabilityContinuation(successRecord(3))).toEqual({
      continue: false,
      reason: "ATTEMPT_LIMIT_REACHED",
    })
    expect(
      getRepeatabilityContinuation(
        failureRecord(1, "PROVIDER_RATE_LIMITED")
      )
    ).toEqual({ continue: false, reason: "PROVIDER_RATE_LIMITED" })
    expect(
      getRepeatabilityContinuation(
        failureRecord(1, "SCHEMA_REQUEST_REJECTED")
      )
    ).toEqual({ continue: false, reason: "SCHEMA_REQUEST_REJECTED" })
    expect(
      getRepeatabilityContinuation(failureRecord(1, "PROVIDER_UNAVAILABLE"))
    ).toEqual({ continue: false, reason: "PROVIDER_UNAVAILABLE" })
    expect(
      getRepeatabilityContinuation(
        failureRecord(1, "JSON_GENERATION_VALIDATION_FAILED")
      )
    ).toEqual({ continue: true, waitMs: 75_000 })
  })

  test("stops when quota headroom or quota evidence is insufficient", () => {
    expect(
      getRepeatabilityContinuation({
        ...successRecord(1),
        rateLimit: {
          limitTokensPerMinute: 8_000,
          remainingTokens: 4_000,
          resetTokensSeconds: 10,
        },
      })
    ).toEqual({
      continue: false,
      reason: "RATE_LIMIT_CAPACITY_INSUFFICIENT",
    })
    expect(
      getRepeatabilityContinuation({
        ...successRecord(1),
        rateLimit: {
          limitTokensPerMinute: null,
          remainingTokens: null,
          resetTokensSeconds: null,
        },
      })
    ).toEqual({
      continue: false,
      reason: "RATE_LIMIT_METADATA_UNCERTAIN",
    })
  })

  test("requires the complete validation pipeline for success", () => {
    const result = successfulResult()
    const record = createGroqFinalRepeatabilityRecord({
      attemptNumber: 1,
      result,
      latencyMs: 1_234.4,
      providerRequestCount: 1,
    })

    expect(record).toMatchObject({
      outcome: "FULL_PIPELINE_SUCCESS",
      httpStatus: 200,
      wireSchemaValid: true,
      normalizationValid: true,
      applicationSchemaValid: true,
      sequentialDaysValid: true,
      durationValid: true,
      actualDayCount: 1,
      storageTransformationCompatible: true,
      fullPipelineSuccess: true,
      latencyMs: 1_234,
    })
  })

  test("uses the safe observer classification without retaining raw content", () => {
    const providerError: GroqFinalProviderErrorMetadata = {
      httpStatus: 400,
      providerErrorType: "invalid_request_error",
      providerErrorCode: "json_validate_failed",
      providerErrorParameter: "response_format",
      schemaPath: null,
      category: "JSON_GENERATION_VALIDATION_FAILED",
      failedGenerationPresent: true,
      generationExhaustionIndicated: false,
      unsupportedSchemaStructureIndicated: false,
    }
    const record = createGroqFinalRepeatabilityRecord({
      attemptNumber: 1,
      result: failedResult(),
      providerError,
      latencyMs: 900,
      providerRequestCount: 1,
    })

    expect(record).toMatchObject({
      outcome: "JSON_GENERATION_VALIDATION_FAILED",
      providerErrorCode: "json_validate_failed",
      failedGenerationPresent: true,
      fullPipelineSuccess: false,
    })
  })
})

function successRecord(
  attemptNumber: 1 | 2 | 3
): GroqFinalRepeatabilityRecord {
  return {
    runIdentifier: "step4a3b-one-day-repeatability-run-1",
    attemptNumber,
    modelIdentifier: "openai/gpt-oss-20b",
    schemaName: "groq_final_itinerary_wire_response",
    strict: true,
    temperature: 0.4,
    completionTokenBudget: 3_500,
    timeoutMs: 90_000,
    retryCount: 0,
    requestedDurationDays: 1,
    providerRequestCount: 1,
    httpStatus: 200,
    providerErrorType: null,
    providerErrorCode: null,
    providerErrorParameter: null,
    schemaPath: null,
    outcome: "FULL_PIPELINE_SUCCESS",
    failedGenerationPresent: false,
    generationExhaustionIndicated: false,
    unsupportedSchemaStructureIndicated: false,
    finishReason: "stop",
    inputTokens: 1_193,
    outputTokens: 1_551,
    totalTokens: 2_744,
    latencyMs: 2_237,
    rateLimit: {
      limitTokensPerMinute: 8_000,
      remainingTokens: 6_571,
      resetTokensSeconds: 11,
    },
    wireSchemaValid: true,
    normalizationValid: true,
    applicationSchemaValid: true,
    sequentialDaysValid: true,
    durationValid: true,
    actualDayCount: 1,
    storageTransformationCompatible: true,
    fullPipelineSuccess: true,
  }
}

function failureRecord(
  attemptNumber: 1 | 2 | 3,
  outcome: GroqFinalRepeatabilityRecord["outcome"]
): GroqFinalRepeatabilityRecord {
  return {
    ...successRecord(attemptNumber),
    httpStatus: outcome === "PROVIDER_RATE_LIMITED" ? 429 : 400,
    outcome,
    finishReason: null,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    wireSchemaValid: null,
    normalizationValid: null,
    applicationSchemaValid: null,
    sequentialDaysValid: null,
    durationValid: null,
    actualDayCount: null,
    storageTransformationCompatible: null,
    fullPipelineSuccess: false,
  }
}

function successfulResult() {
  const parsed = parseFinalItineraryResponse(
    normalizeGroqFinalItineraryWire(completeOneDayWireFixture)
  )
  if (!parsed.ok) {
    throw new Error("The established one-day fixture must remain valid.")
  }

  return {
    ok: true as const,
    data: {
      response: parsed.data,
      modelReturned: true,
      usage: {
        inputTokens: 1_193,
        outputTokens: 1_551,
        totalTokens: 2_744,
      },
      rateLimit: {
        limitTokensPerMinute: 8_000,
        remainingTokens: 6_571,
        resetTokensSeconds: 11,
      },
      diagnostic: {
        normalizedFailureCode: "success" as const,
        stage: "SUCCESS" as const,
        strictSchemaReachedProvider: true,
        responseFormatAccepted: true,
        providerContentReturned: true,
        finishReason: "stop",
        jsonParsed: true,
        wireNormalized: true,
        runtimeValidated: true,
        durationValidated: true,
      },
    },
  }
}

function failedResult() {
  return {
    ok: false as const,
    code: "provider_error" as const,
    error: "Groq provider request failed.",
    diagnostic: {
      normalizedFailureCode: "request_rejected" as const,
      stage: "PROVIDER_REQUEST" as const,
      strictSchemaReachedProvider: true,
      responseFormatAccepted: false,
      providerContentReturned: false,
      httpStatus: 400,
      providerErrorCategory: "request_rejected" as const,
      providerErrorType: "invalid_request_error",
      rateLimit: {
        limitTokensPerMinute: 8_000,
        remainingTokens: 6_500,
        resetTokensSeconds: 10,
      },
      jsonParsed: false,
      wireNormalized: false,
      runtimeValidated: false,
      durationValidated: false,
    },
  }
}
