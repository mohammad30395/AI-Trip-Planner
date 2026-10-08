import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import { parseFinalItineraryResponse } from "@/lib/ai/contract"
import {
  groqFinalItineraryWireSchema,
  normalizeGroqFinalItineraryWire,
} from "@/lib/ai/groq-final-schema"
import type { GroqFinalProviderErrorMetadata } from "@/lib/ai/groq"
import { validateItineraryDuration } from "@/lib/ai/itinerary"
import {
  buildRepresentativeWireFixture,
  createGroqFinalDurationScreeningRecord,
  evidencedFreePlanTokensPerMinute,
  getDurationBudgetPlan,
  getDurationRequirements,
  getDurationScreeningContinuation,
  getDurationScreeningOutgoingRequestSnapshot,
  getDurationScreeningRequestInput,
  groqFinalDurationScreeningMaximumRequests,
  inspectDurationItinerary,
  minimumTpmMargin,
  readGroqFinalDurationScreeningRecords,
  screeningDurations,
  writeGroqFinalDurationScreeningRecord,
  type GroqFinalDurationScreeningRecord,
  type ScreeningDuration,
} from "@/tests/helpers/groq-final-duration-screening"
import {
  buildGroqFinalMessages,
  oneDayRequirements,
  validateStrictSchemaValue,
} from "@/tests/helpers/groq-final-one-day"

describe("Step 4A.4A duration fixtures and budgets", () => {
  test.each(screeningDurations)(
    "validates the complete %i-day fixture through storage",
    (durationDays) => {
      const fixture = buildRepresentativeWireFixture(durationDays)
      expect(
        validateStrictSchemaValue(groqFinalItineraryWireSchema, fixture)
      ).toEqual({ ok: true })

      const parsed = parseFinalItineraryResponse(
        normalizeGroqFinalItineraryWire(fixture)
      )
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) {
        return
      }

      const duration = validateItineraryDuration(parsed.data, durationDays)
      expect(duration.ok).toBe(true)
      if (!duration.ok) {
        return
      }

      expect(
        inspectDurationItinerary(duration.data, durationDays)
      ).toMatchObject({
        actualDayCount: durationDays,
        sequentialDaysValid: true,
        validDayActivityStructures: true,
        placeObjectsValid: true,
        forbiddenMetadataAbsent: true,
        storageTransformationCompatible: true,
        reasonablyCoherent: true,
      })
    }
  )

  test("documents inadequate defaults and conservative experimental budgets", () => {
    const plans = screeningDurations.map(getDurationBudgetPlan)

    expect(plans.map((plan) => plan.defaultCompletionBudget)).toEqual([
      1_700, 2_200, 2_700, 3_700,
    ])
    expect(plans.map((plan) => plan.selectedCompletionBudget)).toEqual([
      3_500, 4_050, 4_600, 5_700,
    ])
    expect(plans[0]?.defaultCompletionBudget).toBeLessThan(1_907)
    for (const plan of plans) {
      expect(plan.estimatedMaximumRequestTokens).toBeLessThanOrEqual(
        evidencedFreePlanTokensPerMinute - minimumTpmMargin
      )
      expect(plan.estimatedTpmMargin).toBeGreaterThanOrEqual(minimumTpmMargin)
      expect(plan.selectedCompletionBudget).toBeGreaterThan(
        plan.representativeOutputEstimatedTokens
      )
    }
  })
})

describe("Step 4A.4A request preservation", () => {
  test("changes only duration content and the recorded test-only budget", () => {
    const snapshots = screeningDurations.map((durationDays) =>
      getDurationScreeningOutgoingRequestSnapshot(durationDays)
    )
    const first = snapshots[0]!

    for (const [index, snapshot] of snapshots.entries()) {
      const durationDays = screeningDurations[index]!
      expect(snapshot.model).toBe(first.model)
      expect(snapshot.response_format).toEqual(first.response_format)
      expect(snapshot.temperature).toBe(first.temperature)
      expect(snapshot.messages[0]).toEqual(first.messages[0])
      expect(snapshot.messages).toEqual(
        buildGroqFinalMessages(getDurationRequirements(durationDays))
      )
      expect(snapshot.max_completion_tokens).toBe(
        getDurationBudgetPlan(durationDays).selectedCompletionBudget
      )
      expect(snapshot).not.toHaveProperty("reasoning")
      expect(snapshot).not.toHaveProperty("reasoning_effort")
      expect(snapshot).not.toHaveProperty("include_reasoning")
      expect(snapshot).not.toHaveProperty("tools")
      expect(snapshot).not.toHaveProperty("stream")
    }

    expect(getDurationScreeningRequestInput(1)).toEqual({
      messages: buildGroqFinalMessages(oneDayRequirements),
      durationDays: 1,
      maxCompletionTokens: 3_500,
    })
  })
})

describe("Step 4A.4A accounting and adaptive stop rules", () => {
  test("caps calls at four and waits at least 75 seconds", () => {
    expect(groqFinalDurationScreeningMaximumRequests).toBe(4)
    expect(
      getDurationScreeningContinuation(successRecord(1, 1), getDurationBudgetPlan(2))
    ).toEqual({ continue: true, waitMs: 75_000 })
    expect(
      getDurationScreeningContinuation(successRecord(4, 5), undefined)
    ).toEqual({ continue: false, reason: "ATTEMPT_LIMIT_REACHED" })
  })

  test("continues after stochastic generation failure but stops on blockers", () => {
    expect(
      getDurationScreeningContinuation(
        failureRecord(1, 1, "JSON_GENERATION_VALIDATION_FAILED"),
        getDurationBudgetPlan(2)
      )
    ).toEqual({ continue: true, waitMs: 75_000 })
    expect(
      getDurationScreeningContinuation(
        failureRecord(1, 1, "PROVIDER_RATE_LIMITED"),
        getDurationBudgetPlan(2)
      )
    ).toEqual({ continue: false, reason: "PROVIDER_RATE_LIMITED" })
    expect(
      getDurationScreeningContinuation(
        failureRecord(1, 1, "COMPLETION_EXHAUSTION_INDICATED"),
        getDurationBudgetPlan(2)
      )
    ).toEqual({ continue: false, reason: "COMPLETION_CAPACITY_REACHED" })
    expect(
      getDurationScreeningContinuation(
        failureRecord(1, 1, "SCHEMA_REQUEST_REJECTED"),
        getDurationBudgetPlan(2)
      )
    ).toEqual({ continue: false, reason: "SCHEMA_REQUEST_REJECTED" })
  })

  test("stops before an underfunded next request or uncertain quota", () => {
    const insufficient = {
      ...getDurationBudgetPlan(5),
      estimatedMaximumRequestTokens: 7_500,
      estimatedTpmMargin: 500,
    }
    expect(
      getDurationScreeningContinuation(successRecord(3, 3), insufficient)
    ).toEqual({
      continue: false,
      reason: "RATE_LIMIT_CAPACITY_INSUFFICIENT",
    })
    expect(
      getDurationScreeningContinuation(
        {
          ...successRecord(1, 1),
          rateLimit: {
            limitTokensPerMinute: null,
            remainingTokens: null,
            resetTokensSeconds: null,
          },
        },
        getDurationBudgetPlan(2)
      )
    ).toEqual({
      continue: false,
      reason: "RATE_LIMIT_METADATA_UNCERTAIN",
    })
  })

  test("persists exactly one sanitized record per call", () => {
    const reportPath = join(
      mkdtempSync(join(tmpdir(), "groq-duration-screen-")),
      "report.jsonl"
    )
    const records = screeningDurations.map((durationDays, index) =>
      successRecord((index + 1) as 1 | 2 | 3 | 4, durationDays)
    )

    records.forEach((record, index) =>
      writeGroqFinalDurationScreeningRecord(reportPath, record, index)
    )
    expect(readGroqFinalDurationScreeningRecords(reportPath)).toEqual(records)
    expect(() =>
      writeGroqFinalDurationScreeningRecord(reportPath, records[3]!, 0)
    ).toThrow()
    expect(
      readGroqFinalDurationScreeningRecords(reportPath).reduce(
        (total, record) => total + record.providerRequestCount,
        0
      )
    ).toBe(4)

    const serialized = JSON.stringify(records)
    expect(serialized).not.toContain("message")
    expect(serialized).not.toContain("failed_generation")
    expect(serialized).not.toContain("reasoning")
    expect(serialized).not.toContain("authorization")
    expect(serialized).not.toContain("apiKey")
    expect(serialized).not.toContain("Hotel Sea Crown")
    expect(serialized).not.toContain("itinerary\":")
  })

  test("classifies safe provider evidence without raw failure content", () => {
    const metadata: GroqFinalProviderErrorMetadata = {
      httpStatus: 400,
      providerErrorType: "invalid_request_error",
      providerErrorCode: "json_validate_failed",
      providerErrorParameter: null,
      schemaPath: null,
      category: "JSON_GENERATION_VALIDATION_FAILED",
      failedGenerationPresent: true,
      generationExhaustionIndicated: false,
      unsupportedSchemaStructureIndicated: false,
    }
    const record = createGroqFinalDurationScreeningRecord({
      attemptNumber: 1,
      requestedDurationDays: 1,
      result: failedResult(),
      providerError: metadata,
      latencyMs: 1_000,
      providerRequestCount: 1,
    })

    expect(record).toMatchObject({
      httpStatus: 400,
      outcome: "JSON_GENERATION_VALIDATION_FAILED",
      providerErrorCode: "json_validate_failed",
      failedGenerationPresent: true,
      completionExhaustionIndicated: false,
      fullPipelineSuccess: false,
    })
  })
})

function successRecord(
  attemptNumber: 1 | 2 | 3 | 4,
  durationDays: ScreeningDuration
): GroqFinalDurationScreeningRecord {
  const plan = getDurationBudgetPlan(durationDays)
  return {
    runIdentifier: "step4a4a-duration-screening-run-1",
    attemptNumber,
    requestedDurationDays: durationDays,
    modelIdentifier: "openai/gpt-oss-20b",
    schemaName: "groq_final_itinerary_wire_response",
    strict: true,
    temperature: 0.4,
    selectedCompletionBudget: plan.selectedCompletionBudget,
    defaultCompletionBudget: plan.defaultCompletionBudget,
    estimatedInputTokens: plan.estimatedInputTokens,
    estimatedMaximumRequestTokens: plan.estimatedMaximumRequestTokens,
    estimatedTpmMargin: plan.estimatedTpmMargin,
    timeoutMs: 90_000,
    retryCount: 0,
    providerRequestCount: 1,
    httpStatus: 200,
    providerErrorType: null,
    providerErrorCode: null,
    providerErrorParameter: null,
    schemaPath: null,
    outcome: "FULL_PIPELINE_SUCCESS",
    failedGenerationPresent: false,
    completionExhaustionIndicated: false,
    unsupportedSchemaStructureIndicated: false,
    finishReason: "stop",
    inputTokens: 1_193,
    outputTokens: 1_900,
    totalTokens: 3_093,
    latencyMs: 2_500,
    rateLimit: {
      limitTokensPerMinute: 8_000,
      remainingTokens: 6_500,
      resetTokensSeconds: 11,
    },
    wireSchemaValid: true,
    normalizationValid: true,
    applicationSchemaValid: true,
    sequentialDaysValid: true,
    validDayActivityStructures: true,
    durationValid: true,
    actualDayCount: durationDays,
    storageTransformationCompatible: true,
    reasonablyCoherent: true,
    fullPipelineSuccess: true,
  }
}

function failureRecord(
  attemptNumber: 1 | 2 | 3 | 4,
  durationDays: ScreeningDuration,
  outcome: GroqFinalDurationScreeningRecord["outcome"]
) {
  return {
    ...successRecord(attemptNumber, durationDays),
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
    validDayActivityStructures: null,
    durationValid: null,
    actualDayCount: null,
    storageTransformationCompatible: null,
    reasonablyCoherent: null,
    fullPipelineSuccess: false,
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
