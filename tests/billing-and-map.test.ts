import { describe, expect, test } from "vitest"

import { getTripGenerationAccessStatus } from "@/lib/billing/trip-generation-access"
import {
  rankGeoapifyCandidates,
  type DestinationContext,
  type GeoapifyCandidate,
} from "@/lib/places/geoapify"
import {
  CANONICAL_PLACE_ZOOM,
  GLOBAL_FALLBACK_CENTER,
  GLOBAL_FALLBACK_ZOOM,
  OSM_STANDARD_TILE_URL,
  buildTripMapLookups,
  buildMappablePlaces,
  buildTripMarkerData,
  isValidMapLocation,
  selectTripMapInitialView,
  type TripMapEnrichedLookup,
  type TripMappablePlace,
} from "@/lib/trips/map"
import { getGeoapifyAttribution } from "@/lib/places/place-enrichment"
import type { TripPresentationData } from "@/lib/trips/presentation"

describe("billing access decisions", () => {
  test("enforces quota for free users", () => {
    expect(getTripGenerationAccessStatus(false)).toEqual({
      tier: "free",
      quotaEnforced: true,
    })
  })

  test("bypasses quota for premium users", () => {
    expect(getTripGenerationAccessStatus(true)).toEqual({
      tier: "premium",
      quotaEnforced: false,
    })
  })
})

describe("map normalization and Leaflet-facing config", () => {
  test("uses fixed HTTPS OpenStreetMap tile configuration", () => {
    expect(OSM_STANDARD_TILE_URL).toBe(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    )
    expect(OSM_STANDARD_TILE_URL.startsWith("https://")).toBe(true)
  })

  test("deduplicates by providerPlaceId and skips invalid coordinates", () => {
    const places = buildMappablePlaces([
      enrichedLookup("one", "place-1", 35, 139),
      enrichedLookup("duplicate", "place-1", 36, 140),
      enrichedLookup("bad", "place-2", Number.NaN, 140),
    ])

    expect(places).toHaveLength(1)
    expect(places[0]?.providerPlaceId).toBe("place-1")
  })

  test("selects canonical center when a verified place exists", () => {
    const places = [mappablePlace("place-1", 35.6, 139.7)]

    expect(selectTripMapInitialView(places)).toEqual({
      center: {
        lat: 35.6,
        lng: 139.7,
      },
      zoom: CANONICAL_PLACE_ZOOM,
      source: "canonical-place",
    })
  })

  test("selects documented global fallback when no verified place exists", () => {
    expect(selectTripMapInitialView([])).toEqual({
      center: GLOBAL_FALLBACK_CENTER,
      zoom: GLOBAL_FALLBACK_ZOOM,
      source: "global-fallback",
    })
  })

  test("builds marker data and safe popup text model without HTML strings", () => {
    const markerData = buildTripMarkerData([
      mappablePlace("<script>alert(1)</script>", 35, 139),
    ])

    expect(markerData).toEqual([
      {
        providerPlaceId: "<script>alert(1)</script>",
        position: {
          lat: 35,
          lng: 139,
        },
        title: "Place <b>Name</b>",
        popup: {
          title: "Place <b>Name</b>",
          dayLabel: "Day 1",
          formattedAddress: "1 Test Street <img>",
        },
      },
    ])
  })

  test("validates coordinate ranges", () => {
    expect(isValidMapLocation({ lat: 90, lng: 180 })).toBe(true)
    expect(isValidMapLocation({ lat: 91, lng: 0 })).toBe(false)
    expect(isValidMapLocation({ lat: 0, lng: -181 })).toBe(false)
  })

  test("does not build canonical lookup requests for generic activities", () => {
    const lookups = buildTripMapLookups({
      ...baseTrip,
      days: [
        {
          id: "day-1",
          dayNumber: 1,
          title: "Arrival",
          activities: [
            {
              id: "activity-1",
              title: "Lunch",
              description: "Eat near the hotel.",
              timeLabel: "12:00",
              timeOfDayLabel: "Afternoon",
              duration: "1 hour",
              estimatedPriceText: "Generated estimate",
              placeName: "Lunch at local eatery",
              address: null,
              approximateArea: "Sylhet",
            },
          ],
        },
      ],
    })

    expect(lookups).toHaveLength(0)
  })

  test("Dhaka to Sylhet smoke keeps local markers inside destination geography", () => {
    const lookups = buildTripMapLookups({
      ...baseTrip,
      durationLabel: "3 days",
      hotels: [
        {
          id: "hotel-1",
          name: "Hotel Supreme",
          description: "Hotel in central Sylhet.",
          area: "Zindabazar",
          address: null,
          priceTierLabel: "Budget",
          estimatedPriceText: "Generated estimate",
        },
      ],
      days: [
        {
          id: "day-1",
          dayNumber: 1,
          title: "Arrival",
          activities: [
            {
              id: "activity-1",
              title: "Ratargul visit",
              description: "Visit Ratargul Swamp Forest.",
              timeLabel: "Morning",
              timeOfDayLabel: "Morning",
              duration: "3 hours",
              estimatedPriceText: "Generated estimate",
              placeName: "Ratargul Swamp Forest",
              address: null,
              approximateArea: "Sylhet",
            },
            {
              id: "activity-2",
              title: "Lunch",
              description: "Eat near the hotel.",
              timeLabel: "Afternoon",
              timeOfDayLabel: "Afternoon",
              duration: "1 hour",
              estimatedPriceText: "Generated estimate",
              placeName: "Lunch at local eatery",
              address: null,
              approximateArea: "Sylhet",
            },
          ],
        },
      ],
    })
    const destinationContext = {
      query: "Sylhet",
      country: "Bangladesh",
      countryCode: "bd",
      location: {
        lat: 24.8949,
        lng: 91.8687,
      },
    } satisfies DestinationContext
    const acceptedLookups = lookups.flatMap((lookup) => {
      const ranking = rankGeoapifyCandidates({
        request: lookup.request,
        destinationContext,
        candidates:
          lookup.request.query === "Hotel Supreme"
            ? [
                geoCandidate({
                  providerPlaceId: "north-america-hotel",
                  displayName: "Hotel Supreme",
                  formattedAddress: "Hotel Supreme, Toronto, Canada",
                  countryCode: "ca",
                  country: "Canada",
                  city: "Toronto",
                  category: "accommodation.hotel",
                  location: {
                    lat: 43.6532,
                    lng: -79.3832,
                  },
                }),
              ]
            : [
                geoCandidate({
                  providerPlaceId: "ratargul",
                  displayName: "Ratargul Swamp Forest",
                  formattedAddress: "Ratargul Swamp Forest, Sylhet, Bangladesh",
                  countryCode: "bd",
                  country: "Bangladesh",
                  city: "Sylhet",
                  category: "tourism.sights",
                }),
              ],
      })

      if (ranking.status === "no_confident_match") {
        return []
      }

      return {
        lookup,
        place: {
          provider: "geoapify",
          providerPlaceId: ranking.candidate.providerPlaceId,
          displayName: ranking.candidate.displayName,
          formattedAddress: ranking.candidate.formattedAddress,
          location: ranking.candidate.location,
          attribution: getGeoapifyAttribution(),
          matchStatus: ranking.status,
          matchScore: ranking.score,
          matchedQuery: ranking.matchedQuery,
        },
      } satisfies TripMapEnrichedLookup
    })
    const markers = buildTripMarkerData(buildMappablePlaces(acceptedLookups))

    expect(lookups.map((lookup) => lookup.request.query)).toEqual([
      "Hotel Supreme",
      "Ratargul Swamp Forest",
    ])
    expect(markers).toHaveLength(1)
    expect(markers[0]?.position.lat).toBeGreaterThan(24)
    expect(markers[0]?.position.lat).toBeLessThan(26)
    expect(markers[0]?.position.lng).toBeGreaterThan(91)
    expect(markers[0]?.position.lng).toBeLessThan(93)
  })
})

function enrichedLookup(
  lookupId: string,
  providerPlaceId: string,
  lat: number,
  lng: number
): TripMapEnrichedLookup {
  return {
    lookup: {
      id: lookupId,
      label: "Lookup",
      dayLabel: "Day 1",
      request: {
        query: "Lookup",
        destination: "Tokyo",
      },
    },
    place: {
      provider: "geoapify",
      providerPlaceId,
      displayName: "Place",
      formattedAddress: "1 Test Street",
      location: {
        lat,
        lng,
      },
      attribution: getGeoapifyAttribution(),
      matchStatus: "verified",
      matchedQuery: "Lookup, Tokyo",
    },
  }
}

function mappablePlace(
  providerPlaceId: string,
  lat: number,
  lng: number
): TripMappablePlace {
  return {
    lookupId: "lookup",
    providerPlaceId,
    displayName: "Place <b>Name</b>",
    formattedAddress: "1 Test Street <img>",
    dayLabel: "Day 1",
    location: {
      lat,
      lng,
    },
  }
}

function geoCandidate(overrides: Partial<GeoapifyCandidate>): GeoapifyCandidate {
  return {
    providerPlaceId: "candidate",
    displayName: "Candidate",
    formattedAddress: "Candidate, Sylhet, Bangladesh",
    location: {
      lat: 24.8949,
      lng: 91.8687,
    },
    resultType: "amenity",
    rankConfidence: 1,
    rankMatchType: "full_match",
    ...overrides,
  }
}

const baseTrip = {
  tripId: "trip",
  source: "Dhaka",
  destination: "Sylhet",
  durationLabel: "3 days",
  budgetLabel: "Budget",
  groupLabel: "1 traveler",
  groupTypeLabel: null,
  createdLabel: "Aug 28, 2026",
  enrichmentLabel: "Not started",
  summary: "Trip summary",
  hotels: [],
  days: [],
  practicalNotes: [],
} satisfies TripPresentationData
