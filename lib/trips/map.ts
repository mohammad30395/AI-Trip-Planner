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
import type { PresentedActivity, PresentedHotel } from "@/lib/trips/presentation"

export type TripMapPointKind = "origin" | "destination" | "activity" | "hotel"

export type TripMapLookup = {
  id: string
  kind: TripMapPointKind
  label: string
  day?: number
  dayLabel?: string
  sequence?: number
  request: PlaceEnrichmentRequest
}

export type TripMapEnrichedLookup = {
  lookup: TripMapLookup
  place: PlaceEnrichment
}

export type TripMapPoint = {
  id: string
  kind: TripMapPointKind
  label: string
  day?: number
  sequence?: number
  providerPlaceId?: string
  lat: number
  lng: number
  address?: string
  imageUrl?: string
}

export type MapLocation = {
  lat: number
  lng: number
}

export type TripMapView = {
  center: MapLocation
  zoom: number
  source: "single-point" | "global-fallback"
}

export type TripMapBounds = {
  southWest: MapLocation
  northEast: MapLocation
}

export type TripMarkerData = {
  id: string
  kind: TripMapPointKind
  markerLabel: string
  position: MapLocation
  title: string
  popup: TripMarkerPopupText
}

export type TripMarkerScreenPosition = {
  id: string
  x: number
  y: number
}

export type TripMarkerVisibility = {
  id: string
  visible: boolean
}

export type TripMarkerPopupText = {
  title: string
  typeLabel: string
  sequenceLabel?: string
  formattedAddress?: string
  imageUrl?: string
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
export const MAP_OUTLIER_MAX_DISTANCE_METERS = 300_000
export const MARKER_COLLISION_DISTANCE_PX = 32

export function buildTripMapLookups(
  trip: TripPresentationData
): TripMapLookup[] {
  const cityLookups: TripMapLookup[] = [
    {
      id: stableMapId(["origin", trip.source]),
      kind: "origin",
      label: trip.source,
      request: {
        query: trip.source,
        lookupKind: "city",
      },
    },
    {
      id: stableMapId(["destination", trip.destination]),
      kind: "destination",
      label: trip.destination,
      request: {
        query: trip.destination,
        lookupKind: "city",
      },
    },
  ]
  const hotelLookups = trip.hotels.map((hotel, index) =>
    buildTripHotelMapLookup({
      destination: trip.destination,
      hotel,
      index,
    })
  )

  let activitySequence = 0
  const activityLookups = trip.days.flatMap((day) =>
    day.activities.flatMap((activity, index) => {
      const lookup = buildTripActivityMapLookup({
        activity,
        dayNumber: day.dayNumber,
        destination: trip.destination,
        index,
        sequence: activitySequence + 1,
      })

      if (lookup === null) {
        return []
      }

      activitySequence += 1
      return lookup
    })
  )

  return [...cityLookups, ...hotelLookups, ...activityLookups]
}

export function buildTripHotelMapLookup({
  destination,
  hotel,
  index,
}: {
  destination: string
  hotel: PresentedHotel
  index: number
}): TripMapLookup {
  return {
    id: stableMapId(["hotel", String(index), hotel.name]),
    kind: "hotel",
    label: hotel.name,
    dayLabel: "Hotel",
    request: buildHotelPlaceEnrichmentRequest({
      address: hotel.address,
      area: hotel.area,
      destination,
      name: hotel.name,
    }),
  }
}

export function buildTripActivityMapLookup({
  activity,
  dayNumber,
  destination,
  index,
  sequence,
}: {
  activity: PresentedActivity
  dayNumber: number
  destination: string
  index: number
  sequence: number
}): TripMapLookup | null {
  const request = buildActivityPlaceEnrichmentRequest({
    address: activity.address,
    approximateArea: activity.approximateArea,
    destination,
    placeName: activity.placeName,
    title: activity.title,
  })

  if (request === null) {
    return null
  }

  return {
    id: stableMapId([
      "activity",
      String(dayNumber),
      String(index),
      request.query,
    ]),
    kind: "activity",
    label: request.query,
    day: dayNumber,
    dayLabel: `Day ${dayNumber}`,
    sequence,
    request,
  }
}

export function buildTripMapPoints({
  enrichedLookups,
  onDiagnostic,
}: {
  enrichedLookups: readonly TripMapEnrichedLookup[]
  onDiagnostic?: (diagnostic: string, metadata: Record<string, string>) => void
}): TripMapPoint[] {
  const accepted = enrichedLookups.flatMap((item) => {
    if (!isAcceptedPlace(item.place) || !isValidMapLocation(item.place.location)) {
      return []
    }

    return {
      item,
      point: toTripMapPoint(item),
    }
  })
  const destinationPoint = accepted.find(
    (entry) => entry.point.kind === "destination"
  )?.point
  const pointsByKey = new Map<string, TripMapPoint>()
  let acceptedActivitySequence = 0

  for (const entry of accepted) {
    if (
      destinationPoint !== undefined &&
      isDestinationLocalPoint(entry.point) &&
      getDistanceMeters(destinationPoint, entry.point) >
        MAP_OUTLIER_MAX_DISTANCE_METERS
    ) {
      onDiagnostic?.("map-point-outlier-skipped", {
        id: entry.point.id,
        kind: entry.point.kind,
        label: entry.point.label,
      })
      continue
    }

    const dedupeKey = getMapPointDedupeKey(entry.point)

    if (pointsByKey.has(dedupeKey)) {
      continue
    }

    if (entry.point.kind === "activity") {
      acceptedActivitySequence += 1
      pointsByKey.set(dedupeKey, {
        ...entry.point,
        sequence: acceptedActivitySequence,
      })
    } else {
      pointsByKey.set(dedupeKey, entry.point)
    }
  }

  return Array.from(pointsByKey.values())
}

export function selectTripMapInitialView(
  points: readonly TripMapPoint[]
): TripMapView {
  const firstPoint = points.find(hasValidLocation)

  if (firstPoint === undefined) {
    return {
      center: GLOBAL_FALLBACK_CENTER,
      zoom: GLOBAL_FALLBACK_ZOOM,
      source: "global-fallback",
    }
  }

  return {
    center: {
      lat: firstPoint.lat,
      lng: firstPoint.lng,
    },
    zoom: CANONICAL_PLACE_ZOOM,
    source: "single-point",
  }
}

export function getTripMapBounds(points: readonly TripMapPoint[]): TripMapBounds | null {
  const validPoints = points.filter(hasValidLocation)

  if (validPoints.length < 2) {
    return null
  }

  const lats = validPoints.map((point) => point.lat)
  const lngs = validPoints.map((point) => point.lng)

  return {
    southWest: {
      lat: Math.min(...lats),
      lng: Math.min(...lngs),
    },
    northEast: {
      lat: Math.max(...lats),
      lng: Math.max(...lngs),
    },
  }
}

export function buildTripMarkerData(
  points: readonly TripMapPoint[]
): TripMarkerData[] {
  return points.filter(hasValidLocation).map((point) => ({
    id: point.id,
    kind: point.kind,
    markerLabel: getMarkerLabel(point),
    position: {
      lat: point.lat,
      lng: point.lng,
    },
    title: point.label,
    popup: buildTripMarkerPopupText(point),
  }))
}

export function buildTripMarkerPopupText(
  point: TripMapPoint
): TripMarkerPopupText {
  return {
    title: point.label,
    typeLabel: getPointTypeLabel(point.kind),
    ...(point.kind === "activity" && point.sequence !== undefined
      ? {
          sequenceLabel: `Stop ${point.sequence}${
            point.day !== undefined ? ` - Day ${point.day}` : ""
          }`,
        }
      : {}),
    ...(point.kind === "hotel" ? { sequenceLabel: "Hotel option" } : {}),
    ...(point.address !== undefined ? { formattedAddress: point.address } : {}),
    ...(point.imageUrl !== undefined ? { imageUrl: point.imageUrl } : {}),
  }
}

export function getPointTypeLabel(kind: TripMapPointKind) {
  if (kind === "origin") {
    return "Start"
  }

  if (kind === "destination") {
    return "Destination"
  }

  if (kind === "hotel") {
    return "Hotel"
  }

  return "Itinerary stop"
}

export function getTripMarkerRenderPriority(
  marker: Pick<TripMarkerData, "id" | "kind">,
  focusedMapPointId: string | null
) {
  if (focusedMapPointId === marker.id) {
    return 400
  }

  if (marker.kind === "destination") {
    return 300
  }

  if (marker.kind === "origin") {
    return 200
  }

  return 100
}

export function resolveTripMarkerVisibility({
  focusedMapPointId,
  markers,
  screenPositions,
}: {
  focusedMapPointId: string | null
  markers: readonly TripMarkerData[]
  screenPositions: readonly TripMarkerScreenPosition[]
}): TripMarkerVisibility[] {
  const positionsById = new Map(
    screenPositions.map((position) => [position.id, position] as const)
  )
  const selectedMarkerId =
    focusedMapPointId !== null &&
    markers.some((marker) => marker.id === focusedMapPointId)
      ? focusedMapPointId
      : null
  const sortedMarkers = [...markers].sort((left, right) => {
    const priorityDifference =
      getTripMarkerRenderPriority(right, selectedMarkerId) -
      getTripMarkerRenderPriority(left, selectedMarkerId)

    if (priorityDifference !== 0) {
      return priorityDifference
    }

    return compareTripMarkersForCollision(left, right)
  })
  const visibleMarkers: TripMarkerData[] = []
  const visibleById = new Map<string, boolean>()

  for (const marker of sortedMarkers) {
    const markerPosition = positionsById.get(marker.id)

    if (markerPosition === undefined) {
      visibleById.set(marker.id, true)
      visibleMarkers.push(marker)
      continue
    }

    const collidesWithVisibleMarker = visibleMarkers.some((visibleMarker) => {
      const visiblePosition = positionsById.get(visibleMarker.id)

      return (
        visiblePosition !== undefined &&
        getPixelDistance(markerPosition, visiblePosition) <=
          MARKER_COLLISION_DISTANCE_PX
      )
    })

    visibleById.set(marker.id, !collidesWithVisibleMarker)

    if (!collidesWithVisibleMarker) {
      visibleMarkers.push(marker)
    }
  }

  return markers.map((marker) => ({
    id: marker.id,
    visible: visibleById.get(marker.id) ?? true,
  }))
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

function isAcceptedPlace(place: PlaceEnrichment) {
  return place.matchStatus === "verified" || place.matchStatus === "probable"
}

function toTripMapPoint({ lookup, place }: TripMapEnrichedLookup): TripMapPoint {
  return {
    id: lookup.id,
    kind: lookup.kind,
    label: place.displayName,
    ...(lookup.day !== undefined ? { day: lookup.day } : {}),
    ...(lookup.sequence !== undefined ? { sequence: lookup.sequence } : {}),
    providerPlaceId: place.providerPlaceId,
    lat: place.location.lat,
    lng: place.location.lng,
    address: place.formattedAddress,
    ...(place.image !== undefined ? { imageUrl: place.image.url } : {}),
  }
}

function isDestinationLocalPoint(point: TripMapPoint) {
  return point.kind === "activity" || point.kind === "hotel"
}

function getMapPointDedupeKey(point: TripMapPoint) {
  if (point.providerPlaceId === undefined) {
    return point.id
  }

  return `${point.kind}:${point.providerPlaceId}`
}

function getMarkerLabel(point: TripMapPoint) {
  if (point.kind === "origin") {
    return "S"
  }

  if (point.kind === "destination") {
    return "D"
  }

  if (point.kind === "hotel") {
    return "H"
  }

  return String(point.sequence ?? "")
}

function compareTripMarkersForCollision(
  left: TripMarkerData,
  right: TripMarkerData
) {
  const kindOrder = {
    origin: 0,
    destination: 1,
    activity: 2,
    hotel: 3,
  } satisfies Record<TripMapPointKind, number>
  const kindDifference = kindOrder[left.kind] - kindOrder[right.kind]

  if (kindDifference !== 0) {
    return kindDifference
  }

  if (left.kind === "activity" && right.kind === "activity") {
    return Number(left.markerLabel) - Number(right.markerLabel)
  }

  return left.id.localeCompare(right.id)
}

function getPixelDistance(
  left: Pick<TripMarkerScreenPosition, "x" | "y">,
  right: Pick<TripMarkerScreenPosition, "x" | "y">
) {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

function hasValidLocation(point: TripMapPoint) {
  return isValidMapLocation({
    lat: point.lat,
    lng: point.lng,
  })
}

function getDistanceMeters(left: MapLocation, right: MapLocation) {
  const earthRadiusMeters = 6_371_000
  const leftLat = toRadians(left.lat)
  const rightLat = toRadians(right.lat)
  const deltaLat = toRadians(right.lat - left.lat)
  const deltaLng = toRadians(right.lng - left.lng)
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(leftLat) *
      Math.cos(rightLat) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadiusMeters * c
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function stableMapId(parts: string[]) {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export { isGenericActivityPlaceQuery }
