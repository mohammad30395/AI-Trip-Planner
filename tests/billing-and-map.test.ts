import { describe, expect, test } from "vitest"

import { getTripGenerationAccessStatus } from "@/lib/billing/trip-generation-access"
import {
  CANONICAL_PLACE_ZOOM,
  GLOBAL_FALLBACK_CENTER,
  GLOBAL_FALLBACK_ZOOM,
  OSM_STANDARD_TILE_URL,
  buildMappablePlaces,
  buildTripMarkerData,
  isValidMapLocation,
  selectTripMapInitialView,
  type TripMapEnrichedLookup,
  type TripMappablePlace,
} from "@/lib/trips/map"
import { getGeoapifyAttribution } from "@/lib/places/place-enrichment"

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
