import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import {
  GEOAPIFY_TIMEOUT_MS,
  GeoapifyConfigurationError,
  GeoapifyProviderError,
  enrichPlaceWithGeoapify,
} from "@/lib/places/geoapify"
import {
  parsePlaceEnrichmentRequest,
  type PlaceEnrichmentResponseEnvelope,
} from "@/lib/places/place-enrichment"

export const runtime = "nodejs"

export async function POST(request: Request) {
  await auth.protect()

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return placeEnrichmentError("Request body must be valid JSON.", 400)
  }

  const parsedRequest = parsePlaceEnrichmentRequest(body)

  if (!parsedRequest.ok) {
    return placeEnrichmentError(parsedRequest.error, 400)
  }

  return runPlaceEnrichment(parsedRequest.data)
}

export async function GET(request: Request) {
  await auth.protect()

  if (process.env.NODE_ENV !== "development") {
    return placeEnrichmentError("Not found.", 404)
  }

  const url = new URL(request.url)
  const parsedRequest = parsePlaceEnrichmentRequest({
    query: url.searchParams.get("query") ?? undefined,
    lookupKind: url.searchParams.get("lookupKind") ?? undefined,
    destination: url.searchParams.get("destination") ?? undefined,
    city: url.searchParams.get("city") ?? undefined,
    area: url.searchParams.get("area") ?? undefined,
    country: url.searchParams.get("country") ?? undefined,
    address: url.searchParams.get("address") ?? undefined,
  })

  if (!parsedRequest.ok) {
    return placeEnrichmentError(parsedRequest.error, 400)
  }

  return runPlaceEnrichment(parsedRequest.data)
}

async function runPlaceEnrichment(
  request: Parameters<typeof enrichPlaceWithGeoapify>[0]
) {
  try {
    const place = await enrichPlaceWithGeoapify(
      request,
      AbortSignal.timeout(GEOAPIFY_TIMEOUT_MS)
    )

    return NextResponse.json({
      ok: true,
      place,
    } satisfies PlaceEnrichmentResponseEnvelope)
  } catch (error) {
    if (error instanceof GeoapifyConfigurationError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Server Geoapify configuration is incomplete.",
          missingVariables: error.missingVariables,
        } satisfies PlaceEnrichmentResponseEnvelope,
        { status: 500 }
      )
    }

    if (error instanceof GeoapifyProviderError) {
      return placeEnrichmentError(getProviderMessage(error), error.status)
    }

    if (process.env.NODE_ENV === "development") {
      console.warn("Place enrichment route diagnostic", {
        name: error instanceof Error ? error.name : "UnknownError",
      })
    }

    return placeEnrichmentError("Place enrichment route failed.", 500)
  }
}

function getProviderMessage(error: GeoapifyProviderError) {
  if (error.code === "provider_no_results") {
    return "No matching place was found."
  }

  if (error.code === "provider_no_confident_match") {
    return "No confident canonical place match was found."
  }

  if (error.code === "provider_auth_failed") {
    return "Place provider authentication failed."
  }

  if (error.code === "provider_rate_limited") {
    return "Place provider rate or quota limit was reached."
  }

  if (error.code === "provider_timeout") {
    return "Place provider request timed out."
  }

  return "Place provider lookup failed."
}

function placeEnrichmentError(error: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error,
    } satisfies PlaceEnrichmentResponseEnvelope,
    { status }
  )
}
