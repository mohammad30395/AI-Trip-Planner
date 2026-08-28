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
  title,
}: {
  address: string | null
  approximateArea: string | null
  destination: string
  placeName: string | null
  title?: string
}): PlaceEnrichmentRequest | null {
  const titlePlaceName =
    placeName === null && address === null && title !== undefined
      ? getSpecificPlaceNameFromActivityTitle(title)
      : null

  if (placeName === null && address === null && titlePlaceName === null) {
    return null
  }

  const query = placeName ?? address ?? titlePlaceName ?? ""

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

export function getSpecificPlaceNameFromActivityTitle(title: string) {
  if (isGenericActivityPlaceQuery(title)) {
    return null
  }

  const normalizedTitle = title.trim().replace(/\s+/g, " ")

  if (normalizedTitle.length === 0) {
    return null
  }

  if (hasNonPlaceActivityIntent(normalizedTitle)) {
    return null
  }

  const withoutPrefix = normalizedTitle
    .replace(/^visit\s+/i, "")
    .replace(/^explore\s+/i, "")
    .replace(/^(?:morning|afternoon|evening|night)\s+walk\s+at\s+/i, "")
    .replace(/^walk\s+at\s+/i, "")

  if (
    withoutPrefix.length === 0 ||
    /\b(?:and|or)\b/i.test(withoutPrefix) ||
    /\([^)]*\)/.test(withoutPrefix) ||
    !hasSpecificPlaceCue(withoutPrefix)
  ) {
    return null
  }

  return withoutPrefix
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
  ].some((genericText) => hasNormalizedPhrase(normalized, genericText))
}

function hasNonPlaceActivityIntent(title: string) {
  const normalized = title
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")

  return [
    "departure",
    "return to",
    "pick up luggage",
    "shopping",
    "leisure",
    "rest",
    "optional",
  ].some((genericText) => hasNormalizedPhrase(normalized, genericText))
}

function hasSpecificPlaceCue(placeName: string) {
  return /\b(?:bridge|eidgah|forest|fort|garden|gardens|lake|mazar|monument|mosque|museum|palace|park|river|shrine|temple|waterfall|falls)\b/i.test(
    placeName
  )
}

function hasNormalizedPhrase(normalizedText: string, normalizedPhrase: string) {
  return new RegExp(
    `(?:^| )${normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: |$)`
  ).test(normalizedText)
}
