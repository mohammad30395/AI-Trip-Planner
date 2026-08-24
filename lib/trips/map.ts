import type {
  PlaceEnrichment,
  PlaceEnrichmentRequest,
} from "@/lib/places/place-enrichment"
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

export function buildTripMapLookups(
  trip: TripPresentationData
): TripMapLookup[] {
  const hotelLookups = trip.hotels.map((hotel, index) => ({
    id: stableMapId(["hotel", String(index), hotel.name]),
    label: hotel.name,
    dayLabel: "Hotel",
    request: {
      query: hotel.name,
      destination: trip.destination,
      ...(hotel.address !== null ? { address: hotel.address } : {}),
    },
  }))

  const activityLookups = trip.days.flatMap((day) =>
    day.activities.flatMap((activity, index) => {
      const query = activity.placeName ?? activity.address

      if (query === null) {
        return []
      }

      return {
        id: stableMapId([
          "activity",
          String(day.dayNumber),
          String(index),
          query,
        ]),
        label: activity.placeName ?? activity.title,
        dayLabel: `Day ${day.dayNumber}`,
        request: {
          query,
          destination: trip.destination,
          ...(activity.address !== null ? { address: activity.address } : {}),
          ...(activity.approximateArea !== null
            ? { city: activity.approximateArea }
            : {}),
        },
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

function stableMapId(parts: string[]) {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
