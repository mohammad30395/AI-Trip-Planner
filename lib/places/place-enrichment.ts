export type PlaceEnrichmentRequest = {
  query: string
  destination?: string
  city?: string
  address?: string
}

export type PlaceEnrichmentImage = {
  url: string
  source: "geoapify"
}

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
  const city = readTrimmedString(
    record.city,
    "city",
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
  if (!city.ok) {
    return city
  }
  if (!address.ok) {
    return address
  }

  const data: PlaceEnrichmentRequest = {
    query: query.data,
    ...(destination.data !== undefined ? { destination: destination.data } : {}),
    ...(city.data !== undefined ? { city: city.data } : {}),
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
    request.city,
    request.destination,
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
