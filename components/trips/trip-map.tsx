"use client"

import { useEffect, useMemo, useRef } from "react"
import type { Map as LeafletMap } from "leaflet"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { usePlaceEnrichment } from "@/components/trips/place-enrichment"
import type { PlaceEnrichmentRequest } from "@/lib/places/place-enrichment"

type MapLocation = {
  lat: number
  lng: number
}

type TripMapLookup = {
  label: string
  request: PlaceEnrichmentRequest
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

function TripMapSection({ lookup }: { lookup: TripMapLookup | null }) {
  const request = useMemo(() => lookup?.request ?? null, [lookup])
  const enrichment = usePlaceEnrichment(request)
  const center =
    enrichment.status === "success"
      ? enrichment.place.location
      : GLOBAL_FALLBACK_CENTER
  const zoom =
    enrichment.status === "success" ? CANONICAL_PLACE_ZOOM : GLOBAL_FALLBACK_ZOOM
  const statusText = getMapStatusText(lookup, enrichment.status)

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
            center={center}
            label={
              enrichment.status === "success"
                ? `Leaflet trip map centered on ${enrichment.place.displayName}`
                : "Leaflet trip map using global fallback center"
            }
            zoom={zoom}
          />
        </CardContent>
      </Card>
    </section>
  )
}

function LeafletTripMap({
  center,
  label,
  zoom,
}: {
  center: MapLocation
  label: string
  zoom: number
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const latestViewRef = useRef({ center, zoom })

  useEffect(() => {
    let disposed = false
    let animationFrame: number | null = null

    async function initializeMap() {
      if (containerRef.current === null || mapRef.current !== null) {
        return
      }

      const leaflet = await import("leaflet")

      if (disposed || containerRef.current === null || mapRef.current !== null) {
        return
      }

      const initialView = latestViewRef.current
      const map = leaflet
        .map(containerRef.current, {
          attributionControl: true,
          zoomControl: true,
        })
        .setView([initialView.center.lat, initialView.center.lng], initialView.zoom)

      leaflet
        .tileLayer(OSM_STANDARD_TILE_URL, {
          attribution: OSM_ATTRIBUTION,
          maxZoom: 19,
        })
        .addTo(map)

      mapRef.current = map
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
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    latestViewRef.current = {
      center: {
        lat: center.lat,
        lng: center.lng,
      },
      zoom,
    }

    const map = mapRef.current

    if (map === null) {
      return
    }

    map.setView([center.lat, center.lng], zoom)
    const animationFrame = window.requestAnimationFrame(() => {
      if (mapRef.current === map) {
        map.invalidateSize()
      }
    })

    return () => {
      window.cancelAnimationFrame(animationFrame)
    }
  }, [center.lat, center.lng, zoom])

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

function getMapStatusText(
  lookup: TripMapLookup | null,
  status: ReturnType<typeof usePlaceEnrichment>["status"]
) {
  if (lookup === null) {
    return "No saved place query is available yet, so the map uses a documented global fallback."
  }

  if (status === "success") {
    return `Centered on canonical coordinates for ${lookup.label}.`
  }

  if (status === "loading") {
    return `Looking up canonical Geoapify coordinates for ${lookup.label}.`
  }

  return "Canonical coordinates are unavailable, so the map uses a documented global fallback."
}

export { TripMapSection, type TripMapLookup }
