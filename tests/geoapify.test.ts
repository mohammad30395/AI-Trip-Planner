import { afterEach, describe, expect, test, vi } from "vitest"

import {
  GeoapifyProviderError,
  enrichPlaceWithGeoapify,
} from "@/lib/places/geoapify"

type FetchInput = string | URL | Request
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("Geoapify enrichment adapter with mocked provider responses", () => {
  test("normalizes geocoding success and optional details image", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test-key")
    const fetchMock = vi.fn(async (input: FetchInput) => {
      const url = toUrl(input)

      expect(url.hostname).toBe("api.geoapify.com")
      expect(url.searchParams.get("apiKey")).toBe("test-key")

      if (url.pathname === "/v1/geocode/search") {
        expect(url.searchParams.get("text")).toContain("Tokyo Tower")
        return jsonResponse({
          results: [
            {
              place_id: "geo-place-1",
              name: "Tokyo Tower",
              formatted: "Tokyo Tower, Tokyo, Japan",
              lat: 35.6586,
              lon: 139.7454,
            },
          ],
        })
      }

      expect(url.pathname).toBe("/v2/place-details")
      return jsonResponse({
        features: [
          {
            properties: {
              feature_type: "details",
              wiki_and_media: {
                image: "https://images.example/tokyo-tower.jpg",
              },
            },
          },
        ],
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const place = await enrichPlaceWithGeoapify(
      {
        query: "Tokyo Tower",
        destination: "Tokyo",
      },
      AbortSignal.timeout(1_000)
    )

    expect(place).toMatchObject({
      provider: "geoapify",
      providerPlaceId: "geo-place-1",
      displayName: "Tokyo Tower",
      formattedAddress: "Tokyo Tower, Tokyo, Japan",
      location: {
        lat: 35.6586,
        lng: 139.7454,
      },
      image: {
        url: "https://images.example/tokyo-tower.jpg",
        source: "geoapify",
      },
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test("returns base geocoding when details fail", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: FetchInput) => {
        const url = toUrl(input)

        if (url.pathname === "/v1/geocode/search") {
          return jsonResponse({
            results: [
              {
                place_id: "geo-place-2",
                address_line1: "Louvre Museum",
                formatted: "Louvre Museum, Paris, France",
                lat: 48.8606,
                lon: 2.3376,
              },
            ],
          })
        }

        return jsonResponse({ error: "rate limited" }, 429)
      })
    )

    const place = await enrichPlaceWithGeoapify(
      {
        query: "Louvre Museum",
        destination: "Paris",
      },
      AbortSignal.timeout(1_000)
    )

    expect(place.providerPlaceId).toBe("geo-place-2")
    expect(place.image).toBeUndefined()
  })

  test("ignores non-HTTPS details image URLs", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: FetchInput) => {
        const url = toUrl(input)

        if (url.pathname === "/v1/geocode/search") {
          return jsonResponse({
            results: [
              {
                place_id: "geo-place-3",
                formatted: "A place",
                lat: 1,
                lon: 2,
              },
            ],
          })
        }

        return jsonResponse({
          features: [
            {
              properties: {
                feature_type: "details",
                wiki_and_media: {
                  image: "http://images.example/insecure.jpg",
                },
              },
            },
          ],
        })
      })
    )

    const place = await enrichPlaceWithGeoapify(
      {
        query: "A place",
      },
      AbortSignal.timeout(1_000)
    )

    expect(place.image).toBeUndefined()
  })

  test("maps no-result and malformed coordinates to provider errors", async () => {
    await expectProviderError({ results: [] }, "provider_no_results")
    await expectProviderError(
      {
        results: [
          {
            place_id: "bad-coords",
            formatted: "Bad coordinates",
            lat: 95,
            lon: 200,
          },
        ],
      },
      "provider_malformed"
    )
  })

  test("maps auth, quota, and provider status errors", async () => {
    await expectStatusError(401, "provider_auth_failed")
    await expectStatusError(429, "provider_rate_limited")
    await expectStatusError(503, "provider_unavailable")
  })
})

async function expectProviderError(
  geocodingBody: unknown,
  code: GeoapifyProviderError["code"]
) {
  vi.stubEnv("GEOAPIFY_API_KEY", "test-key")
  vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(geocodingBody)))

  await expect(
    enrichPlaceWithGeoapify({ query: "Missing" }, AbortSignal.timeout(1_000))
  ).rejects.toMatchObject({
    code,
  })

  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
}

async function expectStatusError(
  status: number,
  code: GeoapifyProviderError["code"]
) {
  vi.stubEnv("GEOAPIFY_API_KEY", "test-key")
  vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, status)))

  await expect(
    enrichPlaceWithGeoapify({ query: "Rejected" }, AbortSignal.timeout(1_000))
  ).rejects.toMatchObject({
    code,
  })

  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

function toUrl(input: FetchInput) {
  if (input instanceof URL) {
    return input
  }

  if (typeof input === "string") {
    return new URL(input)
  }

  return new URL(input.url)
}
