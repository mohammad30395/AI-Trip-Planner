export type ExternalImageKind = "exact_place" | "representative"

export type ExternalImageSource = "geoapify"

export type ExternalImage = {
  url: string
  source: ExternalImageSource
  kind: ExternalImageKind
  alt: string
  attribution?: string
}

export const SUPPORTED_EXTERNAL_IMAGE_HOSTS = [
  "upload.wikimedia.org",
  "commons.wikimedia.org",
] as const
const SUPPORTED_WIKIPEDIA_HOST_PATTERN = /^[a-z0-9-]+\.wikipedia\.org$/

export type ExternalImageRenderMode = "loading" | "image" | "fallback"

type ExternalImageInput = {
  url: unknown
  source: unknown
  kind: unknown
  alt: unknown
  attribution?: unknown
}

export function normalizeExternalImage(
  value: ExternalImageInput
): ExternalImage | null {
  const url = normalizeExternalImageUrl(value.url)

  if (url === null || value.source !== "geoapify") {
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

  return {
    url,
    source: "geoapify",
    kind: value.kind,
    alt: value.alt.trim(),
    ...(attribution !== undefined ? { attribution } : {}),
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
    (supportedHost) => hostname.toLocaleLowerCase() === supportedHost
  ) || SUPPORTED_WIKIPEDIA_HOST_PATTERN.test(normalizedHostname)
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
