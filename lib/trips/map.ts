import type {
  PlaceEnrichment,
  PlaceEnrichmentRequest,
} from "@/lib/places/place-enrichment"
import {
  buildActivityPlaceEnrichmentRequest,
  buildHotelPlaceEnrichmentRequest,
  isGenericActivityPlaceQuery,
} from "@/lib/places/place-lookup-policy"
import type { TripPresentationData } from "@/lib/trips/presentation"

export type TripMapLookup = {
  id: string
  label: string
  dayLabel: string
  request: PlaceEnrichmentRequest
}

export type TripMappablePlace = {
  lookupId: string
  providerPlaceId: string
  displayName: string
  formattedAddress: string
  dayLabel: string
  location: {
    lat: number
    lng: number
  }
}

export type TripMapEnrichedLookup = {
  lookup: TripMapLookup
  place: PlaceEnrichment
}

export type MapLocation = {
  lat: number
  lng: number
}

export type TripMapView = {
  center: MapLocation
  zoom: number
  source: "canonical-place" | "global-fallback"
}

export type TripMarkerData = {
  providerPlaceId: string
  position: MapLocation
  title: string
  popup: TripMarkerPopupText
}

export type TripMarkerPopupText = {
  title: string
  dayLabel: string
  formattedAddress: string
}

export const OSM_STANDARD_TILE_URL =
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
export const GLOBAL_FALLBACK_CENTER = {
  lat: 20,
  lng: 0,
} satisfies MapLocation
export const CANONICAL_PLACE_ZOOM = 13
export const GLOBAL_FALLBACK_ZOOM = 2

export function buildTripMapLookups(
  trip: TripPresentationData
): TripMapLookup[] {
  const hotelLookups = trip.hotels.map((hotel, index) => ({
    id: stableMapId(["hotel", String(index), hotel.name]),
    label: hotel.name,
    dayLabel: "Hotel",
    request: buildHotelPlaceEnrichmentRequest({
      address: hotel.address,
      area: hotel.area,
      destination: trip.destination,
      name: hotel.name,
    }),
  }))

  const activityLookups = trip.days.flatMap((day) =>
    day.activities.flatMap((activity, index) => {
      const request = buildActivityPlaceEnrichmentRequest({
        address: activity.address,
        approximateArea: activity.approximateArea,
        destination: trip.destination,
        placeName: activity.placeName,
        title: activity.title,
      })

      if (request === null) {
        return []
      }

      return {
        id: stableMapId([
          "activity",
          String(day.dayNumber),
          String(index),
          request.query,
        ]),
        label: request.query,
        dayLabel: `Day ${day.dayNumber}`,
        request,
      }
    })
  )

  return [...hotelLookups, ...activityLookups]
}

export function buildMappablePlaces(
  enrichedLookups: readonly TripMapEnrichedLookup[]
): TripMappablePlace[] {
  const placesByProviderId = new Map<string, TripMappablePlace>()

  for (const item of enrichedLookups) {
    if (placesByProviderId.has(item.place.providerPlaceId)) {
      continue
    }

    if (!isValidMapLocation(item.place.location)) {
      continue
    }

    if (
      item.place.matchStatus !== "verified" &&
      item.place.matchStatus !== "probable"
    ) {
      continue
    }

    placesByProviderId.set(item.place.providerPlaceId, {
      lookupId: item.lookup.id,
      providerPlaceId: item.place.providerPlaceId,
      displayName: item.place.displayName,
      formattedAddress: item.place.formattedAddress,
      dayLabel: item.lookup.dayLabel,
      location: item.place.location,
    })
  }

  return Array.from(placesByProviderId.values())
}

export function selectTripMapInitialView(
  places: readonly TripMappablePlace[]
): TripMapView {
  const firstPlace = places.find((place) => isValidMapLocation(place.location))

  if (firstPlace === undefined) {
    return {
      center: GLOBAL_FALLBACK_CENTER,
      zoom: GLOBAL_FALLBACK_ZOOM,
      source: "global-fallback",
    }
  }

  return {
    center: firstPlace.location,
    zoom: CANONICAL_PLACE_ZOOM,
    source: "canonical-place",
  }
}

export function buildTripMarkerData(
  places: readonly TripMappablePlace[]
): TripMarkerData[] {
  return places.filter(hasValidLocation).map((place) => ({
    providerPlaceId: place.providerPlaceId,
    position: place.location,
    title: place.displayName,
    popup: buildTripMarkerPopupText(place),
  }))
}

export function buildTripMarkerPopupText(
  place: TripMappablePlace
): TripMarkerPopupText {
  return {
    title: place.displayName,
    dayLabel: place.dayLabel,
    formattedAddress: place.formattedAddress,
  }
}

export function isValidMapLocation(value: MapLocation) {
  return (
    Number.isFinite(value.lat) &&
    value.lat >= -90 &&
    value.lat <= 90 &&
    Number.isFinite(value.lng) &&
    value.lng >= -180 &&
    value.lng <= 180
  )
}

function hasValidLocation(place: TripMappablePlace) {
  return isValidMapLocation(place.location)
}

function stableMapId(parts: string[]) {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export { isGenericActivityPlaceQuery }
