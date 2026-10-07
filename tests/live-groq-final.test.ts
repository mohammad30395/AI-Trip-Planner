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
  test("performs exactly one one-day final diagnostic", async () => {
    expect(process.env.GROQ_MODEL).toBe("openai/gpt-oss-20b")

    const availability = await checkGroqModelAvailability()
    console.info("Groq live final model precheck", {
      configured: Boolean(process.env.GROQ_MODEL?.trim()),
      accessible: availability.ok && availability.data.accessible,
      code: availability.ok ? undefined : availability.code,
    })
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
      maxCompletionTokens: getGroqFinalMaxCompletionTokens(1),
    })

    if (!oneDay.ok) {
      console.info("Groq live final Test A", {
        result: "failed",
        code: oneDay.code,
        ...oneDay.diagnostic,
      })
      expect(oneDay.ok).toBe(true)
      return
    }

    validateLiveItinerary(oneDay.data.response, 1)
    console.info("Groq live final Test A", {
      result: "passed",
      ...oneDay.data.diagnostic,
      inputTokens: oneDay.data.usage?.inputTokens,
      outputTokens: oneDay.data.usage?.outputTokens,
      totalTokens: oneDay.data.usage?.totalTokens,
      tokenLimitPerMinute: oneDay.data.rateLimit?.limitTokensPerMinute,
      remainingTokens: oneDay.data.rateLimit?.remainingTokens,
      resetTokensSeconds: oneDay.data.rateLimit?.resetTokensSeconds,
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
  destination: "Cox's Bazar",
  durationDays: 1,
  budgetTier: "mid-range",
  groupSize: 2,
  groupType: "couple",
} satisfies FinalItineraryRequirements
