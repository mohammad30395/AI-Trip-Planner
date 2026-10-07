import { describe, expect, test } from "vitest"

import {
  checkGroqModelAvailability,
  getGroqFinalMaxCompletionTokens,
  runGroqFinalItinerary,
  type GroqConversationMessage,
} from "@/lib/ai/groq"
import type { FinalItineraryResponse } from "@/lib/ai/contract"
import type { FinalItineraryRequirements } from "@/lib/ai/itinerary"

const runLiveFinal = process.env.RUN_LIVE_GROQ_FINAL === "1"

describe.skipIf(!runLiveFinal)("live isolated Groq final itinerary", () => {
  test("validates one day and conditionally validates three days", async () => {
    expect(process.env.GROQ_MODEL).toBe("openai/gpt-oss-20b")

    const availability = await checkGroqModelAvailability()
    expect(availability).toMatchObject({
      ok: true,
      data: { accessible: true },
    })

    if (!availability.ok) {
      return
    }

    const oneDay = await runGroqFinalItinerary({
      messages: buildGroqFinalMessages(oneDayRequirements),
      durationDays: 1,
    })

    if (!oneDay.ok) {
      console.info("Groq live final Test A", {
        result: "failed",
        code: oneDay.code,
        retryAfterSeconds: oneDay.retryAfterSeconds,
        rateLimited: oneDay.code === "rate_limited",
      })
      expect(oneDay.ok).toBe(true)
      return
    }

    validateLiveItinerary(oneDay.data.response, 1)
    console.info("Groq live final Test A", {
      result: "passed",
      strictSchemaAccepted: true,
      jsonParsed: true,
      wireNormalized: true,
      runtimeValidated: true,
      durationValidated: true,
      inputTokens: oneDay.data.usage?.inputTokens,
      outputTokens: oneDay.data.usage?.outputTokens,
      totalTokens: oneDay.data.usage?.totalTokens,
      tokenLimitPerMinute: oneDay.data.rateLimit?.limitTokensPerMinute,
      remainingTokens: oneDay.data.rateLimit?.remainingTokens,
      rateLimited: false,
    })

    const remainingTokens = oneDay.data.rateLimit?.remainingTokens
    const conservativeThreeDayAllowance =
      (oneDay.data.usage?.inputTokens ?? 2_000) +
      getGroqFinalMaxCompletionTokens(3)

    if (
      remainingTokens === undefined ||
      remainingTokens < conservativeThreeDayAllowance
    ) {
      console.info("TEST_B_DEFERRED_RATE_LIMIT_SAFETY", {
        remainingTokensKnown: remainingTokens !== undefined,
        requiredAllowance: conservativeThreeDayAllowance,
      })
      return
    }

    const threeDay = await runGroqFinalItinerary({
      messages: buildGroqFinalMessages(threeDayRequirements),
      durationDays: 3,
    })

    if (!threeDay.ok && threeDay.code === "rate_limited") {
      console.info("TEST_B_DEFERRED_RATE_LIMIT_SAFETY", {
        rateLimited: true,
        retryAfterSeconds: threeDay.retryAfterSeconds,
      })
      return
    }

    if (!threeDay.ok) {
      console.info("Groq live final Test B", {
        result: "failed",
        code: threeDay.code,
        retryAfterSeconds: threeDay.retryAfterSeconds,
        rateLimited: false,
      })
      expect(threeDay.ok).toBe(true)
      return
    }

    validateLiveItinerary(threeDay.data.response, 3)
    console.info("Groq live final Test B", {
      result: "passed",
      strictSchemaAccepted: true,
      jsonParsed: true,
      wireNormalized: true,
      runtimeValidated: true,
      durationValidated: true,
      inputTokens: threeDay.data.usage?.inputTokens,
      outputTokens: threeDay.data.usage?.outputTokens,
      totalTokens: threeDay.data.usage?.totalTokens,
      tokenLimitPerMinute: threeDay.data.rateLimit?.limitTokensPerMinute,
      remainingTokens: threeDay.data.rateLimit?.remainingTokens,
      rateLimited: false,
    })
  }, 120_000)
})

function buildGroqFinalMessages(
  requirements: FinalItineraryRequirements
): GroqConversationMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a practical trip itinerary generator.",
        "Return only the strict groq_final_itinerary_wire_response JSON Schema.",
        "Echo the normalized travelPlan exactly from the user request.",
        "The itinerary array must contain exactly one day object per requested duration day, with sequential dayNumber values starting at 1.",
        "Each day must include useful activities with timeWindow, timeOfDay when helpful, duration, concise semantic descriptions, and explicit place semantics.",
        "For every activity, set place.kind to specific_place, generic_activity, or transport.",
        "Use specific_place only for a real named attraction, venue, restaurant, hotel, station, terminal, or other searchable place. Put the exact proper place name in place.name and useful area/address hints when known.",
        "Use generic_activity for actions without a named venue. Use transport for transfers or route movements.",
        "The strict wire schema requires nullable optional fields to be present: use null when groupType, hotel details, activity timing details, practicalNotes, or place text hints are not applicable or unknown.",
        "For generic_activity and transport, set place.name to null. Put useful origin and destination text on transport when known.",
        "Include 2 to 4 hotel recommendations with generated estimatedPriceText.",
        "Keep the summary, descriptions, and practical notes concise and avoid duplicate prose.",
        "Use estimatedPriceText for generated cost guidance only; do not claim exact prices, ratings, business availability, opening hours, or verified coordinates.",
        "Never invent precise coordinates, provider place IDs, image URLs, photos, ratings, or availability. Provider enrichment will verify canonical place data later.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        "Generate a final itinerary from these normalized requirements.",
        `Source: ${requirements.source}`,
        `Destination: ${requirements.destination}`,
        `Duration days: ${requirements.durationDays}`,
        `Budget tier: ${requirements.budgetTier}`,
        `Group size: ${requirements.groupSize}`,
        `Group type: ${requirements.groupType}`,
      ].join("\n"),
    },
  ]
}

function validateLiveItinerary(
  itinerary: FinalItineraryResponse,
  durationDays: number
) {
  expect(itinerary.itinerary).toHaveLength(durationDays)
  expect(itinerary.itinerary.map((day) => day.dayNumber)).toEqual(
    Array.from({ length: durationDays }, (_, index) => index + 1)
  )
  expect(itinerary.itinerary.every((day) => day.activities.length > 0)).toBe(true)
  expect(itinerary.hotels.length).toBeGreaterThanOrEqual(2)
  expect(itinerary.hotels.length).toBeLessThanOrEqual(4)

  const serialized = JSON.stringify(itinerary)
  for (const forbiddenField of [
    "providerPlaceId",
    "providerId",
    "latitude",
    "longitude",
    "imageUrl",
    "rating",
    "availability",
  ]) {
    expect(serialized).not.toContain(`\"${forbiddenField}\"`)
  }
}

const oneDayRequirements = {
  source: "Dhaka",
  destination: "Sylhet",
  durationDays: 1,
  budgetTier: "mid-range",
  groupSize: 2,
  groupType: "couple",
} satisfies FinalItineraryRequirements

const threeDayRequirements = {
  source: "Dhaka",
  destination: "Tokyo",
  durationDays: 3,
  budgetTier: "mid-range",
  groupSize: 2,
  groupType: "couple",
} satisfies FinalItineraryRequirements
