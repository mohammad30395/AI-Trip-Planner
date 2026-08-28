"use client"

import { useEffect, useMemo, useState } from "react"

import { ExternalImageFrame } from "@/components/images/external-image-frame"
import { Button } from "@/components/ui/button"
import {
  createUserSafeError,
  formatUserSafeErrorMessage,
  isAbortError,
} from "@/lib/errors/user-safe-error"
import {
  getGeoapifyAttribution,
  parsePlaceEnrichmentResponseEnvelope,
  type PlaceEnrichment,
  type PlaceEnrichmentRequest,
} from "@/lib/places/place-enrichment"
import {
  buildActivityPlaceEnrichmentRequest,
  buildHotelPlaceEnrichmentRequest,
} from "@/lib/places/place-lookup-policy"

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
  request: PlaceEnrichmentRequest | null,
  retryToken = 0
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
    const controller = new AbortController()

    if (retryToken > 0) {
      placeLookupCache.delete(cacheKey)
    }

    getCachedPlaceEnrichment(cacheKey, request, controller.signal).then((result) => {
      if (isActive) {
        setState(result)
      }
    })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [cacheKey, request, retryToken])

  return request === null ? { status: "idle" } : state
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
  area,
  destination,
  mapControls,
  name,
}: {
  address: string | null
  area: string | null
  destination: string
  mapControls?: PlaceMapControls
  name: string
}) {
  const request = useMemo<PlaceEnrichmentRequest>(
    () => buildHotelPlaceEnrichmentRequest({ address, area, destination, name }),
    [address, area, destination, name]
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
  const request = useMemo(
    () =>
      buildActivityPlaceEnrichmentRequest({
        address,
        approximateArea,
        destination,
        placeName,
      }),
    [address, approximateArea, destination, placeName]
  )

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
  const [retryToken, setRetryToken] = useState(0)
  const state = usePlaceEnrichment(request, retryToken)

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
      <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
        <p className="app-muted text-sm">
          {state.status === "empty" ? emptyMessage : state.message}
        </p>
        {request !== null ? (
          <div>
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                setRetryToken((current) => current + 1)
              }}
            >
              Retry Place Lookup
            </Button>
          </div>
        ) : null}
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
      <ExternalImageFrame
        fallbackLabel={place.displayName}
        image={place.image}
        state={place.image === undefined ? "missing" : "ready"}
      />
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
    normalizeCachePart(request.lookupKind),
    normalizeCachePart(request.destination),
    normalizeCachePart(request.city),
    normalizeCachePart(request.area),
    normalizeCachePart(request.country),
    normalizeCachePart(request.address),
  ].join("|")
}

async function getCachedPlaceEnrichment(
  cacheKey: string,
  request: PlaceEnrichmentRequest,
  signal?: AbortSignal
) {
  const cached = placeLookupCache.get(cacheKey)

  if (cached !== undefined) {
    return cached
  }

  const pending = fetchPlaceEnrichment(request, signal).then((result) => {
    if (
      result.status === "error" &&
      result.message === "Place enrichment request was cancelled."
    ) {
      placeLookupCache.delete(cacheKey)
    }

    return result
  })
  placeLookupCache.set(cacheKey, pending)
  return pending
}

async function fetchPlaceEnrichment(
  request: PlaceEnrichmentRequest,
  signal?: AbortSignal
): Promise<PlaceEnrichmentStatus> {
  try {
    const response = await fetch("/api/place-enrichment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal,
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
          message: formatUserSafeErrorMessage(
            createUserSafeError({
              code: "place_lookup_empty",
              title: "Place not found",
              message:
                "The itinerary text is still available. Retry this lookup or continue without verified coordinates.",
              retry: "same_stage",
            })
          ),
        }
      }

      return {
        status: "error",
        message: formatUserSafeErrorMessage(
          createUserSafeError({
            code:
              response.status === 429
                ? "quota_exceeded"
                : "place_lookup_failed",
            title: "Place lookup failed",
            message:
              "This place card could not be enriched right now. Retry only this lookup when the provider is available.",
            retry: "same_stage",
            diagnostic: {
              source: "place-enrichment",
              reason: `status-${response.status}`,
            },
          })
        ),
      }
    }

    return {
      status: "success",
      place: parsed.data.place,
    }
  } catch (error) {
    if (isAbortError(error)) {
      return {
        status: "error",
        message: "Place enrichment request was cancelled.",
      }
    }

    return {
      status: "error",
      message: formatUserSafeErrorMessage(
        createUserSafeError({
          code: "network_unavailable",
          title: "Place lookup unavailable",
          message:
            "The itinerary text is still available. Retry this place lookup without regenerating the trip.",
          retry: "same_stage",
          diagnostic: {
            source: "place-enrichment",
            reason: error instanceof Error ? error.name : "UnknownError",
          },
        })
      ),
    }
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
  usePlaceEnrichment,
  usePlaceEnrichments,
  type PlaceEnrichmentLookupInput,
  type PlaceEnrichmentLookupStatus,
  type PlaceEnrichmentStatus,
  type PlaceMapControls,
}
