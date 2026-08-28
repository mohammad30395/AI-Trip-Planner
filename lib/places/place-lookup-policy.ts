import type { PlaceEnrichmentRequest } from "@/lib/places/place-enrichment"

export function buildDestinationCoverEnrichmentRequest(
  destination: string
): PlaceEnrichmentRequest {
  return {
    query: destination,
    lookupKind: "city",
  }
}

export function buildHotelPlaceEnrichmentRequest({
  address,
  area,
  destination,
  name,
}: {
  address: string | null
  area: string | null
  destination: string
  name: string
}): PlaceEnrichmentRequest {
  return {
    query: name,
    lookupKind: "hotel",
    destination,
    ...(area !== null ? { area } : {}),
    ...(address !== null ? { address } : {}),
  }
}

export function buildActivityPlaceEnrichmentRequest({
  address,
  approximateArea,
  destination,
  placeName,
}: {
  address: string | null
  approximateArea: string | null
  destination: string
  placeName: string | null
}): PlaceEnrichmentRequest | null {
  if (placeName === null && address === null) {
    return null
  }

  const query = placeName ?? address ?? ""

  if (isGenericActivityPlaceQuery(query)) {
    return null
  }

  return {
    query,
    lookupKind: "specific_place",
    destination,
    ...(address !== null ? { address } : {}),
    ...(approximateArea !== null ? { area: approximateArea } : {}),
  }
}

export function isGenericActivityPlaceQuery(query: string) {
  const normalized = query
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")

  return [
    "check in",
    "checkin",
    "freshen up",
    "free time",
    "local eatery",
    "local restaurant",
    "lunch",
    "dinner",
    "breakfast",
    "travel from",
    "transfer",
  ].some((genericText) => normalized.includes(genericText))
}
