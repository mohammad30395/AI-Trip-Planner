"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type {
  DivIcon,
  LayerGroup,
  Map as LeafletMap,
  Marker,
} from "leaflet"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { usePlaceEnrichments } from "@/components/trips/place-enrichment"
import {
  buildMappablePlaces,
  type TripMapLookup,
  type TripMappablePlace,
} from "@/lib/trips/map"

type MapLocation = {
  lat: number
  lng: number
}

const OSM_STANDARD_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const GLOBAL_FALLBACK_CENTER = {
  lat: 20,
  lng: 0,
} satisfies MapLocation
const CANONICAL_PLACE_ZOOM = 13
const GLOBAL_FALLBACK_ZOOM = 2

function TripMapSection({
  focusedProviderPlaceId,
  lookups,
  onMarkerFocus,
}: {
  focusedProviderPlaceId: string | null
  lookups: TripMapLookup[]
  onMarkerFocus: (providerPlaceId: string) => void
}) {
  const lookupStatuses = usePlaceEnrichments(
    useMemo(
      () =>
        lookups.map((lookup) => ({
          id: lookup.id,
          request: lookup.request,
        })),
      [lookups]
    )
  )
  const places = useMemo(() => {
    const lookupsById = new Map(
      lookups.map((lookup) => [lookup.id, lookup] as const)
    )
    const enrichedLookups = lookupStatuses.flatMap((result) => {
      const lookup = lookupsById.get(result.id)

      if (lookup === undefined || result.status.status !== "success") {
        return []
      }

      return {
        lookup,
        place: result.status.place,
      }
    })

    return buildMappablePlaces(enrichedLookups)
  }, [lookupStatuses, lookups])
  const statusText = getMapStatusText(lookups.length, places.length)

  return (
    <section aria-labelledby="trip-map" className="grid gap-4">
      <div>
        <h2 id="trip-map" className="font-heading text-xl font-semibold">
          Trip Map
        </h2>
        <p className="app-muted mt-2 text-sm">
          The map uses canonical Geoapify-enriched coordinates when available.
        </p>
      </div>

      <Card className="app-card overflow-hidden">
        <CardHeader>
          <CardTitle>Interactive Map</CardTitle>
          <CardDescription>{statusText}</CardDescription>
        </CardHeader>
        <CardContent>
          <LeafletTripMap
            focusedProviderPlaceId={focusedProviderPlaceId}
            label={
              places.length > 0
                ? "Leaflet trip map with canonical Geoapify itinerary markers"
                : "Leaflet trip map using global fallback center"
            }
            onMarkerFocus={onMarkerFocus}
            places={places}
          />
        </CardContent>
      </Card>
    </section>
  )
}

function LeafletTripMap({
  focusedProviderPlaceId,
  label,
  onMarkerFocus,
  places,
}: {
  focusedProviderPlaceId: string | null
  label: string
  onMarkerFocus: (providerPlaceId: string) => void
  places: TripMappablePlace[]
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerLayerRef = useRef<LayerGroup | null>(null)
  const markersByProviderIdRef = useRef<Map<string, Marker>>(new Map())
  const markerIconRef = useRef<DivIcon | null>(null)
  const [leafletModule, setLeafletModule] = useState<
    typeof import("leaflet") | null
  >(null)

  useEffect(() => {
    let disposed = false
    let animationFrame: number | null = null
    const markersByProviderId = markersByProviderIdRef.current

    async function initializeMap() {
      if (containerRef.current === null || mapRef.current !== null) {
        return
      }

      const leaflet = await import("leaflet")

      if (disposed || containerRef.current === null || mapRef.current !== null) {
        return
      }

      const map = leaflet
        .map(containerRef.current, {
          attributionControl: true,
          zoomControl: true,
        })
        .setView(
          [GLOBAL_FALLBACK_CENTER.lat, GLOBAL_FALLBACK_CENTER.lng],
          GLOBAL_FALLBACK_ZOOM
        )

      leaflet
        .tileLayer(OSM_STANDARD_TILE_URL, {
          attribution: OSM_ATTRIBUTION,
          maxZoom: 19,
        })
        .addTo(map)

      mapRef.current = map
      markerIconRef.current = leaflet.divIcon({
        className: "trip-map-marker",
        iconAnchor: [14, 28],
        iconSize: [28, 28],
        popupAnchor: [0, -28],
      })
      setLeafletModule(leaflet)
      animationFrame = window.requestAnimationFrame(() => {
        if (!disposed && mapRef.current === map) {
          map.invalidateSize()
        }
      })
    }

    void initializeMap()

    return () => {
      disposed = true
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
      }
      markerLayerRef.current?.remove()
      markerLayerRef.current = null
      markersByProviderId.clear()
      mapRef.current?.remove()
      mapRef.current = null
      setLeafletModule(null)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current

    if (map === null || leafletModule === null || markerIconRef.current === null) {
      return
    }

    markerLayerRef.current?.remove()
    markerLayerRef.current = null
    markersByProviderIdRef.current.clear()

    if (places.length === 0) {
      map.setView(
        [GLOBAL_FALLBACK_CENTER.lat, GLOBAL_FALLBACK_CENTER.lng],
        GLOBAL_FALLBACK_ZOOM
      )
      return
    }

    const markerLayer = leafletModule.layerGroup().addTo(map)
    markerLayerRef.current = markerLayer

    for (const place of places) {
      const marker = leafletModule
        .marker([place.location.lat, place.location.lng], {
          icon: markerIconRef.current,
          title: place.displayName,
        })
        .bindPopup(buildSafePopupContent(place))

      marker.on("click", () => {
        onMarkerFocus(place.providerPlaceId)
        scrollPlaceCardIntoView(place.providerPlaceId)
      })

      marker.addTo(markerLayer)
      markersByProviderIdRef.current.set(place.providerPlaceId, marker)
    }

    if (places.length === 1) {
      const place = places[0]
      map.setView([place.location.lat, place.location.lng], CANONICAL_PLACE_ZOOM)
    } else {
      const bounds = leafletModule.latLngBounds(
        places.map((place) => [place.location.lat, place.location.lng])
      )
      map.fitBounds(bounds, {
        maxZoom: CANONICAL_PLACE_ZOOM,
        padding: [28, 28],
      })
    }

    const animationFrame = window.requestAnimationFrame(() => {
      if (mapRef.current === map) {
        map.invalidateSize()
      }
    })

    return () => {
      window.cancelAnimationFrame(animationFrame)
      markerLayer.eachLayer((layer) => {
        layer.off()
      })
      markerLayer.remove()
      if (markerLayerRef.current === markerLayer) {
        markerLayerRef.current = null
      }
    }
  }, [leafletModule, onMarkerFocus, places])

  useEffect(() => {
    if (focusedProviderPlaceId === null) {
      return
    }

    const map = mapRef.current
    const marker = markersByProviderIdRef.current.get(focusedProviderPlaceId)

    if (map === null || marker === undefined) {
      return
    }

    const location = marker.getLatLng()
    map.flyTo(location, CANONICAL_PLACE_ZOOM, {
      duration: 0.65,
    })
    marker.openPopup()
  }, [focusedProviderPlaceId])

  return (
    <div className="grid gap-2">
      <div
        ref={containerRef}
        aria-label={label}
        className="h-72 w-full overflow-hidden rounded-lg border bg-muted/30 sm:h-96 lg:h-[28rem]"
        role="img"
      />
      <p className="app-muted text-xs">
        Map tiles use the application-controlled OpenStreetMap standard HTTPS
        tile layer.
      </p>
    </div>
  )
}

function buildSafePopupContent(place: TripMappablePlace) {
  const container = document.createElement("div")
  container.className = "grid gap-1 text-sm"

  const title = document.createElement("p")
  title.className = "font-medium"
  title.textContent = place.displayName
  container.append(title)

  const day = document.createElement("p")
  day.className = "text-xs text-muted-foreground"
  day.textContent = place.dayLabel
  container.append(day)

  const address = document.createElement("p")
  address.className = "text-xs text-muted-foreground"
  address.textContent = place.formattedAddress
  container.append(address)

  return container
}

function scrollPlaceCardIntoView(providerPlaceId: string) {
  const placeCards = document.querySelectorAll<HTMLElement>(
    "[data-provider-place-id]"
  )

  for (const placeCard of placeCards) {
    if (placeCard.dataset.providerPlaceId === providerPlaceId) {
      placeCard.focus({ preventScroll: true })
      placeCard.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
      return
    }
  }
}

function getMapStatusText(lookupCount: number, placeCount: number) {
  if (lookupCount === 0) {
    return "No saved place query is available yet, so the map uses a documented global fallback."
  }

  if (placeCount === 0) {
    return "Looking up canonical Geoapify coordinates. Places without verified coordinates are skipped."
  }

  if (placeCount === 1) {
    return "Showing 1 verified itinerary place. Select a trip card to focus it on the map."
  }

  return `Showing ${placeCount} verified itinerary places. Select a trip card to focus it on the map.`
}

export { TripMapSection }
