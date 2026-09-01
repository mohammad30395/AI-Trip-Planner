import type { ExternalImage } from "@/lib/images/external-image"
import {
  resolveWikimediaImage,
  type WikimediaImageResolutionResult,
} from "@/lib/images/wikimedia"
import type {
  PlaceEnrichment,
  PlaceEnrichmentRequest,
} from "@/lib/places/place-enrichment"

export type ImageResolutionStatus =
  | "found"
  | "no_suitable_image"
  | "provider_no_result"
  | "provider_failure"
  | "rejected_unsafe_url"
  | "rejected_ambiguous_match"
  | "unsupported_lookup"

export type ImageResolutionResult =
  | {
      status: "found"
      image: ExternalImage
      provider: "wikimedia"
    }
  | {
      status: Exclude<ImageResolutionStatus, "found">
      provider?: "wikimedia"
    }

export async function resolvePlaceImage({
  place,
  request,
  signal,
}: {
  place: PlaceEnrichment
  request: PlaceEnrichmentRequest
  signal: AbortSignal
}): Promise<ImageResolutionResult> {
  const lookupKind = request.lookupKind ?? "specific_place"

  if (lookupKind === "city") {
    return resolveDestinationImage({
      place,
      request,
      signal,
    })
  }

  return resolveExactPlaceImage({
    place,
    request,
    signal,
  })
}

export async function resolveExactPlaceImage({
  place,
  request,
  signal,
}: {
  place: PlaceEnrichment
  request: PlaceEnrichmentRequest
  signal: AbortSignal
}): Promise<ImageResolutionResult> {
  const lookupKind = request.lookupKind ?? "specific_place"
  const query = lookupKind === "hotel" ? request.query : place.displayName
  const context =
    lookupKind === "hotel" ? buildHotelImageContext(request, place) : buildContext(request, place)

  return mapWikimediaResult(
    await resolveWikimediaImage({
      query,
      context,
      kind: "exact_place",
      alt: lookupKind === "hotel" ? request.query : place.displayName,
      strictTitleMatch: true,
      signal,
    })
  )
}

export async function resolveDestinationImage({
  place,
  request,
  signal,
}: {
  place: PlaceEnrichment
  request: PlaceEnrichmentRequest
  signal: AbortSignal
}): Promise<ImageResolutionResult> {
  return mapWikimediaResult(
    await resolveWikimediaImage({
      query: place.displayName,
      context: buildDestinationImageContext(request, place),
      kind: "representative",
      alt: `${place.displayName} destination`,
      strictTitleMatch: false,
      signal,
    })
  )
}

export async function resolveRepresentativeImage({
  alt,
  context,
  query,
  signal,
}: {
  alt: string
  context?: string
  query: string
  signal: AbortSignal
}): Promise<ImageResolutionResult> {
  return mapWikimediaResult(
    await resolveWikimediaImage({
      query,
      context,
      kind: "representative",
      alt,
      strictTitleMatch: false,
      signal,
    })
  )
}

function buildContext(
  request: PlaceEnrichmentRequest,
  place: PlaceEnrichment
) {
  return [
    request.address,
    request.area,
    request.city,
    request.destination,
    request.country,
    place.formattedAddress,
  ]
    .filter((part): part is string => part !== undefined && part.trim().length > 0)
    .join(" ")
}

function buildHotelImageContext(
  request: PlaceEnrichmentRequest,
  place: PlaceEnrichment
) {
  return [
    request.destination ?? request.city,
    request.country ?? getLastAddressPart(place.formattedAddress),
  ]
    .filter((part): part is string => part !== undefined && part.trim().length > 0)
    .join(" ")
}

function buildDestinationImageContext(
  request: PlaceEnrichmentRequest,
  place: PlaceEnrichment
) {
  return request.country ?? getLastAddressPart(place.formattedAddress)
}

function getLastAddressPart(formattedAddress: string) {
  return formattedAddress
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .at(-1)
}

function mapWikimediaResult(
  result: WikimediaImageResolutionResult
): ImageResolutionResult {
  if (result.status === "found") {
    return {
      status: "found",
      image: result.image,
      provider: "wikimedia",
    }
  }

  if (result.status === "no_result") {
    return {
      status: "provider_no_result",
      provider: "wikimedia",
    }
  }

  return {
    status: result.status,
    provider: "wikimedia",
  }
}
