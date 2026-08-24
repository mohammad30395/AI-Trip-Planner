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
  OSM_ATTRIBUTION,
  OSM_STANDARD_TILE_URL,
  GLOBAL_FALLBACK_CENTER,
  CANONICAL_PLACE_ZOOM,
  GLOBAL_FALLBACK_ZOOM,
  buildTripMarkerData,
  buildMappablePlaces,
  type TripMapLookup,
  type TripMarkerPopupText,
  type TripMappablePlace,
} from "@/lib/trips/map"
import {
  createUserSafeError,
  type UserSafeError,
} from "@/lib/errors/user-safe-error"

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
  const tileErrorReportedRef = useRef(false)
  const [leafletModule, setLeafletModule] = useState<
    typeof import("leaflet") | null
  >(null)
  const [mapError, setMapError] = useState<UserSafeError | null>(null)

  useEffect(() => {
    let disposed = false
    let animationFrame: number | null = null
    const markersByProviderId = markersByProviderIdRef.current

    async function initializeMap() {
      try {
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
          .on("tileerror", () => {
            if (disposed || tileErrorReportedRef.current) {
              return
            }

            tileErrorReportedRef.current = true
            setMapError(
              createUserSafeError({
                code: "map_unavailable",
                title: "Map tiles did not load",
                message:
                  "The itinerary text and verified place coordinates are still available. Reload this page when the network or tile service is available.",
                retry: "same_stage",
                diagnostic: {
                  source: "leaflet-tile-layer",
                  reason: "tileerror",
                },
              })
            )
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
        setMapError(null)
        animationFrame = window.requestAnimationFrame(() => {
          if (!disposed && mapRef.current === map) {
            map.invalidateSize()
          }
        })
      } catch (error) {
        if (disposed) {
          return
        }

        setMapError(
          createUserSafeError({
            code: "map_unavailable",
            title: "Map could not start",
            message:
              "The itinerary remains readable. Reload this page to retry the client-side map.",
            retry: "same_stage",
            diagnostic: {
              source: "leaflet-init",
              reason: error instanceof Error ? error.name : "UnknownError",
            },
          })
        )
      }
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
      tileErrorReportedRef.current = false
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

    for (const markerData of buildTripMarkerData(places)) {
      const marker = leafletModule
        .marker([markerData.position.lat, markerData.position.lng], {
          icon: markerIconRef.current,
          title: markerData.title,
        })
        .bindPopup(buildSafePopupContent(markerData.popup))

      marker.on("click", () => {
        onMarkerFocus(markerData.providerPlaceId)
        scrollPlaceCardIntoView(markerData.providerPlaceId)
      })

      marker.addTo(markerLayer)
      markersByProviderIdRef.current.set(markerData.providerPlaceId, marker)
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
      {mapError !== null ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
          <p className="font-medium">{mapError.title}</p>
          <p className="mt-1 leading-6">{mapError.message}</p>
        </div>
      ) : null}
    </div>
  )
}

function buildSafePopupContent(popup: TripMarkerPopupText) {
  const container = document.createElement("div")
  container.className = "grid gap-1 text-sm"

  const title = document.createElement("p")
  title.className = "font-medium"
  title.textContent = popup.title
  container.append(title)

  const day = document.createElement("p")
  day.className = "text-xs text-muted-foreground"
  day.textContent = popup.dayLabel
  container.append(day)

  const address = document.createElement("p")
  address.className = "text-xs text-muted-foreground"
  address.textContent = popup.formattedAddress
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
