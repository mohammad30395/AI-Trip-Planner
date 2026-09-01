export type ExternalImageKind = "exact_place" | "representative"

export type ExternalImageSource = "geoapify" | "wikimedia"

export type ExternalImage = {
  url: string
  source: ExternalImageSource
  kind: ExternalImageKind
  alt: string
  attribution?: string
  sourcePageUrl?: string
  license?: string
  licenseUrl?: string
}

export const SUPPORTED_EXTERNAL_IMAGE_HOSTS = [
  "thumb.wikimedia.org",
  "upload.wikimedia.org",
] as const
const SUPPORTED_SOURCE_PAGE_HOSTS = ["commons.wikimedia.org"] as const

export type ExternalImageRenderMode = "loading" | "image" | "fallback"

type ExternalImageInput = {
  url: unknown
  source: unknown
  kind: unknown
  alt: unknown
  attribution?: unknown
  sourcePageUrl?: unknown
  license?: unknown
  licenseUrl?: unknown
}

export function normalizeExternalImage(
  value: ExternalImageInput
): ExternalImage | null {
  const url = normalizeExternalImageUrl(value.url)

  if (
    url === null ||
    (value.source !== "geoapify" && value.source !== "wikimedia")
  ) {
    return null
  }

  if (value.kind !== "exact_place" && value.kind !== "representative") {
    return null
  }

  if (typeof value.alt !== "string" || value.alt.trim().length === 0) {
    return null
  }

  const attribution =
    typeof value.attribution === "string" && value.attribution.trim().length > 0
      ? value.attribution.trim()
      : undefined
  const sourcePageUrl = normalizeExternalMetadataUrl(
    value.sourcePageUrl,
    SUPPORTED_SOURCE_PAGE_HOSTS
  )
  const license =
    typeof value.license === "string" && value.license.trim().length > 0
      ? value.license.trim()
      : undefined
  const licenseUrl = normalizeExternalMetadataUrl(value.licenseUrl)

  return {
    url,
    source: value.source,
    kind: value.kind,
    alt: value.alt.trim(),
    ...(attribution !== undefined ? { attribution } : {}),
    ...(sourcePageUrl !== null ? { sourcePageUrl } : {}),
    ...(license !== undefined ? { license } : {}),
    ...(licenseUrl !== null ? { licenseUrl } : {}),
  }
}

export function normalizeGeoapifyExternalImage({
  alt,
  kind,
  url,
}: {
  alt: string
  kind: ExternalImageKind
  url: unknown
}) {
  return normalizeExternalImage({
    url,
    source: "geoapify",
    kind,
    alt,
    attribution: "Geoapify / Wikimedia",
  })
}

export function normalizeWikimediaExternalImage({
  alt,
  attribution,
  license,
  licenseUrl,
  kind,
  sourcePageUrl,
  url,
}: {
  alt: string
  attribution?: string
  license?: string
  licenseUrl?: string
  kind: ExternalImageKind
  sourcePageUrl?: string
  url: unknown
}) {
  return normalizeExternalImage({
    url,
    source: "wikimedia",
    kind,
    alt,
    attribution,
    sourcePageUrl,
    license,
    licenseUrl,
  })
}

export function normalizeExternalImageUrl(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return null
  }

  try {
    const url = new URL(trimmed)

    if (
      url.protocol !== "https:" ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      !isSupportedExternalImageHostname(url.hostname)
    ) {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

export function isSupportedExternalImageHostname(hostname: string) {
  const normalizedHostname = hostname.toLocaleLowerCase()

  return SUPPORTED_EXTERNAL_IMAGE_HOSTS.some(
    (supportedHost) => normalizedHostname === supportedHost
  )
}

export function getExternalImageRenderMode({
  image,
  isLoading,
  loadFailed,
}: {
  image: ExternalImage | null
  isLoading: boolean
  loadFailed: boolean
}): ExternalImageRenderMode {
  if (isLoading) {
    return "loading"
  }

  if (image !== null && !loadFailed) {
    return "image"
  }

  return "fallback"
}

function normalizeExternalMetadataUrl(
  value: unknown,
  allowedHosts?: readonly string[]
) {
  if (typeof value !== "string") {
    return null
  }

  try {
    const url = new URL(value.trim())

    if (
      url.protocol !== "https:" ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      return null
    }

    if (
      allowedHosts !== undefined &&
      !allowedHosts.includes(url.hostname.toLocaleLowerCase())
    ) {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}
