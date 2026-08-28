import "server-only"

import {
  buildGeoapifySearchText,
  getGeoapifyAttribution,
  type PlaceEnrichment,
  type PlaceEnrichmentImage,
  type PlaceLookupKind,
  type PlaceMatchStatus,
  type PlaceEnrichmentRequest,
} from "@/lib/places/place-enrichment"

const GEOAPIFY_GEOCODING_URL = "https://api.geoapify.com/v1/geocode/search"
const GEOAPIFY_PLACE_DETAILS_URL = "https://api.geoapify.com/v2/place-details"
const GEOAPIFY_RESULT_LIMIT = "8"
export const GEOAPIFY_TIMEOUT_MS = 8_000

const BANGLADESH_COUNTRY_CODE = "bd"
const LOCAL_POI_MAX_DISTANCE_METERS = 120_000
const SPECIFIC_PLACE_PROBABLE_SCORE = 72
const SPECIFIC_PLACE_VERIFIED_SCORE = 90
const CITY_PROBABLE_SCORE = 65
const CITY_VERIFIED_SCORE = 85

type GeoapifyGeocodingResponse = {
  results?: unknown[]
}

type GeoapifyPlaceDetailsResponse = {
  features?: unknown[]
}

export type DestinationContext = {
  query: string
  city?: string
  country?: string
  countryCode?: string
  location?: {
    lat: number
    lng: number
  }
  providerPlaceId?: string
}

export type GeoapifyCandidate = {
  providerPlaceId: string
  displayName: string
  formattedAddress: string
  location: {
    lat: number
    lng: number
  }
  resultType?: string
  category?: string
  country?: string
  countryCode?: string
  city?: string
  district?: string
  state?: string
  county?: string
  distance?: number
  rankConfidence?: number
  rankMatchType?: string
}

export type PlaceCandidateRankingInput = {
  request: PlaceEnrichmentRequest
  destinationContext?: DestinationContext
  candidates: GeoapifyCandidate[]
}

export type PlaceCandidateRankingResult =
  | {
      status: Exclude<PlaceMatchStatus, "no_confident_match">
      score: number
      matchedQuery: string
      candidate: GeoapifyCandidate
    }
  | {
      status: "no_confident_match"
      score: number
      matchedQuery: string
    }

type GeoapifyStatus =
  | "provider_auth_failed"
  | "provider_rate_limited"
  | "provider_unavailable"
  | "provider_malformed"
  | "provider_no_results"
  | "provider_no_confident_match"
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
  const destinationContext = await getDestinationContext(request, apiKey, signal)
  const geocodingResponse = await fetchGeoapifyJson<GeoapifyGeocodingResponse>(
    buildGeocodingUrl(request, apiKey, destinationContext),
    "geocoding",
    signal
  )

  const basePlace = normalizeBestGeocodingResult(
    request,
    geocodingResponse,
    destinationContext
  )
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

function buildGeocodingUrl(
  request: PlaceEnrichmentRequest,
  apiKey: string,
  destinationContext: DestinationContext | undefined
) {
  const url = new URL(GEOAPIFY_GEOCODING_URL)
  url.searchParams.set("text", buildGeoapifySearchText(request))
  url.searchParams.set("format", "json")
  url.searchParams.set("lang", "en")
  url.searchParams.set("limit", GEOAPIFY_RESULT_LIMIT)
  const lookupKind = getLookupKind(request)

  if (lookupKind === "city") {
    url.searchParams.set("type", "city")
  } else if (lookupKind === "hotel") {
    url.searchParams.set("type", "amenity")
  }

  if (destinationContext?.countryCode !== undefined) {
    url.searchParams.set("filter", `countrycode:${destinationContext.countryCode}`)
  }

  if (destinationContext?.location !== undefined) {
    url.searchParams.set(
      "bias",
      `proximity:${destinationContext.location.lng},${destinationContext.location.lat}`
    )
  } else if (destinationContext?.countryCode !== undefined) {
    url.searchParams.set("bias", `countrycode:${destinationContext.countryCode}`)
  }

  url.searchParams.set("apiKey", apiKey)
  return url
}

function buildDestinationGeocodingUrl(
  destination: string,
  country: string | undefined,
  apiKey: string
) {
  const url = new URL(GEOAPIFY_GEOCODING_URL)
  url.searchParams.set("text", [destination, country].filter(Boolean).join(", "))
  url.searchParams.set("format", "json")
  url.searchParams.set("lang", "en")
  url.searchParams.set("limit", "5")
  url.searchParams.set("type", "city")
  const countryCode = getKnownCountryCode(country ?? destination)

  if (countryCode !== undefined) {
    url.searchParams.set("filter", `countrycode:${countryCode}`)
  }

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

async function getDestinationContext(
  request: PlaceEnrichmentRequest,
  apiKey: string,
  signal: AbortSignal
): Promise<DestinationContext | undefined> {
  const destination = request.destination ?? request.city

  if (destination === undefined || getLookupKind(request) === "city") {
    return undefined
  }

  try {
    const response = await fetchGeoapifyJson<GeoapifyGeocodingResponse>(
      buildDestinationGeocodingUrl(destination, request.country, apiKey),
      "geocoding",
      signal
    )
    const candidates = normalizeGeocodingCandidates(response.results)
    const ranking = rankGeoapifyCandidates({
      request: {
        query: destination,
        lookupKind: "city",
        ...(request.country !== undefined ? { country: request.country } : {}),
      },
      candidates,
    })

    if (ranking.status === "no_confident_match") {
      return {
        query: destination,
        ...(request.country !== undefined ? { country: request.country } : {}),
        ...(getKnownCountryCode(request.country ?? destination) !== undefined
          ? { countryCode: getKnownCountryCode(request.country ?? destination) }
          : {}),
      }
    }

    return {
      query: destination,
      city: ranking.candidate.city ?? ranking.candidate.displayName,
      country: ranking.candidate.country ?? request.country,
      countryCode:
        ranking.candidate.countryCode ??
        getKnownCountryCode(request.country ?? destination),
      location: ranking.candidate.location,
      providerPlaceId: ranking.candidate.providerPlaceId,
    }
  } catch {
    const countryCode = getKnownCountryCode(request.country ?? destination)

    return {
      query: destination,
      ...(request.country !== undefined ? { country: request.country } : {}),
      ...(countryCode !== undefined ? { countryCode } : {}),
    }
  }
}

function normalizeBestGeocodingResult(
  request: PlaceEnrichmentRequest,
  response: GeoapifyGeocodingResponse,
  destinationContext: DestinationContext | undefined
): PlaceEnrichment {
  if (!Array.isArray(response.results) || response.results.length === 0) {
    throw new GeoapifyProviderError(
      "provider_no_results",
      404,
      "Geoapify returned no matching places."
    )
  }

  const candidates = normalizeGeocodingCandidates(response.results)

  if (candidates.length === 0) {
    throw new GeoapifyProviderError(
      "provider_malformed",
      502,
      "Geoapify returned no valid place records."
    )
  }

  const ranking = rankGeoapifyCandidates({
    request,
    destinationContext,
    candidates,
  })

  if (ranking.status === "no_confident_match") {
    throw new GeoapifyProviderError(
      "provider_no_confident_match",
      404,
      "Geoapify returned no confident place match."
    )
  }

  return toPlaceEnrichment(ranking)
}

function normalizeGeocodingCandidates(results: unknown[] | undefined) {
  if (!Array.isArray(results)) {
    return []
  }

  return results.flatMap((result) => {
    const candidate = normalizeGeocodingCandidate(result)
    return candidate === null ? [] : [candidate]
  })
}

function normalizeGeocodingCandidate(value: unknown): GeoapifyCandidate | null {
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
    providerPlaceId,
    displayName: getDisplayName(value, formattedAddress),
    formattedAddress,
    location: {
      lat,
      lng,
    },
    ...readOptionalStringProperty(value, "result_type", "resultType"),
    ...readOptionalStringProperty(value, "category", "category"),
    ...readOptionalStringProperty(value, "country", "country"),
    ...readOptionalStringProperty(value, "country_code", "countryCode"),
    ...readFirstOptionalStringProperty(value, ["city", "town", "village"], "city"),
    ...readOptionalStringProperty(value, "district", "district"),
    ...readOptionalStringProperty(value, "state", "state"),
    ...readOptionalStringProperty(value, "county", "county"),
    ...readOptionalNumberProperty(value, "distance", "distance"),
    ...readRank(value),
  }
}

function toPlaceEnrichment(
  ranking: Exclude<PlaceCandidateRankingResult, { status: "no_confident_match" }>
): PlaceEnrichment {
  return {
    provider: "geoapify",
    providerPlaceId: ranking.candidate.providerPlaceId,
    displayName: ranking.candidate.displayName,
    formattedAddress: ranking.candidate.formattedAddress,
    location: ranking.candidate.location,
    attribution: getGeoapifyAttribution(),
    matchStatus: ranking.status,
    matchScore: ranking.score,
    matchedQuery: ranking.matchedQuery,
  }
}

export function rankGeoapifyCandidates({
  candidates,
  destinationContext,
  request,
}: PlaceCandidateRankingInput): PlaceCandidateRankingResult {
  const matchedQuery = buildGeoapifySearchText(request)
  const lookupKind = getLookupKind(request)

  if (lookupKind !== "city" && isGenericPlaceQuery(request.query)) {
    return {
      status: "no_confident_match",
      score: 0,
      matchedQuery,
    }
  }

  const scoredCandidates = candidates
    .map((candidate) =>
      scoreGeoapifyCandidate(candidate, request, destinationContext, lookupKind)
    )
    .filter((score): score is CandidateScore => score !== null)
    .sort((left, right) => right.score - left.score)

  const best = scoredCandidates[0]

  if (best === undefined) {
    return {
      status: "no_confident_match",
      score: 0,
      matchedQuery,
    }
  }

  const probableThreshold =
    lookupKind === "city" ? CITY_PROBABLE_SCORE : SPECIFIC_PLACE_PROBABLE_SCORE
  const verifiedThreshold =
    lookupKind === "city" ? CITY_VERIFIED_SCORE : SPECIFIC_PLACE_VERIFIED_SCORE

  if (best.score < probableThreshold) {
    return {
      status: "no_confident_match",
      score: best.score,
      matchedQuery,
    }
  }

  return {
    status: best.score >= verifiedThreshold ? "verified" : "probable",
    score: best.score,
    matchedQuery,
    candidate: best.candidate,
  }
}

type CandidateScore = {
  candidate: GeoapifyCandidate
  score: number
}

function scoreGeoapifyCandidate(
  candidate: GeoapifyCandidate,
  request: PlaceEnrichmentRequest,
  destinationContext: DestinationContext | undefined,
  lookupKind: PlaceLookupKind
): CandidateScore | null {
  if (!hasExpectedCountry(candidate, request, destinationContext)) {
    return null
  }

  if (!hasExpectedLocalDistance(candidate, lookupKind)) {
    return null
  }

  if (lookupKind === "city") {
    return scoreCityCandidate(candidate, request)
  }

  if (!hasAcceptableResultType(candidate, lookupKind)) {
    return null
  }

  if (!hasAcceptableCategory(candidate, lookupKind)) {
    return null
  }

  const requestedNameTokens = getDistinctiveTokens(request.query)
  const candidateNameTokens = getNormalizedTokens(candidate.displayName)
  const candidateTextTokens = getNormalizedTokens(
    [
      candidate.displayName,
      candidate.formattedAddress,
      candidate.city,
      candidate.district,
      candidate.state,
      candidate.county,
      candidate.category,
    ]
      .filter((part): part is string => part !== undefined)
      .join(" ")
  )

  if (requestedNameTokens.length === 0) {
    return null
  }

  const nameCoverage = getTokenCoverage(requestedNameTokens, candidateNameTokens)
  const textCoverage = getTokenCoverage(requestedNameTokens, candidateTextTokens)

  if (lookupKind === "hotel" && nameCoverage < 0.5) {
    return null
  }

  if (lookupKind === "specific_place" && nameCoverage < 0.45 && textCoverage < 0.65) {
    return null
  }

  const areaScore = scoreContextText(
    request.area ?? request.city,
    candidate.formattedAddress,
    candidate.city,
    candidate.district,
    candidate.state,
    candidate.county
  )
  const destinationScore = scoreContextText(
    request.destination,
    candidate.formattedAddress,
    candidate.city,
    candidate.district,
    candidate.state,
    candidate.county
  )
  const addressScore = scoreContextText(
    request.address,
    candidate.formattedAddress,
    candidate.displayName
  )

  let score = Math.round(nameCoverage * 58 + textCoverage * 12)
  score += areaScore
  score += destinationScore
  score += addressScore
  score += scoreRank(candidate)

  if (lookupKind === "hotel" && isHotelCategory(candidate.category)) {
    score += 12
  }

  return {
    candidate,
    score: Math.min(score, 100),
  }
}

function scoreCityCandidate(
  candidate: GeoapifyCandidate,
  request: PlaceEnrichmentRequest
): CandidateScore | null {
  if (!isCityResultType(candidate.resultType)) {
    return null
  }

  const requestedTokens = getDistinctiveTokens(request.query)
  const candidateTokens = getNormalizedTokens(
    [candidate.displayName, candidate.city, candidate.formattedAddress]
      .filter((part): part is string => part !== undefined)
      .join(" ")
  )
  const nameCoverage = getTokenCoverage(requestedTokens, candidateTokens)

  if (requestedTokens.length === 0 || nameCoverage < 0.5) {
    return null
  }

  let score = Math.round(nameCoverage * 72) + scoreRank(candidate)
  score += scoreContextText(request.country, candidate.country, candidate.countryCode)

  return {
    candidate,
    score: Math.min(score, 100),
  }
}

function hasExpectedCountry(
  candidate: GeoapifyCandidate,
  request: PlaceEnrichmentRequest,
  destinationContext: DestinationContext | undefined
) {
  const expectedCountryCode =
    normalizeCountryCode(request.country) ??
    normalizeCountryCode(destinationContext?.countryCode) ??
    getKnownCountryCode(request.country ?? request.destination)

  if (expectedCountryCode === undefined) {
    return true
  }

  const candidateCountryCode =
    normalizeCountryCode(candidate.countryCode) ?? getKnownCountryCode(candidate.country)

  return candidateCountryCode === expectedCountryCode
}

function hasExpectedLocalDistance(
  candidate: GeoapifyCandidate,
  lookupKind: PlaceLookupKind
) {
  if (lookupKind === "city" || candidate.distance === undefined) {
    return true
  }

  return candidate.distance <= LOCAL_POI_MAX_DISTANCE_METERS
}

function hasAcceptableResultType(
  candidate: GeoapifyCandidate,
  lookupKind: PlaceLookupKind
) {
  const resultType = normalizeText(candidate.resultType)

  if (resultType === "") {
    return true
  }

  if (lookupKind === "hotel") {
    return resultType === "amenity" || resultType === "building"
  }

  return resultType === "amenity" || resultType === "building" || resultType === "locality"
}

function hasAcceptableCategory(
  candidate: GeoapifyCandidate,
  lookupKind: PlaceLookupKind
) {
  const category = normalizeText(candidate.category)
  const displayName = normalizeText(candidate.displayName)
  const combined = `${category} ${displayName}`

  if (lookupKind === "hotel") {
    if (containsAny(combined, ["bridge", "office", "engineer", "architect"])) {
      return false
    }

    return category === "" || isHotelCategory(category)
  }

  if (containsAny(combined, ["office.engineer", "office.architect"])) {
    return false
  }

  return true
}

function isHotelCategory(category: string | undefined) {
  const normalized = normalizeText(category)

  return containsAny(normalized, [
    "accommodation",
    "hotel",
    "hostel",
    "guest_house",
    "guest house",
    "motel",
    "resort",
  ])
}

function isCityResultType(resultType: string | undefined) {
  return containsAny(normalizeText(resultType), [
    "city",
    "county",
    "district",
    "state",
    "locality",
  ])
}

function scoreContextText(value: string | undefined, ...targets: (string | undefined)[]) {
  const tokens = getDistinctiveTokens(value)

  if (tokens.length === 0) {
    return 0
  }

  const targetTokens = getNormalizedTokens(
    targets.filter((target): target is string => target !== undefined).join(" ")
  )
  const coverage = getTokenCoverage(tokens, targetTokens)

  if (coverage >= 1) {
    return 10
  }

  if (coverage >= 0.5) {
    return 5
  }

  return 0
}

function scoreRank(candidate: GeoapifyCandidate) {
  let score = 0

  if (candidate.rankConfidence !== undefined) {
    score += Math.round(candidate.rankConfidence * 12)
  }

  if (candidate.rankMatchType === "full_match") {
    score += 8
  }

  return score
}

function getTokenCoverage(requestedTokens: string[], candidateTokens: string[]) {
  if (requestedTokens.length === 0 || candidateTokens.length === 0) {
    return 0
  }

  const candidateSet = new Set(candidateTokens)
  const matched = requestedTokens.filter((token) => candidateSet.has(token)).length

  return matched / requestedTokens.length
}

function getNormalizedTokens(value: string | undefined) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1)
}

function getDistinctiveTokens(value: string | undefined) {
  return getNormalizedTokens(value).filter(
    (token) => !GENERIC_CONTEXT_TOKENS.has(token)
  )
}

const GENERIC_CONTEXT_TOKENS = new Set([
  "a",
  "an",
  "and",
  "at",
  "bd",
  "bangladesh",
  "bazaar",
  "bazar",
  "city",
  "country",
  "in",
  "local",
  "near",
  "of",
  "restaurant",
  "road",
  "the",
  "to",
  "zindabazar",
])

function isGenericPlaceQuery(query: string) {
  const normalized = normalizeText(query)

  return (
    normalized.length === 0 ||
    containsAny(normalized, [
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
    ])
  )
}

function normalizeText(value: string | undefined) {
  return (
    value
      ?.toLocaleLowerCase()
      .replace(/&/g, " and ")
      .replace(/['’`]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ") ?? ""
  )
}

function containsAny(value: string, needles: readonly string[]) {
  return needles.some((needle) => value.includes(needle))
}

function getLookupKind(request: PlaceEnrichmentRequest): PlaceLookupKind {
  return request.lookupKind ?? "specific_place"
}

function getKnownCountryCode(value: string | undefined) {
  const normalized = normalizeText(value)

  if (normalized.includes("bangladesh")) {
    return BANGLADESH_COUNTRY_CODE
  }

  return undefined
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

function readOptionalStringProperty<
  TKey extends keyof GeoapifyCandidate,
>(
  value: Record<string, unknown>,
  sourceKey: string,
  targetKey: TKey
): Partial<Pick<GeoapifyCandidate, TKey>> {
  const text = readNonEmptyString(value[sourceKey])

  return text === null
    ? {}
    : ({
        [targetKey]: text,
      } as Partial<Pick<GeoapifyCandidate, TKey>>)
}

function readFirstOptionalStringProperty<
  TKey extends keyof GeoapifyCandidate,
>(
  value: Record<string, unknown>,
  sourceKeys: string[],
  targetKey: TKey
): Partial<Pick<GeoapifyCandidate, TKey>> {
  const text = sourceKeys
    .map((sourceKey) => readNonEmptyString(value[sourceKey]))
    .find((candidate): candidate is string => candidate !== null)

  return text === undefined
    ? {}
    : ({
        [targetKey]: text,
      } as Partial<Pick<GeoapifyCandidate, TKey>>)
}

function readOptionalNumberProperty<
  TKey extends keyof GeoapifyCandidate,
>(
  value: Record<string, unknown>,
  sourceKey: string,
  targetKey: TKey
): Partial<Pick<GeoapifyCandidate, TKey>> {
  const numberValue = value[sourceKey]

  return typeof numberValue === "number" && Number.isFinite(numberValue)
    ? ({
        [targetKey]: numberValue,
      } as Partial<Pick<GeoapifyCandidate, TKey>>)
    : {}
}

function readRank(
  value: Record<string, unknown>
): Pick<GeoapifyCandidate, "rankConfidence" | "rankMatchType"> | Record<string, never> {
  if (!isRecord(value.rank)) {
    return {}
  }

  const confidence = value.rank.confidence
  const matchType = readNonEmptyString(value.rank.match_type)

  return {
    ...(typeof confidence === "number" && Number.isFinite(confidence)
      ? { rankConfidence: confidence }
      : {}),
    ...(matchType !== null ? { rankMatchType: matchType } : {}),
  }
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

function normalizeCountryCode(value: string | undefined) {
  const normalized = value?.trim().toLocaleLowerCase()

  return normalized !== undefined && /^[a-z]{2}$/.test(normalized)
    ? normalized
    : undefined
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
