import { afterEach, describe, expect, test, vi } from "vitest"

import { resolvePlaceImage } from "@/lib/images/image-resolver"
import { resolveWikimediaImage } from "@/lib/images/wikimedia"
import { getGeoapifyAttribution } from "@/lib/places/place-enrichment"
import {
  GeoapifyProviderError,
  enrichPlaceWithGeoapify,
} from "@/lib/places/geoapify"
import type { PlaceEnrichment } from "@/lib/places/place-enrichment"

type FetchInput = string | URL | Request

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("Wikimedia image resolver", () => {
  test("returns a representative Sylhet destination image", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          wikimediaSearchResponse([
            wikimediaPage({
              title: "File:The Last House of Bangladesh, Sylhet (01).jpg",
              thumbUrl:
                "https://upload.wikimedia.org/wikipedia/commons/thumb/sylhet.jpg",
              objectName: "The Last House of Bangladesh, Sylhet (01)",
              license: "CC BY-SA 4.0",
            }),
          ])
        )
      )
    )

    const result = await resolveWikimediaImage({
      query: "Sylhet",
      context: "Bangladesh",
      kind: "representative",
      alt: "Sylhet destination",
      strictTitleMatch: false,
      signal: AbortSignal.timeout(1_000),
    })

    expect(result).toMatchObject({
      status: "found",
      image: {
        source: "wikimedia",
        kind: "representative",
        alt: "Sylhet destination",
        license: "CC BY-SA 4.0",
      },
    })
  })

  test("returns a strongly associated exact Ratargul image", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          wikimediaSearchResponse([
            wikimediaPage({
              title: "File:Ratargul Swamp Forest, Sylhet..jpg",
              thumbUrl:
                "https://upload.wikimedia.org/wikipedia/commons/thumb/ratargul.jpg",
              objectName: "Ratargul Swamp Forest, Sylhet.",
            }),
          ])
        )
      )
    )

    const result = await resolveWikimediaImage({
      query: "Ratargul Swamp Forest",
      context: "Sylhet Bangladesh",
      kind: "exact_place",
      alt: "Ratargul Swamp Forest",
      strictTitleMatch: true,
      signal: AbortSignal.timeout(1_000),
    })

    expect(result).toMatchObject({
      status: "found",
      image: {
        source: "wikimedia",
        kind: "exact_place",
        alt: "Ratargul Swamp Forest",
      },
    })
  })

  test("rejects ambiguous Ratargul-like results that lack the place identity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          wikimediaSearchResponse([
            wikimediaPage({
              title: "File:Swamp forest in Sylhet.jpg",
              thumbUrl:
                "https://upload.wikimedia.org/wikipedia/commons/thumb/swamp.jpg",
              objectName: "Swamp forest in Sylhet",
            }),
          ])
        )
      )
    )

    const result = await resolveWikimediaImage({
      query: "Ratargul Swamp Forest",
      context: "Sylhet Bangladesh",
      kind: "exact_place",
      alt: "Ratargul Swamp Forest",
      strictTitleMatch: true,
      signal: AbortSignal.timeout(1_000),
    })

    expect(result.status).toBe("rejected_ambiguous_match")
  })

  test("distinguishes provider empty, provider failure, and unsafe URL results", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ query: { pages: [] } }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      resolveWikimediaImage({
        query: "Missing",
        kind: "representative",
        alt: "Missing destination",
        strictTitleMatch: false,
        signal: AbortSignal.timeout(1_000),
      })
    ).resolves.toMatchObject({ status: "no_result" })

    fetchMock.mockResolvedValueOnce(jsonResponse({}, 503))
    await expect(
      resolveWikimediaImage({
        query: "Provider failure",
        kind: "representative",
        alt: "Provider failure",
        strictTitleMatch: false,
        signal: AbortSignal.timeout(1_000),
      })
    ).resolves.toMatchObject({ status: "provider_failure" })

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        wikimediaSearchResponse([
          wikimediaPage({
            title: "File:Sylhet Bangladesh.jpg",
            thumbUrl: "https://images.example/sylhet.jpg",
            objectName: "Sylhet Bangladesh",
          }),
        ])
      )
    )
    await expect(
      resolveWikimediaImage({
        query: "Sylhet",
        context: "Bangladesh",
        kind: "representative",
        alt: "Sylhet destination",
        strictTitleMatch: false,
        signal: AbortSignal.timeout(1_000),
      })
    ).resolves.toMatchObject({ status: "rejected_unsafe_url" })
  })

  test("does not perform secondary exact image lookup for hotels", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      resolvePlaceImage({
        place: placeFixture({
          displayName: "Hotel Supreme",
        }),
        request: {
          query: "Hotel Supreme",
          lookupKind: "hotel",
          destination: "Sylhet",
        },
        signal: AbortSignal.timeout(1_000),
      })
    ).resolves.toMatchObject({ status: "unsupported_lookup" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("Geoapify image has priority over secondary resolver", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test-key")
    const fetchMock = vi.fn(async (input: FetchInput) => {
      const url = toUrl(input)

      if (url.hostname === "commons.wikimedia.org") {
        throw new Error("Secondary provider should not be called")
      }

      if (url.pathname === "/v1/geocode/search") {
        if (url.searchParams.get("type") === "city") {
          return jsonResponse({
            results: [
              {
                place_id: "tokyo-city",
                name: "Tokyo",
                formatted: "Tokyo, Japan",
                result_type: "city",
                country: "Japan",
                country_code: "jp",
                city: "Tokyo",
                lat: 35.6764,
                lon: 139.65,
                rank: {
                  confidence: 1,
                  match_type: "full_match",
                },
              },
            ],
          })
        }

        return jsonResponse({
          results: [
            {
              place_id: "tokyo-tower",
              name: "Tokyo Tower",
              formatted: "Tokyo Tower, Tokyo, Japan",
              result_type: "amenity",
              country: "Japan",
              country_code: "jp",
              city: "Tokyo",
              lat: 35.6586,
              lon: 139.7454,
              rank: {
                confidence: 1,
                match_type: "full_match",
              },
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
                image:
                  "https://upload.wikimedia.org/wikipedia/commons/tokyo-tower.jpg",
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

    expect(place.image).toMatchObject({
      source: "geoapify",
      kind: "exact_place",
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  test("no confident hotel match does not trigger exact image lookup", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test-key")
    const fetchMock = vi.fn(async (input: FetchInput) => {
      const url = toUrl(input)

      if (url.hostname === "commons.wikimedia.org") {
        throw new Error("Secondary provider should not be called")
      }

      return jsonResponse({ results: [] })
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      enrichPlaceWithGeoapify(
        {
          query: "Hotel Supreme",
          lookupKind: "hotel",
          destination: "Sylhet",
        },
        AbortSignal.timeout(1_000)
      )
    ).rejects.toBeInstanceOf(GeoapifyProviderError)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

function wikimediaSearchResponse(pages: unknown[]) {
  return {
    query: {
      pages,
    },
  }
}

function wikimediaPage({
  license = "CC BY-SA 4.0",
  objectName,
  thumbUrl,
  title,
}: {
  license?: string
  objectName: string
  thumbUrl: string
  title: string
}) {
  return {
    title,
    imageinfo: [
      {
        canonicaltitle: title,
        thumburl: thumbUrl,
        url: thumbUrl.replace("/thumb/", "/"),
        descriptionurl: `https://commons.wikimedia.org/wiki/${title.replaceAll(" ", "_")}`,
        mime: "image/jpeg",
        extmetadata: {
          ObjectName: {
            value: objectName,
          },
          Artist: {
            value: "Example photographer",
          },
          LicenseShortName: {
            value: license,
          },
          LicenseUrl: {
            value: "https://creativecommons.org/licenses/by-sa/4.0/",
          },
        },
      },
    ],
  }
}

function placeFixture(overrides: Partial<PlaceEnrichment> = {}): PlaceEnrichment {
  return {
    provider: "geoapify",
    providerPlaceId: "place",
    displayName: "Ratargul Swamp Forest",
    formattedAddress: "Ratargul Swamp Forest, Sylhet, Bangladesh",
    location: {
      lat: 24.8949,
      lng: 91.8687,
    },
    attribution: getGeoapifyAttribution(),
    matchStatus: "verified",
    matchedQuery: "Ratargul Swamp Forest, Sylhet",
    ...overrides,
  }
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
