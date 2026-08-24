import "server-only"

import {
  buildGeoapifySearchText,
  getGeoapifyAttribution,
  type PlaceEnrichment,
  type PlaceEnrichmentImage,
  type PlaceEnrichmentRequest,
} from "@/lib/places/place-enrichment"

const GEOAPIFY_GEOCODING_URL = "https://api.geoapify.com/v1/geocode/search"
const GEOAPIFY_PLACE_DETAILS_URL = "https://api.geoapify.com/v2/place-details"
const GEOAPIFY_RESULT_LIMIT = "3"
export const GEOAPIFY_TIMEOUT_MS = 8_000

type GeoapifyGeocodingResponse = {
  results?: unknown[]
}

type GeoapifyPlaceDetailsResponse = {
  features?: unknown[]
}

type GeoapifyStatus =
  | "provider_auth_failed"
  | "provider_rate_limited"
  | "provider_unavailable"
  | "provider_malformed"
  | "provider_no_results"
  | "provider_timeout"

export class GeoapifyConfigurationError extends Error {
  readonly missingVariables: string[]

  constructor(missingVariables: string[]) {
    super("Geoapify configuration is incomplete.")
    this.name = "GeoapifyConfigurationError"
    this.missingVariables = missingVariables
  }
}

export class GeoapifyProviderError extends Error {
  readonly code: GeoapifyStatus
  readonly status: number

  constructor(code: GeoapifyStatus, status: number, message: string) {
    super(message)
    this.name = "GeoapifyProviderError"
    this.code = code
    this.status = status
  }
}

export async function enrichPlaceWithGeoapify(
  request: PlaceEnrichmentRequest,
  signal: AbortSignal
): Promise<PlaceEnrichment> {
  const apiKey = getGeoapifyApiKey()
  const geocodingResponse = await fetchGeoapifyJson<GeoapifyGeocodingResponse>(
    buildGeocodingUrl(request, apiKey),
    "geocoding",
    signal
  )

  const basePlace = normalizeBestGeocodingResult(geocodingResponse)
  const image = await getOptionalDetailsImage(
    basePlace.providerPlaceId,
    apiKey,
    signal
  )

  return {
    ...basePlace,
    ...(image !== undefined ? { image } : {}),
  }
}

function getGeoapifyApiKey() {
  const apiKey = process.env.GEOAPIFY_API_KEY

  if (apiKey === undefined || apiKey.trim().length === 0) {
    throw new GeoapifyConfigurationError(["GEOAPIFY_API_KEY"])
  }

  return apiKey
}

function buildGeocodingUrl(request: PlaceEnrichmentRequest, apiKey: string) {
  const url = new URL(GEOAPIFY_GEOCODING_URL)
  url.searchParams.set("text", buildGeoapifySearchText(request))
  url.searchParams.set("format", "json")
  url.searchParams.set("lang", "en")
  url.searchParams.set("limit", GEOAPIFY_RESULT_LIMIT)
  url.searchParams.set("apiKey", apiKey)
  return url
}

function buildPlaceDetailsUrl(providerPlaceId: string, apiKey: string) {
  const url = new URL(GEOAPIFY_PLACE_DETAILS_URL)
  url.searchParams.set("id", providerPlaceId)
  url.searchParams.set("features", "details")
  url.searchParams.set("lang", "en")
  url.searchParams.set("apiKey", apiKey)
  return url
}

async function fetchGeoapifyJson<T>(
  url: URL,
  endpoint: "geocoding" | "place-details",
  signal: AbortSignal
): Promise<T> {
  let response: Response

  try {
    response = await fetch(url, {
      method: "GET",
      signal,
      headers: {
        Accept: "application/json",
      },
    })
  } catch (error) {
    if (isAbortError(error)) {
      throw new GeoapifyProviderError(
        "provider_timeout",
        504,
        "Geoapify request timed out."
      )
    }

    if (process.env.NODE_ENV === "development") {
      console.warn("Geoapify fetch diagnostic", {
        endpoint,
        name: error instanceof Error ? error.name : "UnknownError",
      })
    }

    throw new GeoapifyProviderError(
      "provider_unavailable",
      502,
      "Geoapify request failed."
    )
  }

  if (!response.ok) {
    throw mapGeoapifyHttpError(response.status)
  }

  try {
    return (await response.json()) as T
  } catch {
    throw new GeoapifyProviderError(
      "provider_malformed",
      502,
      "Geoapify returned malformed JSON."
    )
  }
}

function normalizeBestGeocodingResult(
  response: GeoapifyGeocodingResponse
): PlaceEnrichment {
  if (!Array.isArray(response.results) || response.results.length === 0) {
    throw new GeoapifyProviderError(
      "provider_no_results",
      404,
      "Geoapify returned no matching places."
    )
  }

  for (const result of response.results) {
    const normalized = normalizeGeocodingResult(result)

    if (normalized !== null) {
      return normalized
    }
  }

  throw new GeoapifyProviderError(
    "provider_malformed",
    502,
    "Geoapify returned no valid place records."
  )
}

function normalizeGeocodingResult(value: unknown): PlaceEnrichment | null {
  if (!isRecord(value)) {
    return null
  }

  const providerPlaceId = readNonEmptyString(value.place_id)
  const formattedAddress = readNonEmptyString(value.formatted)
  const lat = readCoordinate(value.lat, -90, 90)
  const lng = readCoordinate(value.lon, -180, 180)

  if (
    providerPlaceId === null ||
    formattedAddress === null ||
    lat === null ||
    lng === null
  ) {
    return null
  }

  return {
    provider: "geoapify",
    providerPlaceId,
    displayName: getDisplayName(value, formattedAddress),
    formattedAddress,
    location: {
      lat,
      lng,
    },
    attribution: getGeoapifyAttribution(),
  }
}

async function getOptionalDetailsImage(
  providerPlaceId: string,
  apiKey: string,
  signal: AbortSignal
): Promise<PlaceEnrichmentImage | undefined> {
  try {
    const detailsResponse =
      await fetchGeoapifyJson<GeoapifyPlaceDetailsResponse>(
        buildPlaceDetailsUrl(providerPlaceId, apiKey),
        "place-details",
        signal
      )

    return extractWikiAndMediaImage(detailsResponse)
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Geoapify place details diagnostic", {
        code:
          error instanceof GeoapifyProviderError
            ? error.code
            : "provider_unavailable",
        status: error instanceof GeoapifyProviderError ? error.status : 502,
      })
    }

    return undefined
  }
}

function extractWikiAndMediaImage(
  response: GeoapifyPlaceDetailsResponse
): PlaceEnrichmentImage | undefined {
  if (!Array.isArray(response.features)) {
    return undefined
  }

  for (const feature of response.features) {
    if (!isRecord(feature) || !isRecord(feature.properties)) {
      continue
    }

    if (feature.properties.feature_type !== "details") {
      continue
    }

    const wikiAndMedia = feature.properties.wiki_and_media

    if (!isRecord(wikiAndMedia)) {
      continue
    }

    const imageUrl = readValidHttpsUrl(wikiAndMedia.image)

    if (imageUrl !== null) {
      return {
        url: imageUrl,
        source: "geoapify",
      }
    }
  }

  return undefined
}

function getDisplayName(
  result: Record<string, unknown>,
  formattedAddress: string
) {
  return (
    readNonEmptyString(result.name) ??
    readNonEmptyString(result.address_line1) ??
    formattedAddress.split(",")[0]?.trim() ??
    formattedAddress
  )
}

function mapGeoapifyHttpError(status: number) {
  if (status === 401 || status === 403) {
    return new GeoapifyProviderError(
      "provider_auth_failed",
      502,
      "Geoapify authentication failed."
    )
  }

  if (status === 429) {
    return new GeoapifyProviderError(
      "provider_rate_limited",
      429,
      "Geoapify rate or quota limit was reached."
    )
  }

  if (status >= 500) {
    return new GeoapifyProviderError(
      "provider_unavailable",
      502,
      "Geoapify is unavailable."
    )
  }

  return new GeoapifyProviderError(
    "provider_unavailable",
    502,
    "Geoapify request was rejected."
  )
}

function readCoordinate(
  value: unknown,
  min: number,
  max: number
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null
  }

  if (value < min || value > max) {
    return null
  }

  return value
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readValidHttpsUrl(value: unknown): string | null {
  const rawUrl = readNonEmptyString(value)

  if (rawUrl === null) {
    return null
  }

  try {
    const url = new URL(rawUrl)

    if (url.protocol !== "https:") {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}
