import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import { parseFinalItineraryResponse } from "@/lib/ai/contract"
import {
  groqFinalItineraryWireSchema,
  normalizeGroqFinalItineraryWire,
} from "@/lib/ai/groq-final-schema"
import { getGroqFinalMaxCompletionTokens } from "@/lib/ai/groq"
import { validateItineraryDuration } from "@/lib/ai/itinerary"
import { toStoredFinalItineraryPayload } from "@/lib/ai/itinerary-storage"
import {
  buildGroqFinalMessages,
  completeOneDayWireFixture,
  getFullSchemaAudit,
  getOneDayTokenBudgetAnalysis,
  inspectValidatedItinerary,
  oneDayExperimentalCompletionBudget,
  oneDayRequirements,
  readOneDayDiagnosticRecords,
  validateStrictSchemaValue,
  writeOneDayDiagnosticRecord,
  type OneDayDiagnosticRecord,
} from "@/tests/helpers/groq-final-one-day"

describe("Step 4A.3 full final schema offline validation", () => {
  test("audits the complete existing wire schema without unsupported constructs", () => {
    expect(getFullSchemaAudit()).toMatchObject({
      objectNodes: 8,
      anyOfBranches: 3,
      unsupportedKeywords: [],
      structuralProblems: [],
    })
  })

  test("validates a realistic full one-day wire fixture", () => {
    expect(
      validateStrictSchemaValue(
        groqFinalItineraryWireSchema,
        completeOneDayWireFixture
      )
    ).toEqual({ ok: true })

    const placeKinds = completeOneDayWireFixture.itinerary[0].activities.map(
      (activity) => activity.place.kind
    )
    expect(placeKinds).toEqual([
      "transport",
      "specific_place",
      "generic_activity",
    ])
  })

  test("rejects missing wire properties and unknown provider metadata", () => {
    const missingSummary = structuredClone(completeOneDayWireFixture) as Record<
      string,
      unknown
    >
    delete missingSummary.summary
    expect(
      validateStrictSchemaValue(groqFinalItineraryWireSchema, missingSummary)
    ).toMatchObject({ ok: false })

    const providerMetadata = structuredClone(completeOneDayWireFixture)
    Object.assign(providerMetadata.itinerary[0].activities[1].place, {
      providerPlaceId: "must-not-pass",
    })
    expect(
      validateStrictSchemaValue(groqFinalItineraryWireSchema, providerMetadata)
    ).toMatchObject({ ok: false })
  })

  test("normalizes nullable placeholders and preserves meaningful activity data", () => {
    const normalized = normalizeGroqFinalItineraryWire(
      completeOneDayWireFixture
    )
    const parsed = parseFinalItineraryResponse(normalized)

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    expect(parsed.data.hotels[0]).not.toHaveProperty("address")
    expect(parsed.data.hotels[1]).not.toHaveProperty("area")
    expect(parsed.data.hotels[1]).not.toHaveProperty("priceTier")
    expect(parsed.data.itinerary[0]?.activities[2]).not.toHaveProperty(
      "duration"
    )
    expect(
      parsed.data.itinerary[0]?.activities.map((activity) => activity.title)
    ).toEqual([
      "Travel to Cox's Bazar",
      "Walk at Laboni Beach",
      "Try a local seafood dinner",
    ])
  })

  test("supports fully nullable optional wire values", () => {
    const nullableWire = {
      ...structuredClone(completeOneDayWireFixture),
      travelPlan: {
        ...completeOneDayWireFixture.travelPlan,
        groupType: null,
      },
      practicalNotes: null,
      itinerary: completeOneDayWireFixture.itinerary.map((day) => ({
        ...day,
        activities: day.activities.map((activity, index) =>
          index === 0
            ? { ...activity, timeOfDay: null, duration: null }
            : activity
        ),
      })),
    }

    expect(
      validateStrictSchemaValue(groqFinalItineraryWireSchema, nullableWire)
    ).toEqual({ ok: true })

    const parsed = parseFinalItineraryResponse(
      normalizeGroqFinalItineraryWire(nullableWire)
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.travelPlan).not.toHaveProperty("groupType")
      expect(parsed.data).not.toHaveProperty("practicalNotes")
      expect(parsed.data.itinerary[0]?.activities[0]).not.toHaveProperty(
        "timeOfDay"
      )
    }
  })

  test("passes the application parser, duration validator, and storage transform", () => {
    const parsed = parseFinalItineraryResponse(
      normalizeGroqFinalItineraryWire(completeOneDayWireFixture)
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const duration = validateItineraryDuration(parsed.data, 1)
    expect(duration.ok).toBe(true)
    if (!duration.ok) {
      return
    }

    expect(inspectValidatedItinerary(duration.data)).toEqual({
      actualDayCount: 1,
      requiredContentValid: true,
      placeObjectsValid: true,
      forbiddenMetadataAbsent: true,
      storageTransformationCompatible: true,
      reasonablyCoherent: true,
    })
    expect(toStoredFinalItineraryPayload(duration.data)).toMatchObject({
      travelPlan: { durationDays: 1 },
      itinerary: [
        {
          activities: [
            expect.not.objectContaining({ place: expect.anything() }),
            { place: { placeName: "Laboni Beach" } },
            expect.not.objectContaining({ place: expect.anything() }),
          ],
        },
      ],
    })
  })

  test("rejects wrong duration after successful schema and application parsing", () => {
    const parsed = parseFinalItineraryResponse(
      normalizeGroqFinalItineraryWire(completeOneDayWireFixture)
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(validateItineraryDuration(parsed.data, 2)).toMatchObject({
        ok: false,
      })
    }
  })
})

describe("Step 4A.3 one-day request and reporting safety", () => {
  test("uses the isolated prompt and a bounded test-only budget", () => {
    const messages = buildGroqFinalMessages(oneDayRequirements)
    const analysis = getOneDayTokenBudgetAnalysis()

    expect(messages).toHaveLength(2)
    expect(messages[1]?.content).toContain("Source: Dhaka")
    expect(messages[1]?.content).toContain("Destination: Cox's Bazar")
    expect(getGroqFinalMaxCompletionTokens(1)).toBe(1_700)
    expect(oneDayExperimentalCompletionBudget).toBe(3_500)
    expect(analysis.selectedCompletionBudget).toBeLessThan(
      analysis.evidencedAccountTokenLimitPerMinute
    )
    expect(
      analysis.estimatedInputTokens + analysis.selectedCompletionBudget
    ).toBeLessThan(analysis.evidencedAccountTokenLimitPerMinute)
  })

  test("writes and parses exactly one sanitized diagnostic record", () => {
    const reportPath = join(
      mkdtempSync(join(tmpdir(), "groq-final-day-")),
      "report.jsonl"
    )
    const record = successfulRecord()

    writeOneDayDiagnosticRecord(reportPath, record)
    expect(readOneDayDiagnosticRecords(reportPath)).toEqual([record])
    expect(() => writeOneDayDiagnosticRecord(reportPath, record)).toThrow()

    const serialized = JSON.stringify(record)
    expect(serialized).not.toContain("apiKey")
    expect(serialized).not.toContain("Authorization")
    expect(serialized).not.toContain("reasoning")
    expect(serialized).not.toContain("Hotel Sea Crown")
  })
})

function successfulRecord(): OneDayDiagnosticRecord {
  return {
    runIdentifier: "step4a3-one-day-run-1",
    modelIdentifier: "openai/gpt-oss-20b",
    requestedDurationDays: 1,
    selectedCompletionBudget: 3_500,
    httpStatus: 200,
    providerErrorType: null,
    providerErrorCode: null,
    finishReason: "stop",
    inputTokens: 1_500,
    outputTokens: 1_100,
    totalTokens: 2_600,
    latencyMs: 1_000,
    jsonParseValid: true,
    wireSchemaValid: true,
    normalizationValid: true,
    applicationSchemaValid: true,
    durationValid: true,
    actualDayCount: 1,
    requiredContentValid: true,
    placeObjectsValid: true,
    forbiddenMetadataAbsent: true,
    storageTransformationCompatible: true,
    reasonablyCoherent: true,
    rateLimit: {
      limitTokensPerMinute: 8_000,
      remainingTokens: 5_400,
      resetTokensSeconds: 20,
    },
    sanitizedErrorClassification: "ONE_DAY_FINAL_GENERATION_ACCEPTED",
    retryCount: 0,
  }
}
