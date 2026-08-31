"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type {
  LayerGroup,
  Map as LeafletMap,
  Marker,
} from "leaflet"
import { MapPinned, Route } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
  buildTripMapPoints,
  buildTripMarkerData,
  getPointTypeLabel,
  getTripMarkerRenderPriority,
  getTripMapBounds,
  resolveTripMarkerVisibility,
  selectTripMapInitialView,
  type TripMapLookup,
  type TripMapPoint,
  type TripMapPointKind,
  type TripMarkerData,
  type TripMarkerPopupText,
} from "@/lib/trips/map"
import {
  createUserSafeError,
  type UserSafeError,
} from "@/lib/errors/user-safe-error"
import { cn } from "@/lib/utils"

type TripMapLayout = "default" | "sticky"

function TripMapSection({
  destination,
  durationLabel,
  focusedMapPointId,
  layout = "default",
  lookups,
  onMarkerFocus,
  source,
}: {
  destination: string
  durationLabel: string
  focusedMapPointId: string | null
  layout?: TripMapLayout
  lookups: TripMapLookup[]
  onMarkerFocus: (mapPointId: string) => void
  source: string
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
  const points = useMemo(() => {
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

    return buildTripMapPoints({
      enrichedLookups,
      onDiagnostic:
        process.env.NODE_ENV === "development"
          ? (diagnostic, metadata) => {
              console.warn("Trip map diagnostic", {
                diagnostic,
                ...metadata,
              })
            }
          : undefined,
    })
  }, [lookupStatuses, lookups])
  const statusText = getMapStatusText(lookups.length, points.length)

  return (
    <section aria-labelledby="trip-map" className="grid scroll-mt-28 gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[var(--app-control-radius)] bg-accent text-primary">
            <MapPinned className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="trip-map" className="font-heading text-xl font-semibold">
              Trip Map
            </h2>
            <p className="app-muted mt-1 break-words text-sm">
              Canonical map points for {source} {"->"} {destination}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-background">
          {points.length} mapped {points.length === 1 ? "place" : "places"}
        </Badge>
      </div>

      <Card
        id="trip-map-panel"
        className="app-panel gap-0 overflow-hidden p-0 [--card-spacing:--spacing(0)]"
      >
        <CardHeader className="border-b bg-background px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 break-words text-lg">
                <Route className="size-4 text-primary" aria-hidden="true" />
                {source} {"->"} {destination}
              </CardTitle>
              <CardDescription>
                {durationLabel} trip using verified place coordinates when
                available.
              </CardDescription>
            </div>
            <MapLegend points={points} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-0 p-0">
          <div className="border-b bg-soft-surface/70 px-4 py-3 sm:px-5">
            <p className="app-muted text-sm">{statusText}</p>
          </div>
          <LeafletTripMap
            focusedMapPointId={focusedMapPointId}
            label={
              points.length > 0
                ? `${source} to ${destination} trip map with start, destination, and numbered itinerary markers`
                : "Leaflet trip map using global fallback center"
            }
            layout={layout}
            onMarkerFocus={onMarkerFocus}
            points={points}
          />
          <StopSummary
            focusedMapPointId={focusedMapPointId}
            layout={layout}
            onMarkerFocus={onMarkerFocus}
            points={points}
          />
        </CardContent>
      </Card>
    </section>
  )
}

function LeafletTripMap({
  focusedMapPointId,
  label,
  layout,
  onMarkerFocus,
  points,
}: {
  focusedMapPointId: string | null
  label: string
  layout: TripMapLayout
  onMarkerFocus: (mapPointId: string) => void
  points: TripMapPoint[]
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerLayerRef = useRef<LayerGroup | null>(null)
  const markersByPointIdRef = useRef<Map<string, Marker>>(new Map())
  const markerDataRef = useRef<TripMarkerData[]>([])
  const pointsRef = useRef(points)
  const focusedMapPointIdRef = useRef(focusedMapPointId)
  const tileErrorReportedRef = useRef(false)
  const pointsKey = useMemo(() => buildPointsKey(points), [points])
  const [leafletModule, setLeafletModule] = useState<
    typeof import("leaflet") | null
  >(null)
  const [mapError, setMapError] = useState<UserSafeError | null>(null)

  useEffect(() => {
    pointsRef.current = points
  }, [points])

  useEffect(() => {
    let disposed = false
    let animationFrame: number | null = null
    const markersByPointId = markersByPointIdRef.current

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
      markersByPointId.clear()
      markerDataRef.current = []
      tileErrorReportedRef.current = false
      mapRef.current?.remove()
      mapRef.current = null
      setLeafletModule(null)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current

    if (map === null || leafletModule === null) {
      return
    }

    const currentPoints = pointsRef.current

    markerLayerRef.current?.remove()
    markerLayerRef.current = null
    markersByPointIdRef.current.clear()
    markerDataRef.current = []

    if (currentPoints.length === 0) {
      map.setView(
        [GLOBAL_FALLBACK_CENTER.lat, GLOBAL_FALLBACK_CENTER.lng],
        GLOBAL_FALLBACK_ZOOM
      )
      return
    }

    const markerLayer = leafletModule.layerGroup().addTo(map)
    markerLayerRef.current = markerLayer
    const connectionPoints = getConnectionPoints(currentPoints)
    const markerData = buildTripMarkerData(currentPoints)
    markerDataRef.current = markerData

    if (connectionPoints.length >= 2) {
      leafletModule
        .polyline(
          connectionPoints.map((point) => [point.lat, point.lng]),
          {
            color: "var(--foreground)",
            dashArray: "6 8",
            opacity: 0.38,
            weight: 3,
          }
        )
        .bindTooltip("Approximate connection", {
          sticky: true,
        })
        .addTo(markerLayer)
    }

    for (const markerInfo of markerData) {
      const leafletMarker = leafletModule
        .marker([markerInfo.position.lat, markerInfo.position.lng], {
          icon: leafletModule.divIcon({
            className: "trip-map-div-icon",
            html: buildMarkerHtml(
              markerInfo.kind,
              markerInfo.markerLabel,
              markerInfo.id === focusedMapPointIdRef.current
            ),
            iconAnchor: [17, 34],
            iconSize: [34, 34],
            popupAnchor: [0, -32],
          }),
          title: markerInfo.title,
        })
        .bindPopup(buildSafePopupContent(markerInfo.popup))

      leafletMarker.setZIndexOffset(
        getTripMarkerRenderPriority(markerInfo, focusedMapPointIdRef.current)
      )
      leafletMarker.on("click", () => {
        onMarkerFocus(markerInfo.id)
        scrollPlaceCardIntoView(markerInfo.id)
      })

      leafletMarker.addTo(markerLayer)
      markersByPointIdRef.current.set(markerInfo.id, leafletMarker)
    }

    const mapBounds = getTripMapBounds(currentPoints)

    if (mapBounds === null) {
      const view = selectTripMapInitialView(currentPoints)
      map.setView([view.center.lat, view.center.lng], view.zoom)
    } else {
      const bounds = leafletModule.latLngBounds(
        [
          [mapBounds.southWest.lat, mapBounds.southWest.lng],
          [mapBounds.northEast.lat, mapBounds.northEast.lng],
        ]
      )
      map.fitBounds(bounds, {
        animate: !prefersReducedMotion(),
        maxZoom: CANONICAL_PLACE_ZOOM,
        padding: [56, 56],
      })
    }

    const applyMarkerVisibility = () => {
      updateMarkerCollisionVisibility({
        focusedMapPointId: focusedMapPointIdRef.current,
        map,
        markerData,
        markersByPointId: markersByPointIdRef.current,
      })
    }

    map.on("zoomend moveend", applyMarkerVisibility)
    const animationFrame = window.requestAnimationFrame(() => {
      if (mapRef.current === map) {
        map.invalidateSize()
        applyMarkerVisibility()
      }
    })

    return () => {
      window.cancelAnimationFrame(animationFrame)
      map.off("zoomend moveend", applyMarkerVisibility)
      markerLayer.eachLayer((layer) => {
        layer.off()
      })
      markerLayer.remove()
      if (markerLayerRef.current === markerLayer) {
        markerLayerRef.current = null
      }
      if (markerDataRef.current === markerData) {
        markerDataRef.current = []
      }
    }
  }, [leafletModule, onMarkerFocus, pointsKey])

  useEffect(() => {
    focusedMapPointIdRef.current = focusedMapPointId
    const map = mapRef.current

    if (map !== null) {
      updateMarkerCollisionVisibility({
        focusedMapPointId,
        map,
        markerData: markerDataRef.current,
        markersByPointId: markersByPointIdRef.current,
      })
    }

    if (focusedMapPointId === null) {
      return
    }

    const marker = markersByPointIdRef.current.get(focusedMapPointId)

    if (map === null || marker === undefined) {
      return
    }

    const location = marker.getLatLng()
    if (prefersReducedMotion()) {
      map.setView(location, CANONICAL_PLACE_ZOOM)
    } else {
      map.flyTo(location, CANONICAL_PLACE_ZOOM, {
        duration: 0.65,
      })
    }
    marker.openPopup()
  }, [focusedMapPointId])

  return (
    <div className="grid gap-2">
      <div
        ref={containerRef}
        aria-label={label}
        className={cn(
          "trip-leaflet-map relative z-0 h-[min(58vh,40rem)] min-h-[20rem] w-full overflow-hidden bg-muted/30 sm:min-h-[24rem] lg:min-h-[28rem]",
          layout === "sticky" &&
            "xl:h-[clamp(15rem,38dvh,30rem)] xl:min-h-0 2xl:h-[clamp(18rem,42dvh,34rem)]"
        )}
        role="img"
      />
      <div className="border-t bg-background px-4 py-2 sm:px-5">
        <p className="app-muted text-xs">
          Map tiles use the application-controlled OpenStreetMap standard HTTPS
          tile layer.
        </p>
      </div>
      {mapError !== null ? (
        <div className="mx-4 mb-4 rounded-[var(--app-control-radius)] border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 sm:mx-5">
          <p className="font-medium">{mapError.title}</p>
          <p className="mt-1 leading-6">{mapError.message}</p>
        </div>
      ) : null}
    </div>
  )
}

function MapLegend({ points }: { points: TripMapPoint[] }) {
  const visibleKinds = getVisibleKinds(points)

  if (visibleKinds.length === 0) {
    return null
  }

  return (
    <ul className="flex flex-wrap gap-2 text-xs" aria-label="Map legend">
      {visibleKinds.map((kind) => (
        <li
          key={kind}
          className="inline-flex items-center gap-1.5 rounded-full border bg-soft-surface px-2.5 py-1"
        >
          <span className={`trip-map-legend-dot trip-map-legend-dot-${kind}`} />
          <span>{getPointTypeLabel(kind)}</span>
        </li>
      ))}
    </ul>
  )
}

function StopSummary({
  focusedMapPointId,
  layout,
  onMarkerFocus,
  points,
}: {
  focusedMapPointId: string | null
  layout: TripMapLayout
  onMarkerFocus: (mapPointId: string) => void
  points: TripMapPoint[]
}) {
  const summaryPoints = getSummaryPoints(points)

  if (summaryPoints.length === 0) {
    return (
      <div className="border-t bg-background px-4 py-4 sm:px-5">
        <p className="app-muted text-sm">
          No verified map points are available yet. The written itinerary remains
          available below.
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "grid gap-3 border-t bg-background px-4 py-4 sm:px-5",
        layout === "sticky" && "xl:max-h-[min(9rem,22dvh)] xl:overflow-y-auto"
      )}
    >
      <h3 className="text-sm font-medium">Mapped Journey</h3>
      <ol
        className={cn(
          "grid gap-2 sm:grid-cols-2 xl:grid-cols-3",
          layout === "sticky" && "xl:grid-cols-1 2xl:grid-cols-2"
        )}
      >
        {summaryPoints.map((point) => {
          const selected = focusedMapPointId === point.id

          return (
            <li key={point.id}>
              <button
                type="button"
                className={`app-focus-ring flex h-full w-full min-w-0 items-start gap-2 rounded-[var(--app-control-radius)] border bg-soft-surface/70 p-2.5 text-left transition-[background-color,border-color,box-shadow] ${
                  selected
                    ? "border-primary bg-accent shadow-sm ring-3 ring-brand-orange/20"
                    : "hover:border-primary/30"
                }`}
                data-map-point-id={point.id}
                onClick={() => {
                  onMarkerFocus(point.id)
                }}
              >
                <span
                  className={`trip-map-summary-marker trip-map-summary-marker-${point.kind}`}
                >
                  {getSummaryMarkerText(point)}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-muted-foreground">
                    {getPointTypeLabel(point.kind)}
                  </span>
                  <span className="block truncate text-sm font-medium">
                    {point.label}
                  </span>
                  {point.day !== undefined ? (
                    <span className="app-muted block text-xs">
                      Day {point.day}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function buildSafePopupContent(popup: TripMarkerPopupText) {
  const container = document.createElement("div")
  container.className = "trip-map-popup-content"

  if (popup.imageUrl !== undefined) {
    const image = document.createElement("img")
    image.alt = popup.title
    image.className = "trip-map-popup-image"
    image.loading = "lazy"
    image.referrerPolicy = "no-referrer"
    image.src = popup.imageUrl
    container.append(image)
  }

  const title = document.createElement("p")
  title.className = "trip-map-popup-title"
  title.textContent = popup.title
  container.append(title)

  const type = document.createElement("p")
  type.className = "trip-map-popup-meta"
  type.textContent = popup.sequenceLabel
    ? `${popup.typeLabel} - ${popup.sequenceLabel}`
    : popup.typeLabel
  container.append(type)

  if (popup.formattedAddress !== undefined) {
    const address = document.createElement("p")
    address.className = "trip-map-popup-address"
    address.textContent = popup.formattedAddress
    container.append(address)
  }

  return container
}

function updateMarkerCollisionVisibility({
  focusedMapPointId,
  map,
  markerData,
  markersByPointId,
}: {
  focusedMapPointId: string | null
  map: LeafletMap
  markerData: TripMarkerData[]
  markersByPointId: Map<string, Marker>
}) {
  const visibility = resolveTripMarkerVisibility({
    focusedMapPointId,
    markers: markerData,
    screenPositions: markerData.map((marker) => {
      const point = map.latLngToContainerPoint([
        marker.position.lat,
        marker.position.lng,
      ])

      return {
        id: marker.id,
        x: point.x,
        y: point.y,
      }
    }),
  })
  const visibilityById = new Map(
    visibility.map((item) => [item.id, item.visible] as const)
  )

  for (const markerInfo of markerData) {
    const marker = markersByPointId.get(markerInfo.id)

    if (marker === undefined) {
      continue
    }

    const visible = visibilityById.get(markerInfo.id) ?? true
    marker.setOpacity(visible ? 1 : 0)
    marker.setZIndexOffset(
      getTripMarkerRenderPriority(markerInfo, focusedMapPointId)
    )
    const element = marker.getElement()

    if (element !== undefined) {
      const selected = focusedMapPointId === markerInfo.id
      const markerElement = element.querySelector<HTMLElement>(".trip-map-marker")

      element.style.pointerEvents = visible ? "" : "none"
      element.setAttribute("aria-hidden", visible ? "false" : "true")
      element.classList.toggle("trip-map-div-icon-selected", selected)
      markerElement?.classList.toggle("trip-map-marker-selected", selected)
    }
  }
}

function buildMarkerHtml(
  kind: TripMapPointKind,
  markerLabel: string,
  selected: boolean
) {
  return `<span class="trip-map-marker trip-map-marker-${kind}${
    selected ? " trip-map-marker-selected" : ""
  }">${escapeHtml(markerLabel)}</span>`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function scrollPlaceCardIntoView(mapPointId: string) {
  const placeCards = document.querySelectorAll<HTMLElement>(
    "[data-map-point-id]"
  )

  for (const placeCard of placeCards) {
    if (placeCard.dataset.mapPointId === mapPointId) {
      placeCard.focus({ preventScroll: true })
      placeCard.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "center",
      })
      return
    }
  }
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function getMapStatusText(lookupCount: number, placeCount: number) {
  if (lookupCount === 0) {
    return "No saved place query is available yet, so the map uses a documented global fallback center."
  }

  if (placeCount === 0) {
    return "Looking up canonical Geoapify coordinates. Places without verified coordinates, outliers, or duplicates are skipped."
  }

  if (placeCount === 1) {
    return "Showing 1 verified map point centered on its canonical coordinate."
  }

  return `Showing ${placeCount} verified map points framed together with app-controlled OpenStreetMap tiles.`
}

function getVisibleKinds(points: TripMapPoint[]) {
  return (["origin", "destination", "activity", "hotel"] as const).filter((kind) =>
    points.some((point) => point.kind === kind)
  )
}

function getSummaryPoints(points: TripMapPoint[]) {
  return [
    ...points.filter((point) => point.kind === "origin"),
    ...points.filter((point) => point.kind === "destination"),
    ...points
      .filter((point) => point.kind === "activity")
      .sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0)),
    ...points.filter((point) => point.kind === "hotel"),
  ]
}

function getConnectionPoints(points: TripMapPoint[]) {
  return [
    ...points.filter((point) => point.kind === "origin"),
    ...points.filter((point) => point.kind === "destination"),
    ...points
      .filter((point) => point.kind === "activity")
      .sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0)),
  ]
}

function buildPointsKey(points: TripMapPoint[]) {
  return points
    .map((point) =>
      [
        point.id,
        point.kind,
        point.sequence ?? "",
        point.lat,
        point.lng,
        point.providerPlaceId ?? "",
        point.imageUrl ?? "",
      ].join(":")
    )
    .join("|")
}

function getSummaryMarkerText(point: TripMapPoint) {
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

export { TripMapSection }
