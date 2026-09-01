import {
  normalizeWikimediaExternalImage,
  type ExternalImage,
  type ExternalImageKind,
} from "@/lib/images/external-image"

const WIKIMEDIA_COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php"
const WIKIMEDIA_SEARCH_LIMIT = "8"
const WIKIMEDIA_THUMB_WIDTH = "1200"
const WIKIMEDIA_USER_AGENT = "AI-Trip-Planner/0.1 image-resolver"

export type WikimediaImageResolutionStatus =
  | "found"
  | "no_result"
  | "provider_failure"
  | "rejected_unsafe_url"
  | "rejected_ambiguous_match"

export type WikimediaImageResolutionResult =
  | {
      status: "found"
      image: ExternalImage
      matchedTitle: string
    }
  | {
      status: Exclude<WikimediaImageResolutionStatus, "found">
    }

type WikimediaImageSearchInput = {
  query: string
  context?: string
  kind: ExternalImageKind
  alt: string
  strictTitleMatch: boolean
  signal: AbortSignal
}

type WikimediaQueryResponse = {
  query?: {
    pages?: unknown[]
  }
}

type WikimediaImageCandidate = {
  title: string
  canonicalTitle?: string
  objectName?: string
  description?: string
  categories?: string
  thumbUrl?: string
  imageUrl?: string
  sourcePageUrl?: string
  license?: string
  licenseUrl?: string
  attribution?: string
  mime?: string
}

export async function resolveWikimediaImage({
  alt,
  context,
  kind,
  query,
  signal,
  strictTitleMatch,
}: WikimediaImageSearchInput): Promise<WikimediaImageResolutionResult> {
  let response: WikimediaQueryResponse

  try {
    const fetchResponse = await fetch(
      buildWikimediaSearchUrl(buildWikimediaSearchText(query, context)),
      {
        headers: {
          Accept: "application/json",
          "User-Agent": WIKIMEDIA_USER_AGENT,
        },
        signal,
      }
    )

    if (!fetchResponse.ok) {
      return { status: "provider_failure" }
    }

    response = (await fetchResponse.json()) as WikimediaQueryResponse
  } catch {
    return { status: "provider_failure" }
  }

  const candidates = normalizeWikimediaCandidates(response)

  if (candidates.length === 0) {
    return { status: "no_result" }
  }

  const acceptedCandidate = candidates.find((candidate) =>
    isAcceptableWikimediaCandidate(candidate, query, strictTitleMatch)
  )

  if (acceptedCandidate === undefined) {
    return { status: "rejected_ambiguous_match" }
  }

  const image = normalizeWikimediaExternalImage({
    url: acceptedCandidate.thumbUrl ?? acceptedCandidate.imageUrl,
    kind,
    alt,
    attribution: acceptedCandidate.attribution,
    sourcePageUrl: acceptedCandidate.sourcePageUrl,
    license: acceptedCandidate.license,
    licenseUrl: acceptedCandidate.licenseUrl,
  })

  if (image === null) {
    return { status: "rejected_unsafe_url" }
  }

  return {
    status: "found",
    image,
    matchedTitle: acceptedCandidate.title,
  }
}

function buildWikimediaSearchUrl(searchText: string) {
  const url = new URL(WIKIMEDIA_COMMONS_API_URL)
  url.searchParams.set("action", "query")
  url.searchParams.set("format", "json")
  url.searchParams.set("formatversion", "2")
  url.searchParams.set("generator", "search")
  url.searchParams.set("gsrnamespace", "6")
  url.searchParams.set("gsrlimit", WIKIMEDIA_SEARCH_LIMIT)
  url.searchParams.set("gsrsearch", searchText)
  url.searchParams.set("prop", "imageinfo")
  url.searchParams.set("iiprop", "url|extmetadata|mime|canonicaltitle")
  url.searchParams.set("iiurlwidth", WIKIMEDIA_THUMB_WIDTH)
  url.searchParams.set("iiextmetadatalanguage", "en")
  return url
}

function buildWikimediaSearchText(query: string, context: string | undefined) {
  return [query, context]
    .filter((part): part is string => part !== undefined && part.trim().length > 0)
    .join(" ")
    .trim()
}

function normalizeWikimediaCandidates(
  response: WikimediaQueryResponse
): WikimediaImageCandidate[] {
  if (!Array.isArray(response.query?.pages)) {
    return []
  }

  return response.query.pages.flatMap((page) => {
    const candidate = normalizeWikimediaCandidate(page)
    return candidate === null ? [] : [candidate]
  })
}

function normalizeWikimediaCandidate(
  value: unknown
): WikimediaImageCandidate | null {
  if (!isRecord(value)) {
    return null
  }

  const title = readString(value.title)
  const imageInfo = Array.isArray(value.imageinfo) ? value.imageinfo[0] : undefined

  if (title === null || !isRecord(imageInfo)) {
    return null
  }

  const extmetadata = isRecord(imageInfo.extmetadata)
    ? imageInfo.extmetadata
    : undefined

  return {
    title,
    ...readOptionalString(imageInfo.canonicaltitle, "canonicalTitle"),
    ...readOptionalString(readMetadataValue(extmetadata, "ObjectName"), "objectName"),
    ...readOptionalString(
      stripHtml(readMetadataValue(extmetadata, "ImageDescription")),
      "description"
    ),
    ...readOptionalString(readMetadataValue(extmetadata, "Categories"), "categories"),
    ...readOptionalString(imageInfo.thumburl, "thumbUrl"),
    ...readOptionalString(imageInfo.url, "imageUrl"),
    ...readOptionalString(imageInfo.descriptionurl, "sourcePageUrl"),
    ...readOptionalString(readMetadataValue(extmetadata, "LicenseShortName"), "license"),
    ...readOptionalString(readMetadataValue(extmetadata, "LicenseUrl"), "licenseUrl"),
    ...readOptionalString(buildAttribution(extmetadata), "attribution"),
    ...readOptionalString(imageInfo.mime, "mime"),
  }
}

function isAcceptableWikimediaCandidate(
  candidate: WikimediaImageCandidate,
  query: string,
  strictTitleMatch: boolean
) {
  if (!isSupportedImageMime(candidate.mime)) {
    return false
  }

  const requestedTokens = getDistinctiveTokens(query)

  if (requestedTokens.length === 0) {
    return false
  }

  const titleText = [
    candidate.title,
    candidate.canonicalTitle,
    candidate.objectName,
  ].join(" ")
  const titleCoverage = getTokenCoverage(requestedTokens, getTokens(titleText))

  if (strictTitleMatch) {
    return titleCoverage >= getExactTitleCoverageThreshold(requestedTokens.length)
  }

  const allTextCoverage = getTokenCoverage(
    requestedTokens,
    getTokens(
      [
        candidate.title,
        candidate.canonicalTitle,
        candidate.objectName,
        candidate.description,
        candidate.categories,
      ].join(" ")
    )
  )

  return titleCoverage >= 0.5 || allTextCoverage >= 0.75
}

function getExactTitleCoverageThreshold(tokenCount: number) {
  return tokenCount <= 2 ? 1 : 0.75
}

function isSupportedImageMime(mime: string | undefined) {
  return (
    mime === "image/jpeg" ||
    mime === "image/png" ||
    mime === "image/webp"
  )
}

function getTokenCoverage(requestedTokens: string[], candidateTokens: string[]) {
  if (requestedTokens.length === 0 || candidateTokens.length === 0) {
    return 0
  }

  const candidateSet = new Set(candidateTokens)
  const matched = requestedTokens.filter((token) => candidateSet.has(token)).length
  return matched / requestedTokens.length
}

function getDistinctiveTokens(value: string) {
  return getTokens(value).filter((token) => !GENERIC_IMAGE_TOKENS.has(token))
}

function getTokens(value: string | undefined) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1)
}

const GENERIC_IMAGE_TOKENS = new Set([
  "a",
  "an",
  "and",
  "at",
  "bd",
  "bangladesh",
  "city",
  "country",
  "destination",
  "hotel",
  "in",
  "local",
  "near",
  "of",
  "photo",
  "picture",
  "the",
  "to",
])

function buildAttribution(
  extmetadata: Record<string, unknown> | undefined
) {
  const attribution = stripHtml(readMetadataValue(extmetadata, "Attribution"))
  const artist = stripHtml(readMetadataValue(extmetadata, "Artist"))
  const credit = stripHtml(readMetadataValue(extmetadata, "Credit"))

  return attribution ?? artist ?? credit ?? undefined
}

function readMetadataValue(
  extmetadata: Record<string, unknown> | undefined,
  key: string
) {
  const value = extmetadata?.[key]

  if (!isRecord(value) || typeof value.value !== "string") {
    return undefined
  }

  return value.value
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function readOptionalString<TKey extends string>(
  value: unknown,
  key: TKey
): { [K in TKey]: string } | Record<string, never> {
  const stringValue = readString(value)

  return stringValue === null ? {} : { [key]: stringValue } as { [K in TKey]: string }
}

function stripHtml(value: string | undefined) {
  if (value === undefined) {
    return undefined
  }

  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function normalizeText(value: string | undefined) {
  return (
    value
      ?.toLocaleLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/['’`]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ") ?? ""
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
