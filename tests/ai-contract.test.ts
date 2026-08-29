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
  type ItineraryActivity,
} from "@/lib/ai/contract"
import {
  getFinalItineraryMaxTokensForDuration,
  parseFinalItineraryResponseEnvelope,
  validateItineraryDuration,
} from "@/lib/ai/itinerary"
import { toStoredFinalItineraryPayload } from "@/lib/ai/itinerary-storage"
import { buildTripPresentation } from "@/lib/trips/presentation"

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

  test("accepts specific landmark, hotel, and restaurant activity semantics", () => {
    const result = parseFinalItineraryResponse(
      itineraryWithActivities([
        specificPlaceActivity("Visit Ratargul Swamp Forest", "Ratargul Swamp Forest"),
        specificPlaceActivity("Check in at Hotel Noorjahan Grand", "Hotel Noorjahan Grand"),
        specificPlaceActivity("Dinner at Panshi Restaurant", "Panshi Restaurant"),
      ])
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(
        result.data.itinerary[0]?.activities.map((activity) => activity.place?.kind)
      ).toEqual(["specific_place", "specific_place", "specific_place"])
    }
  })

  test("accepts generic lunch, hotel check-in, and free-time semantics without place names", () => {
    const result = parseFinalItineraryResponse(
      itineraryWithActivities([
        genericActivity("Lunch at local eatery"),
        genericActivity("Check-in and freshen up"),
        genericActivity("Free time"),
      ])
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(
        result.data.itinerary[0]?.activities.map((activity) => activity.place)
      ).toEqual([
        expect.objectContaining({ kind: "generic_activity", name: null }),
        expect.objectContaining({ kind: "generic_activity", name: null }),
        expect.objectContaining({ kind: "generic_activity", name: null }),
      ])
    }
  })

  test("accepts intercity transport semantics without turning the route into a POI", () => {
    const result = parseFinalItineraryResponse(
      itineraryWithActivities([
        {
          ...genericActivity("Travel from Dhaka to Sylhet"),
          place: {
            kind: "transport",
            name: null,
            addressHint: null,
            areaHint: null,
            originHint: "Dhaka",
            destinationHint: "Sylhet",
          },
        },
      ])
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.itinerary[0]?.activities[0]?.place).toEqual({
        kind: "transport",
        name: null,
        addressHint: null,
        areaHint: null,
        originHint: "Dhaka",
        destinationHint: "Sylhet",
      })
    }
  })

  test("rejects malformed final itinerary shapes", () => {
    for (const fixture of invalidFinalItineraryFixtures) {
      expect(parseFinalItineraryResponse(fixture).ok).toBe(false)
    }
  })

  test("rejects malformed activity place semantics", () => {
    const malformedResponses = [
      itineraryWithActivities([
        {
          ...genericActivity("Visit Ratargul Swamp Forest"),
          place: {
            kind: "specific_place",
            name: null,
            addressHint: null,
            areaHint: null,
            originHint: null,
            destinationHint: null,
          },
        },
      ]),
      itineraryWithActivities([
        {
          ...genericActivity("Lunch at local eatery"),
          place: {
            kind: "generic_activity",
            name: "Invented Lunch Spot",
            addressHint: null,
            areaHint: null,
            originHint: null,
            destinationHint: null,
          },
        },
      ]),
      itineraryWithMalformedActivityPlace({
        kind: "specific_place",
        name: "Ratargul Swamp Forest",
        addressHint: null,
        areaHint: null,
        originHint: null,
        destinationHint: null,
        providerPlaceId: "provider-id",
      }),
    ]

    for (const response of malformedResponses) {
      expect(parseFinalItineraryResponse(response).ok).toBe(false)
    }
  })

  test("stores only schema-compatible place hints without AI canonical data", () => {
    const payload = toStoredFinalItineraryPayload(
      itineraryWithActivities([
        specificPlaceActivity("Visit Ratargul Swamp Forest", "Ratargul Swamp Forest"),
        genericActivity("Lunch at local eatery"),
        {
          ...genericActivity("Travel from Dhaka to Sylhet"),
          place: {
            kind: "transport",
            name: null,
            addressHint: null,
            areaHint: null,
            originHint: "Dhaka",
            destinationHint: "Sylhet",
          },
        },
      ])
    )

    expect(payload.itinerary[0]?.activities.map((activity) => activity.place)).toEqual([
      { placeName: "Ratargul Swamp Forest", approximateArea: "Sylhet" },
      undefined,
      undefined,
    ])
  })

  test("malformed AI output never becomes a Convex save payload", () => {
    const parsed = parseFinalItineraryResponse(
      itineraryWithMalformedActivityPlace({
        kind: "specific_place",
        addressHint: "Sylhet",
      })
    )

    expect(parsed.ok).toBe(false)
  })

  test("distinguishes provider and schema-validation failure envelope codes", () => {
    expect(
      parseFinalItineraryResponseEnvelope({
        ok: false,
        error: "Final itinerary generation failed.",
        code: "provider_timeout",
      })
    ).toMatchObject({
      ok: false,
      code: "provider_timeout",
    })

    expect(
      parseFinalItineraryResponseEnvelope({
        ok: false,
        error: "Final itinerary generation failed.",
        code: "schema_validation",
      })
    ).toMatchObject({
      ok: false,
      code: "schema_validation",
    })
  })

  test("normalizes legacy saved place hints into readable presentation semantics", () => {
    const result = buildTripPresentation({
      _id: "trip-1",
      source: "Dhaka",
      destination: "Sylhet",
      durationDays: 1,
      budget: "budget",
      groupSize: 2,
      groupType: "family",
      enrichmentStatus: "not_started",
      createdAt: Date.UTC(2026, 7, 28),
      generatedTripPayload: {
        ...validFinalItineraryFixture,
        travelPlan: {
          ...validFinalItineraryFixture.travelPlan,
          destination: "Sylhet",
          durationDays: 1,
        },
        itinerary: [
          {
            dayNumber: 1,
            title: "Legacy saved payload",
            activities: [
              {
                title: "Visit Ratargul Swamp Forest",
                description: "Visit Ratargul Swamp Forest.",
                timeWindow: "Morning",
                estimatedPriceText: "Generated estimate.",
                place: {
                  placeName: "Ratargul Swamp Forest",
                  approximateArea: "Sylhet",
                },
              },
              {
                title: "Travel from Dhaka to Sylhet",
                description: "Take the bus to Sylhet.",
                timeWindow: "Morning",
                estimatedPriceText: "Generated estimate.",
              },
            ],
          },
        ],
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.days[0]?.activities.map((activity) => activity.place.kind))
        .toEqual(["specific_place", "transport"])
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

  test("validates 1-day, 3-day, and 7-day itinerary durations", () => {
    expect(
      validateItineraryDuration(itineraryWithDayCount(1), 1).ok
    ).toBe(true)
    expect(
      validateItineraryDuration(itineraryWithDayCount(3), 3).ok
    ).toBe(true)
    expect(
      validateItineraryDuration(itineraryWithDayCount(7), 7).ok
    ).toBe(true)
  })

  test("keeps 7-day output within the supported final-generation token budget", () => {
    expect(getFinalItineraryMaxTokensForDuration(1)).toBe(6_100)
    expect(getFinalItineraryMaxTokensForDuration(3)).toBe(7_900)
    expect(getFinalItineraryMaxTokensForDuration(7)).toBe(8_000)
  })
})

function itineraryWithActivities(
  activities: ItineraryActivity[]
): FinalItineraryResponse {
  return {
    ...validFinalItineraryFixture,
    travelPlan: {
      ...validFinalItineraryFixture.travelPlan,
      destination: "Sylhet",
      durationDays: 1,
    },
    itinerary: [
      {
        dayNumber: 1,
        title: "Structured place semantics",
        activities,
      },
    ],
  }
}

function itineraryWithDayCount(dayCount: number): FinalItineraryResponse {
  return {
    ...validFinalItineraryFixture,
    travelPlan: {
      ...validFinalItineraryFixture.travelPlan,
      durationDays: dayCount,
    },
    itinerary: Array.from({ length: dayCount }, (_, index) => ({
      dayNumber: index + 1,
      title: `Day ${index + 1}`,
      activities: [
        genericActivity(`Free time day ${index + 1}`),
      ],
    })),
  }
}

function specificPlaceActivity(
  title: string,
  name: string
): ItineraryActivity {
  return {
    title,
    description: `${title}.`,
    timeWindow: "Morning",
    duration: "2 hours",
    estimatedPriceText: "Generated estimate.",
    place: {
      kind: "specific_place",
      name,
      addressHint: null,
      areaHint: "Sylhet",
      originHint: null,
      destinationHint: null,
    },
  }
}

function genericActivity(title: string): ItineraryActivity {
  return {
    title,
    description: `${title}.`,
    timeWindow: "Flexible",
    duration: "1 hour",
    estimatedPriceText: "Generated estimate.",
    place: {
      kind: "generic_activity",
      name: null,
      addressHint: null,
      areaHint: null,
      originHint: null,
      destinationHint: null,
    },
  }
}

function itineraryWithMalformedActivityPlace(place: Record<string, unknown>) {
  return {
    ...validFinalItineraryFixture,
    travelPlan: {
      ...validFinalItineraryFixture.travelPlan,
      destination: "Sylhet",
      durationDays: 1,
    },
    itinerary: [
      {
        dayNumber: 1,
        title: "Malformed place semantics",
        activities: [
          {
            title: "Visit Ratargul Swamp Forest",
            description: "Visit Ratargul Swamp Forest.",
            timeWindow: "Morning",
            estimatedPriceText: "Generated estimate.",
            place,
          },
        ],
      },
    ],
  }
}
