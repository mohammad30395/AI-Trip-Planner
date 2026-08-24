"use client"

import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  getGeoapifyAttribution,
  parsePlaceEnrichmentResponseEnvelope,
  type PlaceEnrichment,
  type PlaceEnrichmentRequest,
} from "@/lib/places/place-enrichment"

type PlaceEnrichmentStatus =
  | {
      status: "idle"
    }
  | {
      status: "loading"
    }
  | {
      status: "success"
      place: PlaceEnrichment
    }
  | {
      status: "empty"
      message: string
    }
  | {
      status: "error"
      message: string
    }

type PlaceEnrichmentLookupInput = {
  id: string
  request: PlaceEnrichmentRequest
}

type PlaceEnrichmentLookupStatus = {
  id: string
  status: PlaceEnrichmentStatus
}

type PlaceMapControls = {
  focusedProviderPlaceId: string | null
  onFocusPlace: (providerPlaceId: string) => void
}

const placeLookupCache = new Map<string, Promise<PlaceEnrichmentStatus>>()

function usePlaceEnrichment(
  request: PlaceEnrichmentRequest | null
): PlaceEnrichmentStatus {
  const cacheKey = useMemo(
    () => (request === null ? null : buildPlaceEnrichmentCacheKey(request)),
    [request]
  )
  const [state, setState] = useState<PlaceEnrichmentStatus>(
    request === null ? { status: "idle" } : { status: "loading" }
  )

  useEffect(() => {
    if (request === null || cacheKey === null) {
      return
    }

    let isActive = true

    getCachedPlaceEnrichment(cacheKey, request).then((result) => {
      if (isActive) {
        setState(result)
      }
    })

    return () => {
      isActive = false
    }
  }, [cacheKey, request])

  return state
}

function usePlaceEnrichments(
  lookups: readonly PlaceEnrichmentLookupInput[]
): PlaceEnrichmentLookupStatus[] {
  const lookupEntries = useMemo(
    () =>
      lookups.map((lookup) => ({
        ...lookup,
        cacheKey: buildPlaceEnrichmentCacheKey(lookup.request),
      })),
    [lookups]
  )
  const [resultsByCacheKey, setResultsByCacheKey] = useState<
    Record<string, PlaceEnrichmentStatus>
  >({})

  useEffect(() => {
    if (lookupEntries.length === 0) {
      return
    }

    let isActive = true

    Promise.all(
      lookupEntries.map((entry) =>
        getCachedPlaceEnrichment(entry.cacheKey, entry.request).then((result) => ({
          cacheKey: entry.cacheKey,
          result,
        }))
      )
    ).then((results) => {
      if (!isActive) {
        return
      }

      setResultsByCacheKey((currentResults) => {
        const nextResults = { ...currentResults }

        for (const result of results) {
          nextResults[result.cacheKey] = result.result
        }

        return nextResults
      })
    })

    return () => {
      isActive = false
    }
  }, [lookupEntries])

  return lookupEntries.map((entry) => ({
    id: entry.id,
    status: resultsByCacheKey[entry.cacheKey] ?? { status: "loading" },
  }))
}

function HotelPlaceEnrichment({
  address,
  destination,
  mapControls,
  name,
}: {
  address: string | null
  destination: string
  mapControls?: PlaceMapControls
  name: string
}) {
  const request = useMemo<PlaceEnrichmentRequest>(
    () => ({
      query: name,
      destination,
      ...(address !== null ? { address } : {}),
    }),
    [address, destination, name]
  )

  return (
    <PlaceEnrichmentPanel
      label="Hotel place enrichment"
      mapControls={mapControls}
      request={request}
    />
  )
}

function ActivityPlaceEnrichment({
  address,
  approximateArea,
  destination,
  mapControls,
  placeName,
}: {
  address: string | null
  approximateArea: string | null
  destination: string
  mapControls?: PlaceMapControls
  placeName: string | null
}) {
  const request = useMemo<PlaceEnrichmentRequest | null>(() => {
    if (placeName === null && address === null) {
      return null
    }

    return {
      query: placeName ?? address ?? "",
      destination,
      ...(address !== null ? { address } : {}),
      ...(approximateArea !== null ? { city: approximateArea } : {}),
    }
  }, [address, approximateArea, destination, placeName])

  return (
    <PlaceEnrichmentPanel
      emptyMessage="No canonical place lookup is available for this activity yet."
      label="Activity place enrichment"
      mapControls={mapControls}
      request={request}
    />
  )
}

function PlaceEnrichmentPanel({
  emptyMessage = "No matching canonical place was found.",
  label,
  mapControls,
  request,
}: {
  emptyMessage?: string
  label: string
  mapControls?: PlaceMapControls
  request: PlaceEnrichmentRequest | null
}) {
  const state = usePlaceEnrichment(request)

  if (state.status === "idle") {
    return (
      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="app-muted text-sm">{emptyMessage}</p>
      </div>
    )
  }

  if (state.status === "loading") {
    return (
      <div
        aria-busy="true"
        aria-label={`${label} loading`}
        className="rounded-lg border bg-muted/20 p-3"
      >
        <div className="h-4 w-2/3 rounded bg-muted" />
        <div className="mt-3 h-3 w-full rounded bg-muted/70" />
        <div className="mt-2 h-3 w-5/6 rounded bg-muted/70" />
      </div>
    )
  }

  if (state.status === "empty" || state.status === "error") {
    return (
      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="app-muted text-sm">
          {state.status === "empty" ? emptyMessage : state.message}
        </p>
      </div>
    )
  }

  return <CanonicalPlaceDetails mapControls={mapControls} place={state.place} />
}

function CanonicalPlaceDetails({
  mapControls,
  place,
}: {
  mapControls: PlaceMapControls | undefined
  place: PlaceEnrichment
}) {
  const isFocused =
    mapControls?.focusedProviderPlaceId === place.providerPlaceId

  return (
    <div
      data-provider-place-id={place.providerPlaceId}
      className={`overflow-hidden rounded-lg border bg-muted/10 transition-shadow ${
        isFocused ? "ring-3 ring-ring/40" : ""
      }`}
      tabIndex={-1}
    >
      <ProviderImage displayName={place.displayName} imageUrl={place.image?.url} />
      <div className="grid gap-3 p-3">
        <div>
          <h4 className="text-sm font-medium">Canonical place</h4>
          <p className="app-muted mt-1 text-xs">
            Provider-enriched coordinates are canonical for future map use.
          </p>
        </div>
        <dl className="grid gap-2 text-sm">
          <RequiredDetail label="Name" value={place.displayName} />
          <RequiredDetail label="Formatted address" value={place.formattedAddress} />
          <RequiredDetail label="Provider place ID" value={place.providerPlaceId} />
          <RequiredDetail
            label="Canonical coordinates"
            value={`${place.location.lat.toFixed(6)}, ${place.location.lng.toFixed(
              6
            )}`}
          />
        </dl>
        {mapControls !== undefined ? (
          <div>
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                mapControls.onFocusPlace(place.providerPlaceId)
              }}
            >
              Show on map
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ProviderImage({
  displayName,
  imageUrl,
}: {
  displayName: string
  imageUrl: string | undefined
}) {
  const safeImageUrl = getSafeHttpsImageUrl(imageUrl)

  if (safeImageUrl === null) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center border-b bg-muted/40 text-xs font-medium uppercase text-muted-foreground">
        Image pending
      </div>
    )
  }

  return (
    <div
      aria-label={`Provider image for ${displayName}`}
      className="aspect-[16/9] border-b bg-cover bg-center"
      role="img"
      style={{ backgroundImage: `url("${safeImageUrl}")` }}
    />
  )
}

function PlaceAttributionNotice() {
  const attribution = getGeoapifyAttribution()

  return (
    <aside
      aria-label="Place data attribution"
      className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground"
    >
      <p>
        Place data:{" "}
        <a
          className="font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={attribution.providerUrl}
          rel="noreferrer"
          target="_blank"
        >
          {attribution.providerLabel}
        </a>{" "}
        and{" "}
        <a
          className="font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={attribution.osmUrl}
          rel="noreferrer"
          target="_blank"
        >
          {attribution.osmLabel}
        </a>
        .
      </p>
    </aside>
  )
}

function RequiredDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-foreground">{label}</dt>
      <dd className="mt-1 break-words text-muted-foreground">{value}</dd>
    </div>
  )
}

function buildPlaceEnrichmentCacheKey(request: PlaceEnrichmentRequest) {
  return [
    normalizeCachePart(request.query),
    normalizeCachePart(request.destination),
    normalizeCachePart(request.city),
    normalizeCachePart(request.address),
  ].join("|")
}

async function getCachedPlaceEnrichment(
  cacheKey: string,
  request: PlaceEnrichmentRequest
) {
  const cached = placeLookupCache.get(cacheKey)

  if (cached !== undefined) {
    return cached
  }

  const pending = fetchPlaceEnrichment(request)
  placeLookupCache.set(cacheKey, pending)
  return pending
}

async function fetchPlaceEnrichment(
  request: PlaceEnrichmentRequest
): Promise<PlaceEnrichmentStatus> {
  try {
    const response = await fetch("/api/place-enrichment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    })

    let body: unknown

    try {
      body = await response.json()
    } catch {
      return {
        status: "error",
        message: "Place enrichment returned an unreadable response.",
      }
    }

    const parsed = parsePlaceEnrichmentResponseEnvelope(body)

    if (!parsed.ok) {
      return {
        status: "error",
        message: "Place enrichment returned invalid data.",
      }
    }

    if (!parsed.data.ok) {
      if (response.status === 404) {
        return {
          status: "empty",
          message: parsed.data.error,
        }
      }

      return {
        status: "error",
        message: parsed.data.error,
      }
    }

    return {
      status: "success",
      place: parsed.data.place,
    }
  } catch {
    return {
      status: "error",
      message: "Place enrichment is unavailable right now.",
    }
  }
}

function getSafeHttpsImageUrl(imageUrl: string | undefined) {
  if (imageUrl === undefined) {
    return null
  }

  try {
    const parsedUrl = new URL(imageUrl)
    return parsedUrl.protocol === "https:" ? parsedUrl.toString() : null
  } catch {
    return null
  }
}

function normalizeCachePart(value: string | undefined) {
  return value?.trim().toLocaleLowerCase().replace(/\s+/g, " ") ?? ""
}

export {
  ActivityPlaceEnrichment,
  HotelPlaceEnrichment,
  PlaceAttributionNotice,
  buildPlaceEnrichmentCacheKey,
  getSafeHttpsImageUrl,
  usePlaceEnrichment,
  usePlaceEnrichments,
  type PlaceEnrichmentLookupInput,
  type PlaceEnrichmentLookupStatus,
  type PlaceEnrichmentStatus,
  type PlaceMapControls,
}
