import { describe, expect, test } from "vitest"

import {
  invalidConversationalStepFixtures,
  invalidFinalItineraryFixtures,
  validConversationalStepFixture,
  validFinalItineraryFixture,
} from "@/lib/ai/fixtures"
import {
  parseConversationalStepResponse,
  parseFinalItineraryResponse,
  type FinalItineraryResponse,
} from "@/lib/ai/contract"
import { validateItineraryDuration } from "@/lib/ai/itinerary"

describe("AI runtime validators", () => {
  test("accepts a valid conversational step response", () => {
    const result = parseConversationalStepResponse(
      validConversationalStepFixture
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.nextUISelector).toBe("duration")
    }
  })

  test("rejects an invalid conversational UI selector", () => {
    const result = parseConversationalStepResponse(
      invalidConversationalStepFixtures[0]
    )

    expect(result.ok).toBe(false)
  })

  test("accepts a schema-valid final itinerary response", () => {
    const result = parseFinalItineraryResponse(validFinalItineraryFixture)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.travelPlan.destination).toBe("Tokyo")
    }
  })

  test("rejects malformed final itinerary shapes", () => {
    for (const fixture of invalidFinalItineraryFixtures) {
      expect(parseFinalItineraryResponse(fixture).ok).toBe(false)
    }
  })

  test("rejects a final itinerary whose day count does not match duration", () => {
    const parsed = parseFinalItineraryResponse(validFinalItineraryFixture)

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    expect(validateItineraryDuration(parsed.data, 3).ok).toBe(false)
  })

  test("accepts a final itinerary whose day count matches duration", () => {
    const itinerary = {
      ...validFinalItineraryFixture,
      travelPlan: {
        ...validFinalItineraryFixture.travelPlan,
        durationDays: 1,
      },
    } satisfies FinalItineraryResponse

    expect(validateItineraryDuration(itinerary, 1).ok).toBe(true)
  })
})
