import { describe, expect, test } from "vitest"

import {
  GeoapifyProviderError,
  enrichPlaceWithGeoapify,
} from "@/lib/places/geoapify"
import type { PlaceEnrichmentRequest } from "@/lib/places/place-enrichment"

type LiveSmokeObservation = {
  label: string
  displayName?: string
  formattedAddress?: string
  countryOrCityHint?: string
  image?: {
    source: string
    kind: string
    host: string
    license?: string
  }
  matchStatus: "verified" | "probable" | "no_confident_match"
}

const runLiveSmoke = process.env.GEOAPIFY_LIVE_SMOKE === "1"

describe("live Geoapify Dhaka to Sylhet smoke", () => {
  test.runIf(runLiveSmoke)(
    "keeps destination-local canonical matches safe",
    async () => {
      const observations: LiveSmokeObservation[] = []

      const destination = await lookupLivePlace("destination Sylhet", {
        query: "Sylhet",
        lookupKind: "city",
        country: "Bangladesh",
      })
      observations.push(destination.observation)
      expect(destination.place.formattedAddress).toMatch(/Bangladesh/i)
      expect(destination.place.location.lat).toBeGreaterThan(24)
      expect(destination.place.location.lat).toBeLessThan(26)
      expect(destination.place.location.lng).toBeGreaterThan(91)
      expect(destination.place.location.lng).toBeLessThan(93)
      expect(destination.place.image).toMatchObject({
        source: "wikimedia",
        kind: "representative",
      })

      const attraction = await lookupLivePlace("Ratargul Swamp Forest", {
        query: "Ratargul Swamp Forest",
        lookupKind: "specific_place",
        destination: "Sylhet",
        country: "Bangladesh",
      })
      observations.push(attraction.observation)
      expect(attraction.place.displayName).toMatch(/Ratargul/i)
      expect(attraction.place.formattedAddress).toMatch(/Bangladesh/i)
      expect(attraction.place.location.lat).toBeGreaterThan(24)
      expect(attraction.place.location.lat).toBeLessThan(26)
      expect(attraction.place.location.lng).toBeGreaterThan(91)
      expect(attraction.place.location.lng).toBeLessThan(93)
      expect(attraction.place.image).toMatchObject({
        source: "wikimedia",
        kind: "exact_place",
      })

      observations.push(
        await lookupHotelSafely("Hotel Supreme", "Zindabazar"),
        await lookupHotelSafely("Hotel Palash", "Kazir Bazar")
      )

      console.log("LIVE_GEOAPIFY_SMOKE_SAFE_OBSERVATIONS", observations)
    },
    30_000
  )

  test.skipIf(runLiveSmoke)(
    "is skipped unless GEOAPIFY_LIVE_SMOKE=1 is set",
    () => {
      expect(process.env.GEOAPIFY_LIVE_SMOKE).not.toBe("1")
    }
  )
})

async function lookupHotelSafely(
  query: string,
  area: string
): Promise<LiveSmokeObservation> {
  const result = await lookupMaybeConfident(query, {
    query,
    lookupKind: "hotel",
    area,
    destination: "Sylhet",
    country: "Bangladesh",
  })

  if (result.matchStatus === "no_confident_match") {
    return result
  }

  expect(result.formattedAddress).toMatch(/Bangladesh/i)
  expect(result.formattedAddress).toMatch(/Sylhet/i)
  expect(result.displayName).toMatch(new RegExp(query.replace(/\s+/g, ".*"), "i"))
  return result
}

async function lookupLivePlace(
  label: string,
  request: PlaceEnrichmentRequest
) {
  const place = await enrichPlaceWithGeoapify(
    request,
    AbortSignal.timeout(12_000)
  )

  return {
    place,
    observation: {
      label,
      displayName: place.displayName,
      formattedAddress: place.formattedAddress,
      countryOrCityHint: summarizeAddress(place.formattedAddress),
      ...(place.image !== undefined
        ? {
            image: {
              source: place.image.source,
              kind: place.image.kind,
              host: new URL(place.image.url).hostname,
              ...(place.image.license !== undefined
                ? { license: place.image.license }
                : {}),
            },
          }
        : {}),
      matchStatus: place.matchStatus,
    } satisfies LiveSmokeObservation,
  }
}

async function lookupMaybeConfident(
  label: string,
  request: PlaceEnrichmentRequest
): Promise<LiveSmokeObservation> {
  try {
    return (await lookupLivePlace(label, request)).observation
  } catch (error) {
    if (
      error instanceof GeoapifyProviderError &&
      error.code === "provider_no_confident_match"
    ) {
      return {
        label,
        matchStatus: "no_confident_match",
      }
    }

    throw error
  }
}

function summarizeAddress(formattedAddress: string) {
  return formattedAddress
    .split(",")
    .map((part) => part.trim())
    .filter((part) => /sylhet|bangladesh/i.test(part))
    .join(", ")
}
