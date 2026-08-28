import {
  normalizeExternalImage,
  type ExternalImage,
} from "@/lib/images/external-image"

export type PlaceEnrichmentRequest = {
  query: string
  lookupKind?: PlaceLookupKind
  destination?: string
  city?: string
  area?: string
  country?: string
  address?: string
}

export type PlaceLookupKind = "city" | "hotel" | "specific_place"

export type PlaceMatchStatus = "verified" | "probable" | "no_confident_match"

export type PlaceEnrichmentImage = ExternalImage

export type PlaceEnrichmentAttribution = {
  provider: "Geoapify"
  providerLabel: "Powered by Geoapify"
  providerUrl: "https://www.geoapify.com/"
  osmLabel: "OpenStreetMap contributors"
  osmUrl: "https://www.openstreetmap.org/copyright"
}

export type PlaceEnrichment = {
  provider: "geoapify"
  providerPlaceId: string
  displayName: string
  formattedAddress: string
  location: {
    lat: number
    lng: number
  }
  image?: PlaceEnrichmentImage
  attribution: PlaceEnrichmentAttribution
  matchStatus: Exclude<PlaceMatchStatus, "no_confident_match">
  matchScore?: number
  matchedQuery: string
}

export type PlaceEnrichmentResponseEnvelope =
  | {
      ok: true
      place: PlaceEnrichment
    }
  | {
      ok: false
      error: string
      missingVariables?: string[]
    }

export type PlaceEnrichmentResponseParseResult =
  | {
      ok: true
      data: PlaceEnrichmentResponseEnvelope
    }
  | {
      ok: false
      error: string
    }

type ValidationResult =
  | {
      ok: true
      data: PlaceEnrichmentRequest
    }
  | {
      ok: false
      error: string
    }

const MAX_QUERY_LENGTH = 160
const MAX_CONTEXT_LENGTH = 120
const MAX_COMBINED_SEARCH_LENGTH = 320

export function parsePlaceEnrichmentRequest(value: unknown): ValidationResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      ok: false,
      error: "Place enrichment request must be an object.",
    }
  }

  const record = value as Record<string, unknown>
  const query = readTrimmedString(record.query, "query", MAX_QUERY_LENGTH, true)

  if (!query.ok) {
    return query
  }

  const destination = readTrimmedString(
    record.destination,
    "destination",
    MAX_CONTEXT_LENGTH,
    false
  )
  const lookupKind = readLookupKind(record.lookupKind)
  const city = readTrimmedString(
    record.city,
    "city",
    MAX_CONTEXT_LENGTH,
    false
  )
  const area = readTrimmedString(
    record.area,
    "area",
    MAX_CONTEXT_LENGTH,
    false
  )
  const country = readTrimmedString(
    record.country,
    "country",
    MAX_CONTEXT_LENGTH,
    false
  )
  const address = readTrimmedString(
    record.address,
    "address",
    MAX_CONTEXT_LENGTH,
    false
  )

  if (!destination.ok) {
    return destination
  }
  if (!lookupKind.ok) {
    return lookupKind
  }
  if (!city.ok) {
    return city
  }
  if (!area.ok) {
    return area
  }
  if (!country.ok) {
    return country
  }
  if (!address.ok) {
    return address
  }

  const data: PlaceEnrichmentRequest = {
    query: query.data,
    ...(lookupKind.data !== undefined ? { lookupKind: lookupKind.data } : {}),
    ...(destination.data !== undefined ? { destination: destination.data } : {}),
    ...(city.data !== undefined ? { city: city.data } : {}),
    ...(area.data !== undefined ? { area: area.data } : {}),
    ...(country.data !== undefined ? { country: country.data } : {}),
    ...(address.data !== undefined ? { address: address.data } : {}),
  }

  if (buildGeoapifySearchText(data).length > MAX_COMBINED_SEARCH_LENGTH) {
    return {
      ok: false,
      error: "Place enrichment request is too long.",
    }
  }

  return {
    ok: true,
    data,
  }
}

export function buildGeoapifySearchText(
  request: PlaceEnrichmentRequest
): string {
  const parts = [
    request.query,
    request.address,
    request.area,
    request.city,
    request.destination,
    request.country,
  ].filter((part): part is string => part !== undefined && part.length > 0)

  const seen = new Set<string>()
  return parts
    .filter((part) => {
      const key = part.toLocaleLowerCase()
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
    .join(", ")
}

export function getGeoapifyAttribution(): PlaceEnrichmentAttribution {
  return {
    provider: "Geoapify",
    providerLabel: "Powered by Geoapify",
    providerUrl: "https://www.geoapify.com/",
    osmLabel: "OpenStreetMap contributors",
    osmUrl: "https://www.openstreetmap.org/copyright",
  }
}

export function parsePlaceEnrichmentResponseEnvelope(
  value: unknown
): PlaceEnrichmentResponseParseResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: "Place enrichment response must be an object.",
    }
  }

  if (value.ok === false) {
    const error = readResponseString(value.error)

    if (error === null) {
      return {
        ok: false,
        error: "Place enrichment error response is invalid.",
      }
    }

    const missingVariables = Array.isArray(value.missingVariables)
      ? value.missingVariables.filter(
          (variable): variable is string =>
            typeof variable === "string" && variable.trim().length > 0
        )
      : undefined

    return {
      ok: true,
      data: {
        ok: false,
        error,
        ...(missingVariables !== undefined ? { missingVariables } : {}),
      },
    }
  }

  if (value.ok !== true) {
    return {
      ok: false,
      error: "Place enrichment response status is invalid.",
    }
  }

  const place = parsePlaceEnrichment(value.place)

  if (!place.ok) {
    return place
  }

  return {
    ok: true,
    data: {
      ok: true,
      place: place.data,
    },
  }
}

function readTrimmedString(
  value: unknown,
  fieldName: string,
  maxLength: number,
  required: true
): { ok: true; data: string } | { ok: false; error: string }
function readTrimmedString(
  value: unknown,
  fieldName: string,
  maxLength: number,
  required: false
): { ok: true; data?: string } | { ok: false; error: string }
function readTrimmedString(
  value: unknown,
  fieldName: string,
  maxLength: number,
  required: boolean
): { ok: true; data?: string } | { ok: false; error: string } {
  if (value === undefined || value === null) {
    if (required) {
      return {
        ok: false,
        error: `${fieldName} is required.`,
      }
    }

    return {
      ok: true,
    }
  }

  if (typeof value !== "string") {
    return {
      ok: false,
      error: `${fieldName} must be a string.`,
    }
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    if (required) {
      return {
        ok: false,
        error: `${fieldName} is required.`,
      }
    }

    return {
      ok: true,
    }
  }

  if (trimmed.length > maxLength) {
    return {
      ok: false,
      error: `${fieldName} is too long.`,
    }
  }

  return {
    ok: true,
    data: trimmed,
  }
}

function readLookupKind(
  value: unknown
):
  | { ok: true; data?: PlaceLookupKind }
  | { ok: false; error: string } {
  if (value === undefined || value === null) {
    return {
      ok: true,
    }
  }

  if (
    value === "city" ||
    value === "hotel" ||
    value === "specific_place"
  ) {
    return {
      ok: true,
      data: value,
    }
  }

  return {
    ok: false,
    error: "lookupKind is invalid.",
  }
}

function parsePlaceEnrichment(
  value: unknown
):
  | {
      ok: true
      data: PlaceEnrichment
    }
  | {
      ok: false
      error: string
    } {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: "Place enrichment place must be an object.",
    }
  }

  const providerPlaceId = readResponseString(value.providerPlaceId)
  const displayName = readResponseString(value.displayName)
  const formattedAddress = readResponseString(value.formattedAddress)
  const matchedQuery = readResponseString(value.matchedQuery)

  if (value.provider !== "geoapify") {
    return {
      ok: false,
      error: "Place enrichment provider is invalid.",
    }
  }

  if (
    providerPlaceId === null ||
    displayName === null ||
    formattedAddress === null ||
    matchedQuery === null
  ) {
    return {
      ok: false,
      error: "Place enrichment text fields are invalid.",
    }
  }

  const location = parseLocation(value.location)

  if (!location.ok) {
    return location
  }

  const attribution = parseAttribution(value.attribution)

  if (!attribution.ok) {
    return attribution
  }

  const image = parseOptionalImage(value.image)

  if (!image.ok) {
    return image
  }

  if (value.matchStatus !== "verified" && value.matchStatus !== "probable") {
    return {
      ok: false,
      error: "Place enrichment match status is invalid.",
    }
  }

  const matchScore =
    value.matchScore === undefined
      ? undefined
      : typeof value.matchScore === "number" && Number.isFinite(value.matchScore)
        ? value.matchScore
        : null

  if (matchScore === null) {
    return {
      ok: false,
      error: "Place enrichment match score is invalid.",
    }
  }

  return {
    ok: true,
    data: {
      provider: "geoapify",
      providerPlaceId,
      displayName,
      formattedAddress,
      location: location.data,
      ...(image.data !== undefined ? { image: image.data } : {}),
      attribution: attribution.data,
      matchStatus: value.matchStatus,
      ...(matchScore !== undefined ? { matchScore } : {}),
      matchedQuery,
    },
  }
}

function parseLocation(
  value: unknown
):
  | {
      ok: true
      data: PlaceEnrichment["location"]
    }
  | {
      ok: false
      error: string
    } {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: "Place enrichment location is invalid.",
    }
  }

  if (!isValidCoordinate(value.lat, -90, 90)) {
    return {
      ok: false,
      error: "Place enrichment latitude is invalid.",
    }
  }

  if (!isValidCoordinate(value.lng, -180, 180)) {
    return {
      ok: false,
      error: "Place enrichment longitude is invalid.",
    }
  }

  return {
    ok: true,
    data: {
      lat: value.lat,
      lng: value.lng,
    },
  }
}

function parseAttribution(
  value: unknown
):
  | {
      ok: true
      data: PlaceEnrichmentAttribution
    }
  | {
      ok: false
      error: string
    } {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: "Place enrichment attribution is invalid.",
    }
  }

  if (
    value.provider !== "Geoapify" ||
    value.providerLabel !== "Powered by Geoapify" ||
    value.providerUrl !== "https://www.geoapify.com/" ||
    value.osmLabel !== "OpenStreetMap contributors" ||
    value.osmUrl !== "https://www.openstreetmap.org/copyright"
  ) {
    return {
      ok: false,
      error: "Place enrichment attribution values are invalid.",
    }
  }

  return {
    ok: true,
    data: getGeoapifyAttribution(),
  }
}

function parseOptionalImage(
  value: unknown
):
  | {
      ok: true
      data?: PlaceEnrichmentImage
    }
  | {
      ok: false
      error: string
    } {
  if (value === undefined) {
    return {
      ok: true,
    }
  }

  if (!isRecord(value)) {
    return {
      ok: false,
      error: "Place enrichment image is invalid.",
    }
  }

  const image = normalizeExternalImage({
    url: value.url,
    source: value.source,
    kind: value.kind,
    alt: value.alt,
    attribution: value.attribution,
  })

  if (image === null) {
    return {
      ok: false,
      error: "Place enrichment image values are invalid.",
    }
  }

  return {
    ok: true,
    data: image,
  }
}

function readResponseString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isValidCoordinate(
  value: unknown,
  min: number,
  max: number
): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
