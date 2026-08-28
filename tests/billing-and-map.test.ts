import { describe, expect, test } from "vitest"

import { getTripGenerationAccessStatus } from "@/lib/billing/trip-generation-access"
import {
  CANONICAL_PLACE_ZOOM,
  GLOBAL_FALLBACK_CENTER,
  GLOBAL_FALLBACK_ZOOM,
  OSM_STANDARD_TILE_URL,
  buildTripMapPoints,
  buildTripMapLookups,
  buildTripMarkerData,
  getTripMapBounds,
  isValidMapLocation,
  selectTripMapInitialView,
  type TripMapEnrichedLookup,
  type TripMapPoint,
  type TripMapPointKind,
} from "@/lib/trips/map"
import { getGeoapifyAttribution } from "@/lib/places/place-enrichment"
import type { PlaceEnrichment } from "@/lib/places/place-enrichment"
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
    const points = buildTripMapPoints({
      enrichedLookups: [
        enrichedLookup("one", "place-1", 35, 139),
        enrichedLookup("duplicate", "place-1", 36, 140),
        enrichedLookup("bad", "place-2", Number.NaN, 140),
      ],
    })

    expect(points).toHaveLength(1)
    expect(points[0]?.providerPlaceId).toBe("place-1")
  })

  test("adds explicit city lookups for origin and destination", () => {
    const lookups = buildTripMapLookups({
      ...baseTrip,
      source: "Dhaka",
      destination: "Sylhet",
    })

    expect(lookups.slice(0, 2)).toEqual([
      {
        id: "origin-dhaka",
        kind: "origin",
        label: "Dhaka",
        request: {
          query: "Dhaka",
          lookupKind: "city",
        },
      },
      {
        id: "destination-sylhet",
        kind: "destination",
        label: "Sylhet",
        request: {
          query: "Sylhet",
          lookupKind: "city",
        },
      },
    ])
  })

  test("selects canonical center when a verified place exists", () => {
    const points = [mapPoint("place-1", 35.6, 139.7)]

    expect(selectTripMapInitialView(points)).toEqual({
      center: {
        lat: 35.6,
        lng: 139.7,
      },
      zoom: CANONICAL_PLACE_ZOOM,
      source: "single-point",
    })
  })

  test("selects documented global fallback when no verified place exists", () => {
    expect(selectTripMapInitialView([])).toEqual({
      center: GLOBAL_FALLBACK_CENTER,
      zoom: GLOBAL_FALLBACK_ZOOM,
      source: "global-fallback",
    })
  })

  test("builds marker data and safe popup text model without raw provider JSON", () => {
    const markerData = buildTripMarkerData([
      {
        ...mapPoint("place-1", 35, 139),
        id: "activity-1",
        kind: "activity",
        label: "Place <b>Name</b>",
        day: 1,
        sequence: 1,
        address: "1 Test Street <img>",
      },
    ])

    expect(markerData).toEqual([
      {
        id: "activity-1",
        kind: "activity",
        markerLabel: "1",
        position: {
          lat: 35,
          lng: 139,
        },
        title: "Place <b>Name</b>",
        visualOffset: {
          x: 0,
          y: 0,
        },
        popup: {
          title: "Place <b>Name</b>",
          typeLabel: "Itinerary stop",
          sequenceLabel: "Stop 1 - Day 1",
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
            "Lunch at local eatery",
            "Check-in and freshen up",
            "Free time",
            "Travel from Dhaka to Sylhet",
          ].map((placeName, index) => ({
            id: `activity-${index}`,
            title: placeName,
            description: "Generic activity text.",
            timeLabel: "12:00",
            timeOfDayLabel: "Afternoon",
            duration: "1 hour",
            estimatedPriceText: "Generated estimate",
            placeName,
            address: null,
            approximateArea: "Sylhet",
          })),
        },
      ],
    })

    expect(lookups.map((lookup) => lookup.kind)).toEqual([
      "origin",
      "destination",
    ])
  })

  test("requires accepted match status before creating mappable places", () => {
    const verified = enrichedLookup("verified", "place-verified", 35, 139)
    const probable = {
      ...enrichedLookup("probable", "place-probable", 36, 140),
      place: {
        ...enrichedLookup("probable", "place-probable", 36, 140).place,
        matchStatus: "probable" as const,
      },
    } satisfies TripMapEnrichedLookup
    const rejected = {
      ...enrichedLookup("rejected", "place-rejected", 37, 141),
      place: {
        ...enrichedLookup("rejected", "place-rejected", 37, 141).place,
        matchStatus: "no_confident_match",
      },
    } as unknown as TripMapEnrichedLookup

    const points = buildTripMapPoints({
      enrichedLookups: [verified, probable, rejected],
    })

    expect(points.map((point) => point.providerPlaceId)).toEqual([
      "place-verified",
      "place-probable",
    ])
  })

  test("Dhaka to Sylhet smoke adds start and destination without North American outliers", () => {
    const lookups = buildTripMapLookups({
      ...baseTrip,
      source: "Dhaka",
      destination: "Sylhet",
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
    const acceptedLookups = lookups.flatMap((lookup) => {
      const place = getDhakaSylhetPlace(lookup)
      if (place === null) {
        return []
      }
      return {
        lookup,
        place,
      } satisfies TripMapEnrichedLookup
    })
    const diagnostics: string[] = []
    const points = buildTripMapPoints({
      enrichedLookups: acceptedLookups,
      onDiagnostic: (diagnostic) => {
        diagnostics.push(diagnostic)
      },
    })
    const markers = buildTripMarkerData(points)
    const bounds = getTripMapBounds(points)

    expect(lookups.map((lookup) => lookup.request.query)).toEqual([
      "Dhaka",
      "Sylhet",
      "Hotel Supreme",
      "Ratargul Swamp Forest",
    ])
    expect(markers.map((marker) => marker.markerLabel)).toEqual(["S", "D", "1"])
    expect(points.some((point) => point.label === "Hotel Supreme")).toBe(false)
    expect(points.some((point) => point.lng < -60)).toBe(false)
    expect(bounds?.southWest.lat).toBeGreaterThan(23)
    expect(bounds?.northEast.lat).toBeLessThan(25.5)
    expect(bounds?.southWest.lng).toBeGreaterThan(90)
    expect(bounds?.northEast.lng).toBeLessThan(92.5)
    expect(diagnostics).toEqual([])
  })

  test("skips gross destination-local outliers before fit bounds", () => {
    const diagnostics: string[] = []
    const points = buildTripMapPoints({
      enrichedLookups: [
        enrichedLookup(
          "destination-sylhet",
          "sylhet",
          24.8949,
          91.8687,
          "destination"
        ),
        enrichedLookup("activity-local", "ratargul", 25.002, 91.975, "activity"),
        enrichedLookup("activity-outlier", "north-america", 43.6532, -79.3832, "activity"),
      ],
      onDiagnostic: (diagnostic) => {
        diagnostics.push(diagnostic)
      },
    })
    const bounds = getTripMapBounds(points)

    expect(points.map((point) => point.providerPlaceId)).toEqual([
      "sylhet",
      "ratargul",
    ])
    expect(bounds?.southWest.lng).toBeGreaterThan(91)
    expect(diagnostics).toEqual(["map-point-outlier-skipped"])
  })

  test("handles one and twenty-plus points with stable bounds", () => {
    const onePoint = [mapPoint("only", 24.9, 91.9)]
    const manyPoints = Array.from({ length: 24 }, (_, index) =>
      mapPoint(`point-${index}`, 24.8 + index * 0.01, 91.8 + index * 0.01)
    )

    expect(getTripMapBounds(onePoint)).toBeNull()
    expect(getTripMapBounds(manyPoints)).toEqual({
      southWest: {
        lat: 24.8,
        lng: 91.8,
      },
      northEast: {
        lat: 25.03,
        lng: 92.03,
      },
    })
  })

  test("keeps very close accepted markers visually addressable without changing coordinates", () => {
    const points: TripMapPoint[] = [
      {
        id: "origin-dhaka",
        kind: "origin",
        label: "Dhaka",
        providerPlaceId: "dhaka",
        lat: 23.7644,
        lng: 90.389,
        address: "Dhaka, Bangladesh",
      },
      {
        id: "destination-sylhet",
        kind: "destination",
        label: "Sylhet",
        providerPlaceId: "sylhet",
        lat: 24.8949,
        lng: 91.8687,
        address: "Sylhet, Bangladesh",
      },
      {
        id: "activity-1-keane-bridge",
        kind: "activity",
        label: "Keane Bridge",
        sequence: 1,
        providerPlaceId: "keane-bridge",
        lat: 24.8939,
        lng: 91.8692,
        address: "Keane Bridge, Sylhet, Bangladesh",
      },
      {
        id: "activity-2-ratargul-swamp-forest",
        kind: "activity",
        label: "Ratargul Swamp Forest",
        sequence: 2,
        providerPlaceId: "ratargul",
        lat: 25.002,
        lng: 91.975,
        address: "Ratargul Swamp Forest, Sylhet, Bangladesh",
      },
    ]
    const markers = buildTripMarkerData(points)

    expect(markers.map((marker) => marker.id)).toEqual([
      "origin-dhaka",
      "destination-sylhet",
      "activity-1-keane-bridge",
      "activity-2-ratargul-swamp-forest",
    ])
    expect(markers.map((marker) => marker.markerLabel)).toEqual([
      "S",
      "D",
      "1",
      "2",
    ])
    expect(markers.map((marker) => marker.position)).toEqual(
      points.map((point) => ({
        lat: point.lat,
        lng: point.lng,
      }))
    )
    expect(markers.find((marker) => marker.id === "origin-dhaka")?.visualOffset)
      .toEqual({
        x: 0,
        y: 0,
      })
    expect(
      new Set(
        markers
          .filter((marker) => marker.id !== "origin-dhaka")
          .map((marker) => `${marker.visualOffset.x},${marker.visualOffset.y}`)
      ).size
    ).toBe(3)
    expect(
      markers
        .filter((marker) => marker.id !== "origin-dhaka")
        .every(
          (marker) => marker.visualOffset.x !== 0 || marker.visualOffset.y !== 0
        )
    ).toBe(true)
    expect(markers.map((marker) => marker.popup.title)).toEqual([
      "Dhaka",
      "Sylhet",
      "Keane Bridge",
      "Ratargul Swamp Forest",
    ])
  })

  test("keeps destination and nearby itinerary marker individually addressable", () => {
    const points: TripMapPoint[] = [
      {
        id: "destination-sylhet",
        kind: "destination",
        label: "Sylhet",
        providerPlaceId: "sylhet",
        lat: 24.8949,
        lng: 91.8687,
        address: "Sylhet, Bangladesh",
      },
      {
        id: "activity-1-keane-bridge",
        kind: "activity",
        label: "Keane Bridge",
        sequence: 1,
        providerPlaceId: "keane-bridge",
        lat: 24.895,
        lng: 91.8688,
        address: "Keane Bridge, Sylhet, Bangladesh",
      },
    ]
    const markers = buildTripMarkerData(points)
    const destinationMarker = markers.find(
      (marker) => marker.id === "destination-sylhet"
    )
    const itineraryMarker = markers.find(
      (marker) => marker.id === "activity-1-keane-bridge"
    )

    expect(destinationMarker?.markerLabel).toBe("D")
    expect(itineraryMarker?.markerLabel).toBe("1")
    expect(destinationMarker?.position).toEqual({
      lat: 24.8949,
      lng: 91.8687,
    })
    expect(itineraryMarker?.position).toEqual({
      lat: 24.895,
      lng: 91.8688,
    })
    expect(destinationMarker?.popup.title).toBe("Sylhet")
    expect(itineraryMarker?.popup.title).toBe("Keane Bridge")
    expect(
      getPixelDistance(
        destinationMarker?.visualOffset ?? { x: 0, y: 0 },
        itineraryMarker?.visualOffset ?? { x: 0, y: 0 }
      )
    ).toBeGreaterThanOrEqual(80)
  })

  test("assigns distinct readable slots to a destination plus two close itinerary markers", () => {
    const points: TripMapPoint[] = [
      {
        id: "destination-sylhet",
        kind: "destination",
        label: "Sylhet",
        providerPlaceId: "sylhet",
        lat: 24.8949,
        lng: 91.8687,
        address: "Sylhet, Bangladesh",
      },
      {
        id: "activity-1-keane-bridge",
        kind: "activity",
        label: "Keane Bridge",
        sequence: 1,
        providerPlaceId: "keane-bridge",
        lat: 24.895,
        lng: 91.8688,
        address: "Keane Bridge, Sylhet, Bangladesh",
      },
      {
        id: "activity-2-ratargul-swamp-forest",
        kind: "activity",
        label: "Ratargul Swamp Forest",
        sequence: 2,
        providerPlaceId: "ratargul",
        lat: 25.002,
        lng: 91.975,
        address: "Ratargul Swamp Forest, Sylhet, Bangladesh",
      },
    ]
    const markers = buildTripMarkerData(points)

    expect(markers.map((marker) => marker.markerLabel)).toEqual(["D", "1", "2"])
    expect(markers.map((marker) => marker.position)).toEqual(
      points.map((point) => ({
        lat: point.lat,
        lng: point.lng,
      }))
    )
    expect(
      new Set(
        markers.map((marker) => `${marker.visualOffset.x},${marker.visualOffset.y}`)
      ).size
    ).toBe(3)

    for (const leftMarker of markers) {
      for (const rightMarker of markers) {
        if (leftMarker.id >= rightMarker.id) {
          continue
        }

        expect(
          getPixelDistance(leftMarker.visualOffset, rightMarker.visualOffset)
        ).toBeGreaterThanOrEqual(100)
      }
    }

    expect(markers.map((marker) => marker.popup.title)).toEqual([
      "Sylhet",
      "Keane Bridge",
      "Ratargul Swamp Forest",
    ])
  })
})

function enrichedLookup(
  lookupId: string,
  providerPlaceId: string,
  lat: number,
  lng: number,
  kind: TripMapPointKind = "activity"
): TripMapEnrichedLookup {
  return {
    lookup: {
      id: lookupId,
      kind,
      label: "Lookup",
      ...(kind === "activity" ? { day: 1, sequence: 1 } : {}),
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

function mapPoint(
  providerPlaceId: string,
  lat: number,
  lng: number
): TripMapPoint {
  return {
    id: providerPlaceId,
    kind: "activity",
    label: "Place",
    sequence: 1,
    providerPlaceId,
    lat,
    lng,
    address: "1 Test Street",
  }
}

function getDhakaSylhetPlace(lookup: TripMapEnrichedLookup["lookup"]) {
  if (lookup.kind === "origin") {
    return placeFixture({
      providerPlaceId: "dhaka",
      displayName: "Dhaka",
      formattedAddress: "Dhaka, Bangladesh",
      location: {
        lat: 23.7644,
        lng: 90.389,
      },
    })
  }

  if (lookup.kind === "destination") {
    return placeFixture({
      providerPlaceId: "sylhet",
      displayName: "Sylhet",
      formattedAddress: "Sylhet, Bangladesh",
      location: {
        lat: 24.8949,
        lng: 91.8687,
      },
    })
  }

  if (lookup.request.query === "Ratargul Swamp Forest") {
    return placeFixture({
      providerPlaceId: "ratargul",
      displayName: "Ratargul Swamp Forest",
      formattedAddress: "Ratargul Swamp Forest, Sylhet, Bangladesh",
      location: {
        lat: 25.002,
        lng: 91.975,
      },
    })
  }

  return null
}

function placeFixture(overrides: Partial<PlaceEnrichment>): PlaceEnrichment {
  return {
    provider: "geoapify",
    providerPlaceId: "place",
    displayName: "Place",
    formattedAddress: "Place, Bangladesh",
    location: {
      lat: 24.8949,
      lng: 91.8687,
    },
    attribution: getGeoapifyAttribution(),
    matchStatus: "verified",
    matchedQuery: "Place",
    ...overrides,
  }
}

function getPixelDistance(
  left: { x: number; y: number },
  right: { x: number; y: number }
) {
  return Math.hypot(left.x - right.x, left.y - right.y)
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
