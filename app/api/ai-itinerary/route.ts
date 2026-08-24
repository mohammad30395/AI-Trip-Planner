import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import {
  parseFinalItineraryRequest,
  type TripGenerationAccessStatus,
  validateItineraryDuration,
  type FinalItineraryRequirements,
  type FinalItineraryResponseEnvelope,
} from "@/lib/ai/itinerary"
import {
  PREMIUM_TRIP_GENERATION_FEATURE,
  getTripGenerationAccessStatus,
} from "@/lib/billing/trip-generation-access"
import {
  OpenRouterConfigurationError,
  OPENROUTER_TIMEOUT_MS,
  runOpenRouterFinalItinerary,
  type OpenRouterConversationMessage,
} from "@/lib/ai/openrouter"
import {
  ArcjetConfigurationError,
  enforceTripGenerationQuota,
} from "@/lib/quota/trip-generation"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const authObject = await auth.protect()
  const access = getTripGenerationAccessStatus(
    authObject.has({ feature: PREMIUM_TRIP_GENERATION_FEATURE })
  )

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return itineraryError("Request body must be valid JSON.", 400, access)
  }

  const parsedRequest = parseFinalItineraryRequest(body)

  if (!parsedRequest.ok) {
    return itineraryError("Final itinerary request is invalid.", 400, access)
  }

  try {
    if (access.quotaEnforced) {
      const quotaResult = await enforceTripGenerationQuota(
        request,
        authObject.userId
      )

      if (!quotaResult.ok) {
        return NextResponse.json(
          {
            ok: false,
            code: "quota_exceeded",
            error:
              "Free trip generation quota has been reached for this account.",
            quota: quotaResult.quota,
            access,
          } satisfies FinalItineraryResponseEnvelope,
          { status: 429 }
        )
      }
    }

    const { requirements } = parsedRequest.data
    const result = await runOpenRouterFinalItinerary(
      {
        messages: buildFinalItineraryMessages(requirements),
        maxTokens: getMaxTokensForDuration(requirements.durationDays),
      },
      AbortSignal.timeout(OPENROUTER_TIMEOUT_MS)
    )

    if (!result.ok) {
      return itineraryError("Final itinerary generation failed.", 502, access)
    }

    const validatedItinerary = validateItineraryDuration(
      result.data.response,
      requirements.durationDays
    )

    if (!validatedItinerary.ok) {
      return itineraryError(validatedItinerary.error, 502, access)
    }

    return NextResponse.json({
      ok: true,
      itinerary: validatedItinerary.data,
      access,
    } satisfies FinalItineraryResponseEnvelope)
  } catch (error) {
    if (error instanceof ArcjetConfigurationError) {
      return NextResponse.json(
        {
          ok: false,
          code: "configuration_error",
          error: "Server Arcjet configuration is incomplete.",
          missingVariables: error.missingVariables,
          access,
        } satisfies FinalItineraryResponseEnvelope,
        { status: 500 }
      )
    }

    if (error instanceof OpenRouterConfigurationError) {
      return NextResponse.json(
        {
          ok: false,
          code: "configuration_error",
          error: "Server OpenRouter configuration is incomplete.",
          missingVariables: error.missingVariables,
          access,
        } satisfies FinalItineraryResponseEnvelope,
        { status: 500 }
      )
    }

    if (process.env.NODE_ENV === "development") {
      console.warn("Final itinerary route diagnostic", {
        name: error instanceof Error ? error.name : "UnknownError",
      })
    }

    return itineraryError("Final itinerary route failed.", 500, access)
  }
}

function buildFinalItineraryMessages(
  requirements: FinalItineraryRequirements
): OpenRouterConversationMessage[] {
  return [
    {
      role: "system",
      content: buildFinalSystemInstruction(),
    },
    {
      role: "user",
      content: [
        "Generate a final itinerary from these normalized requirements.",
        `Source: ${requirements.source}`,
        `Destination: ${requirements.destination}`,
        `Duration days: ${requirements.durationDays}`,
        `Budget tier: ${requirements.budgetTier}`,
        `Group size: ${requirements.groupSize}`,
        `Group type: ${requirements.groupType}`,
      ].join("\n"),
    },
  ]
}

function buildFinalSystemInstruction() {
  return [
    "You are a practical trip itinerary generator.",
    "Return only the strict final_itinerary_response JSON Schema.",
    "Echo the normalized travelPlan exactly from the user request.",
    "The itinerary array must contain exactly one day object per requested duration day, with sequential dayNumber values starting at 1.",
    "Each day must include useful activities with timeWindow, timeOfDay when helpful, duration, semantic descriptions, and place names or addresses when available.",
    "Include 2 to 4 hotel recommendations with areas, addresses when available, priceTier, and estimatedPriceText.",
    "Use estimatedPriceText for generated cost guidance only; do not claim exact prices, ratings, business availability, opening hours, or verified coordinates.",
    "Do not include latitude, longitude, lat, lng, providerPlaceId, photos, ratings, or availability. Provider enrichment will verify canonical place data later.",
  ].join(" ")
}

function getMaxTokensForDuration(durationDays: number) {
  return Math.min(8_000, 5_200 + durationDays * 900)
}

function itineraryError(
  error: string,
  status: number,
  access: TripGenerationAccessStatus
) {
  return NextResponse.json(
    {
      ok: false,
      error,
      access,
    } satisfies FinalItineraryResponseEnvelope,
    { status }
  )
}
