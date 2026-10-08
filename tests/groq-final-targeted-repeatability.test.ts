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
  getDurationBudgetPlan,
  getDurationRequirements,
  inspectDurationItinerary,
} from "@/tests/helpers/groq-final-duration-screening"
import {
  createGroqFinalTargetedRepeatabilityRecord,
  getTargetedRepeatabilityContinuation,
  getTargetedRepeatabilityOutgoingRequestSnapshot,
  getTargetedRepeatabilityRequestInput,
  groqFinalTargetedRepeatabilityMaximumRequests,
  readGroqFinalTargetedRepeatabilityRecords,
  targetedRepeatabilityDurations,
  writeGroqFinalTargetedRepeatabilityRecord,
  type GroqFinalTargetedRepeatabilityRecord,
  type TargetedAttemptNumber,
} from "@/tests/helpers/groq-final-targeted-repeatability"
import {
  buildGroqFinalMessages,
  validateStrictSchemaValue,
} from "@/tests/helpers/groq-final-one-day"

describe("Step 4A.4B four-day offline gate", () => {
  test("passes the complete four-day validation and storage pipeline", () => {
    const fixture = buildRepresentativeWireFixture(4)
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

    const duration = validateItineraryDuration(parsed.data, 4)
    expect(duration.ok).toBe(true)
    if (!duration.ok) {
      return
    }

    expect(inspectDurationItinerary(duration.data, 4)).toMatchObject({
      actualDayCount: 4,
      sequentialDaysValid: true,
      validDayActivityStructures: true,
      placeObjectsValid: true,
      forbiddenMetadataAbsent: true,
      storageTransformationCompatible: true,
      reasonablyCoherent: true,
    })
  })

  test("uses the authorized four-day cap within the observed quota", () => {
    expect(getDurationBudgetPlan(4)).toMatchObject({
      durationDays: 4,
      defaultCompletionBudget: 3_200,
      selectedCompletionBudget: 5_150,
      estimatedInputTokens: 1_401,
      estimatedMaximumRequestTokens: 6_551,
      estimatedTpmMargin: 1_449,
    })
  })
})

describe("Step 4A.4B planned request sequence", () => {
  test("locks the five independently planned observations", () => {
    expect(targetedRepeatabilityDurations).toEqual([4, 3, 4, 3, 1])
    expect(groqFinalTargetedRepeatabilityMaximumRequests).toBe(5)

    targetedRepeatabilityDurations.forEach((durationDays, index) => {
      const attemptNumber = (index + 1) as TargetedAttemptNumber
      const request = getTargetedRepeatabilityRequestInput(attemptNumber)
      expect(request).toEqual({
        messages: buildGroqFinalMessages(getDurationRequirements(durationDays)),
        durationDays,
        maxCompletionTokens:
          getDurationBudgetPlan(durationDays).selectedCompletionBudget,
      })
    })
  })

  test("changes only duration-related prompt content and the test budget", () => {
    const fourDay = getTargetedRepeatabilityOutgoingRequestSnapshot(1)
    const threeDay = getTargetedRepeatabilityOutgoingRequestSnapshot(2)
    const fourDayAgain = getTargetedRepeatabilityOutgoingRequestSnapshot(3)

    expect(fourDayAgain).toEqual(fourDay)
    expect(fourDay.model).toBe(threeDay.model)
    expect(fourDay.response_format).toEqual(threeDay.response_format)
    expect(fourDay.temperature).toBe(threeDay.temperature)
    expect(fourDay.messages[0]).toEqual(threeDay.messages[0])
    expect(
      fourDay.messages[1]?.content.replace("Duration days: 4", "Duration days: X")
    ).toBe(
      threeDay.messages[1]?.content.replace(
        "Duration days: 3",
        "Duration days: X"
      )
    )
    expect(fourDay.max_completion_tokens).toBe(5_150)
    expect(threeDay.max_completion_tokens).toBe(4_600)

    for (const request of [fourDay, threeDay]) {
      expect(request).not.toHaveProperty("reasoning")
      expect(request).not.toHaveProperty("reasoning_effort")
      expect(request).not.toHaveProperty("include_reasoning")
      expect(request).not.toHaveProperty("tools")
      expect(request).not.toHaveProperty("stream")
    }
  })
})

describe("Step 4A.4B accounting, redaction, and stop behavior", () => {
  test("writes exactly five sanitized records without overwriting", () => {
    const reportPath = join(
      mkdtempSync(join(tmpdir(), "groq-targeted-repeatability-")),
      "report.jsonl"
    )
    const records = targetedRepeatabilityDurations.map((_, index) =>
      createSuccessRecord((index + 1) as TargetedAttemptNumber)
    )

    records.forEach((record, index) =>
      writeGroqFinalTargetedRepeatabilityRecord(reportPath, record, index)
    )
    expect(readGroqFinalTargetedRepeatabilityRecords(reportPath)).toEqual(
      records
    )
    expect(() =>
      writeGroqFinalTargetedRepeatabilityRecord(reportPath, records[4]!, 0)
    ).toThrow()
    expect(
      records.reduce(
        (total, record) => total + record.providerRequestCount,
        0
      )
    ).toBe(5)

    const serialized = JSON.stringify(records)
    expect(serialized).not.toContain("message")
    expect(serialized).not.toContain("failed_generation")
    expect(serialized).not.toContain("reasoning")
    expect(serialized).not.toContain("authorization")
    expect(serialized).not.toContain("apiKey")
    expect(serialized).not.toContain("Hotel Sea Crown")
    expect(serialized).not.toContain("itinerary\":")
  })

  test("continues after json validation failure and stops after attempt five", () => {
    const first = createSuccessRecord(1)
    expect(
      getTargetedRepeatabilityContinuation({
        ...first,
        httpStatus: 400,
        outcome: "JSON_GENERATION_VALIDATION_FAILED",
        fullPipelineSuccess: false,
      })
    ).toEqual({ continue: true, waitMs: 75_000 })
    expect(
      getTargetedRepeatabilityContinuation(createSuccessRecord(5))
    ).toEqual({ continue: false, reason: "ATTEMPT_LIMIT_REACHED" })
  })

  test("retains only safe provider failure metadata", () => {
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
    const record = createGroqFinalTargetedRepeatabilityRecord({
      attemptNumber: 1,
      result: failedResult(),
      providerError: metadata,
      latencyMs: 1_000,
      providerRequestCount: 1,
    })

    expect(record).toMatchObject({
      requestedDurationDays: 4,
      selectedCompletionBudget: 5_150,
      outcome: "JSON_GENERATION_VALIDATION_FAILED",
      providerErrorCode: "json_validate_failed",
      failedGenerationPresent: true,
      completionExhaustionIndicated: false,
      fullPipelineSuccess: false,
    })
  })
})

function createSuccessRecord(
  attemptNumber: TargetedAttemptNumber
): GroqFinalTargetedRepeatabilityRecord {
  const durationDays = targetedRepeatabilityDurations[attemptNumber - 1]
  const parsed = parseFinalItineraryResponse(
    normalizeGroqFinalItineraryWire(
      buildRepresentativeWireFixture(durationDays)
    )
  )
  if (!parsed.ok) {
    throw new Error("The representative fixture must remain valid.")
  }

  return createGroqFinalTargetedRepeatabilityRecord({
    attemptNumber,
    result: {
      ok: true,
      data: {
        response: parsed.data,
        modelReturned: true,
        usage: {
          inputTokens: 1_193,
          outputTokens: 2_000,
          totalTokens: 3_193,
        },
        rateLimit: {
          limitTokensPerMinute: 8_000,
          remainingTokens: 6_000,
          resetTokensSeconds: 11,
        },
        diagnostic: {
          normalizedFailureCode: "success",
          stage: "SUCCESS",
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
    },
    latencyMs: 2_000,
    providerRequestCount: 1,
  })
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
        remainingTokens: 6_000,
        resetTokensSeconds: 11,
      },
      jsonParsed: false,
      wireNormalized: false,
      runtimeValidated: false,
      durationValidated: false,
    },
  }
}
