import { afterEach, describe, expect, test, vi } from "vitest"

import {
  GeoapifyProviderError,
  LOCAL_POI_MAX_DISTANCE_METERS,
  enrichPlaceWithGeoapify,
  rankGeoapifyCandidates,
  type GeoapifyCandidate,
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
        if (url.searchParams.get("type") === "city") {
          expect(url.searchParams.get("text")).toContain("Tokyo")
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

        expect(url.searchParams.get("text")).toContain("Tokyo Tower")
        expect(url.searchParams.get("type")).toBeNull()
        expect(url.searchParams.get("filter")).toBe("countrycode:jp")
        return jsonResponse({
          results: [
            {
              place_id: "geo-place-1",
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

      expect(url.pathname).toBe("/v2/place-details")
      return jsonResponse({
        features: [
          {
            properties: {
              feature_type: "details",
              wiki_and_media: {
                image: "https://upload.wikimedia.org/wikipedia/commons/tokyo-tower.jpg",
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
      matchStatus: "verified",
      matchedQuery: "Tokyo Tower, Tokyo",
      image: {
        url: "https://upload.wikimedia.org/wikipedia/commons/tokyo-tower.jpg",
        source: "geoapify",
        kind: "exact_place",
        alt: "Tokyo Tower",
        attribution: "Geoapify / Wikimedia",
      },
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  test("derives destination context before validating hotel candidates", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test-key")
    const fetchMock = vi.fn(async (input: FetchInput) => {
      const url = toUrl(input)

      expect(url.searchParams.get("apiKey")).toBe("test-key")

      if (url.pathname === "/v1/geocode/search") {
        if (url.searchParams.get("type") === "city") {
          expect(url.searchParams.get("text")).toBe("Sylhet")
          return jsonResponse({
            results: [
              {
                place_id: "sylhet-city",
                name: "Sylhet",
                formatted: "Sylhet, Bangladesh",
                result_type: "city",
                country: "Bangladesh",
                country_code: "bd",
                city: "Sylhet",
                lat: 24.8949,
                lon: 91.8687,
                rank: {
                  confidence: 1,
                  match_type: "full_match",
                },
              },
            ],
          })
        }

        expect(url.searchParams.get("text")).toBe(
          "Hotel Supreme, Zindabazar, Sylhet"
        )
        expect(url.searchParams.get("type")).toBe("amenity")
        expect(url.searchParams.get("filter")).toBe("countrycode:bd")
        expect(url.searchParams.get("bias")).toBe("proximity:91.8687,24.8949")
        return jsonResponse({
          results: [
            {
              place_id: "north-america-hotel",
              name: "Hotel Supreme",
              formatted: "Hotel Supreme, Toronto, Canada",
              result_type: "amenity",
              category: "accommodation.hotel",
              country: "Canada",
              country_code: "ca",
              city: "Toronto",
              lat: 43.6532,
              lon: -79.3832,
              rank: {
                confidence: 1,
                match_type: "full_match",
              },
            },
          ],
        })
      }

      throw new Error(`Unexpected provider call to ${url.pathname}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      enrichPlaceWithGeoapify(
        {
          query: "Hotel Supreme",
          lookupKind: "hotel",
          area: "Zindabazar",
          destination: "Sylhet",
        },
        AbortSignal.timeout(1_000)
      )
    ).rejects.toMatchObject({
      code: "provider_no_confident_match",
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test("normalizes destination city media as representative images", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: FetchInput) => {
        const url = toUrl(input)

        if (url.pathname === "/v1/geocode/search") {
          expect(url.searchParams.get("type")).toBe("city")
          return jsonResponse({
            results: [
              {
                place_id: "sylhet-city",
                name: "Sylhet",
                formatted: "Sylhet, Sylhet Division, Bangladesh",
                result_type: "city",
                country: "Bangladesh",
                country_code: "bd",
                city: "Sylhet",
                lat: 24.8949,
                lon: 91.8687,
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
                    "https://upload.wikimedia.org/wikipedia/commons/sylhet.jpg",
                },
              },
            },
          ],
        })
      })
    )

    const place = await enrichPlaceWithGeoapify(
      {
        query: "Sylhet",
        lookupKind: "city",
        country: "Bangladesh",
      },
      AbortSignal.timeout(1_000)
    )

    expect(place.image).toEqual({
      url: "https://upload.wikimedia.org/wikipedia/commons/sylhet.jpg",
      source: "geoapify",
      kind: "representative",
      alt: "Sylhet destination",
      attribution: "Geoapify / Wikimedia",
    })
  })

  test("keeps destination enrichment valid when provider has no image", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: FetchInput) => {
        const url = toUrl(input)

        if (url.pathname === "/v1/geocode/search") {
          return jsonResponse({
            results: [
              {
                place_id: "sylhet-city",
                name: "Sylhet",
                formatted: "Sylhet, Sylhet Division, Bangladesh",
                result_type: "city",
                country: "Bangladesh",
                country_code: "bd",
                city: "Sylhet",
                lat: 24.8949,
                lon: 91.8687,
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
              },
            },
          ],
        })
      })
    )

    const place = await enrichPlaceWithGeoapify(
      {
        query: "Sylhet",
        lookupKind: "city",
        country: "Bangladesh",
      },
      AbortSignal.timeout(1_000)
    )

    expect(place.displayName).toBe("Sylhet")
    expect(place.image).toBeUndefined()
  })

  test("returns base geocoding when details fail", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: FetchInput) => {
        const url = toUrl(input)

        if (url.pathname === "/v1/geocode/search") {
          if (url.searchParams.get("type") === "city") {
            return jsonResponse({
              results: [
                {
                  place_id: "paris-city",
                  name: "Paris",
                  formatted: "Paris, France",
                  result_type: "city",
                  country: "France",
                  country_code: "fr",
                  city: "Paris",
                  lat: 48.8535,
                  lon: 2.3484,
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
                place_id: "geo-place-2",
                address_line1: "Louvre Museum",
                formatted: "Louvre Museum, Paris, France",
                result_type: "amenity",
                country: "France",
                country_code: "fr",
                city: "Paris",
                lat: 48.8606,
                lon: 2.3376,
                rank: {
                  confidence: 1,
                  match_type: "full_match",
                },
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

  test("ignores non-HTTPS and unsupported details image URLs", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test-key")
    const fetchMock = vi.fn(async (input: FetchInput) => {
      const url = toUrl(input)

      if (url.pathname === "/v1/geocode/search") {
        return jsonResponse({
          results: [
            {
              place_id: "geo-place-3",
              formatted: "A place",
              result_type: "amenity",
              lat: 1,
              lon: 2,
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
                image: "http://upload.wikimedia.org/insecure.jpg",
              },
            },
          },
        ],
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const place = await enrichPlaceWithGeoapify(
      {
        query: "A place",
      },
      AbortSignal.timeout(1_000)
    )

    expect(place.image).toBeUndefined()

    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({
        results: [
          {
            place_id: "geo-place-4",
            formatted: "Another place",
            result_type: "amenity",
            lat: 1,
            lon: 2,
            rank: {
              confidence: 1,
              match_type: "full_match",
            },
          },
        ],
      })
    )
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({
        features: [
          {
            properties: {
              feature_type: "details",
              wiki_and_media: {
                image: "https://images.example/unsupported.jpg",
              },
            },
          },
        ],
      })
    )

    const unsupportedHostPlace = await enrichPlaceWithGeoapify(
      {
        query: "Another place",
      },
      AbortSignal.timeout(1_000)
    )

    expect(unsupportedHostPlace.image).toBeUndefined()
  })

  test("normalizes hotel exact images when details media is valid", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: FetchInput) => {
        const url = toUrl(input)

        if (url.pathname === "/v1/geocode/search") {
          return jsonResponse({
            results: [
              {
                place_id: "hotel-place",
                name: "Hotel Metro",
                formatted: "Hotel Metro, Sylhet, Bangladesh",
                result_type: "amenity",
                category: "accommodation.hotel",
                country: "Bangladesh",
                country_code: "bd",
                city: "Sylhet",
                lat: 24.8949,
                lon: 91.8687,
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
                    "https://upload.wikimedia.org/wikipedia/commons/hotel-metro.jpg",
                },
              },
            },
          ],
        })
      })
    )

    const place = await enrichPlaceWithGeoapify(
      {
        query: "Hotel Metro",
        lookupKind: "hotel",
        destination: "Sylhet",
        country: "Bangladesh",
      },
      AbortSignal.timeout(1_000)
    )

    expect(place.image).toMatchObject({
      url: "https://upload.wikimedia.org/wikipedia/commons/hotel-metro.jpg",
      source: "geoapify",
      kind: "exact_place",
      alt: "Hotel Metro",
    })
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

  test("ranks exact Sylhet attraction and city candidates as confident", () => {
    const attraction = rankGeoapifyCandidates({
      request: {
        query: "Ratargul Swamp Forest",
        lookupKind: "specific_place",
        destination: "Sylhet",
        country: "Bangladesh",
      },
      candidates: [
        candidate({
          providerPlaceId: "ratargul",
          displayName: "Ratargul Swamp Forest",
          formattedAddress: "Ratargul Swamp Forest, Sylhet, Bangladesh",
          countryCode: "bd",
          country: "Bangladesh",
          city: "Sylhet",
          resultType: "amenity",
          category: "tourism.sights",
        }),
      ],
    })
    const city = rankGeoapifyCandidates({
      request: {
        query: "Sylhet, Bangladesh",
        lookupKind: "city",
        country: "Bangladesh",
      },
      candidates: [
        candidate({
          providerPlaceId: "sylhet",
          displayName: "Sylhet",
          formattedAddress: "Sylhet, Sylhet Division, Bangladesh",
          countryCode: "bd",
          country: "Bangladesh",
          city: "Sylhet",
          resultType: "city",
        }),
      ],
    })

    expect(attraction.status).toBe("verified")
    expect(city.status).toBe("verified")
  })

  test("rejects unrelated hotel candidates even with matching area text", () => {
    const architect = rankGeoapifyCandidates({
      request: {
        query: "Hotel Supreme",
        lookupKind: "hotel",
        area: "Zindabazar",
        destination: "Sylhet",
        country: "Bangladesh",
      },
      candidates: [
        candidate({
          providerPlaceId: "architect",
          displayName: "Naksha Engineer's & Architect",
          formattedAddress: "Zindabazar, Sylhet, Bangladesh",
          countryCode: "bd",
          country: "Bangladesh",
          city: "Sylhet",
          district: "Zindabazar",
          resultType: "amenity",
          category: "office.engineer",
        }),
      ],
    })
    const bridge = rankGeoapifyCandidates({
      request: {
        query: "Hotel Palash",
        lookupKind: "hotel",
        area: "Kazir Bazar",
        destination: "Sylhet",
        country: "Bangladesh",
      },
      candidates: [
        candidate({
          providerPlaceId: "bridge",
          displayName: "Kazir Bazar Bridge",
          formattedAddress: "Kazir Bazar, Sylhet, Bangladesh",
          countryCode: "bd",
          country: "Bangladesh",
          city: "Sylhet",
          district: "Kazir Bazar",
          resultType: "amenity",
          category: "transport.bridge",
        }),
      ],
    })

    expect(architect.status).toBe("no_confident_match")
    expect(bridge.status).toBe("no_confident_match")
  })

  test("rejects unrelated hotels sharing only a generic lodging word", () => {
    const result = rankGeoapifyCandidates({
      request: {
        query: "Hotel Supreme",
        lookupKind: "hotel",
        area: "Zindabazar",
        destination: "Sylhet",
        country: "Bangladesh",
      },
      candidates: [
        candidate({
          providerPlaceId: "hotel-anurag",
          displayName: "Hotel Anurag",
          formattedAddress: "Hotel Anurag, Zindabazar, Sylhet, Bangladesh",
          countryCode: "bd",
          country: "Bangladesh",
          city: "Sylhet",
          district: "Zindabazar",
          resultType: "amenity",
          category: "accommodation.hotel",
        }),
      ],
    })

    expect(result.status).toBe("no_confident_match")
  })

  test("rejects North American candidates for Bangladesh destination context", () => {
    const result = rankGeoapifyCandidates({
      request: {
        query: "Hotel Supreme",
        lookupKind: "hotel",
        area: "Zindabazar",
        destination: "Sylhet",
        country: "Bangladesh",
      },
      destinationContext: {
        query: "Sylhet",
        country: "Bangladesh",
        countryCode: "bd",
        location: {
          lat: 24.8949,
          lng: 91.8687,
        },
      },
      candidates: [
        candidate({
          providerPlaceId: "north-america",
          displayName: "Hotel Supreme",
          formattedAddress: "Hotel Supreme, New York, United States",
          countryCode: "us",
          country: "United States",
          city: "New York",
          resultType: "amenity",
          category: "accommodation.hotel",
          location: {
            lat: 40.7128,
            lng: -74.006,
          },
        }),
      ],
    })

    expect(result.status).toBe("no_confident_match")
  })

  test("rejects incompatible hotel result types and categories", () => {
    const request = {
      query: "Hotel Supreme",
      lookupKind: "hotel" as const,
      area: "Zindabazar",
      destination: "Sylhet",
      country: "Bangladesh",
    }
    const rejectedCandidates: GeoapifyCandidate[] = [
      candidate({
        providerPlaceId: "bridge",
        displayName: "Hotel Supreme Bridge",
        resultType: "amenity",
        category: "transport.bridge",
      }),
      candidate({
        providerPlaceId: "street",
        displayName: "Hotel Supreme Road",
        resultType: "street",
        category: "highway.residential",
      }),
      candidate({
        providerPlaceId: "admin",
        displayName: "Hotel Supreme",
        resultType: "city",
        category: "administrative",
      }),
      candidate({
        providerPlaceId: "office",
        displayName: "Hotel Supreme Business Office",
        resultType: "amenity",
        category: "office.company",
      }),
      candidate({
        providerPlaceId: "locality",
        displayName: "Hotel Supreme Locality",
        resultType: "locality",
        category: "populated_place.locality",
      }),
    ]

    for (const rejectedCandidate of rejectedCandidates) {
      expect(
        rankGeoapifyCandidates({
          request,
          candidates: [rejectedCandidate],
        }).status
      ).toBe("no_confident_match")
    }
  })

  test("uses separate city semantics for destination lookups", () => {
    const amenityResult = rankGeoapifyCandidates({
      request: {
        query: "Sylhet",
        lookupKind: "city",
        country: "Bangladesh",
      },
      candidates: [
        candidate({
          providerPlaceId: "sylhet-hotel",
          displayName: "Sylhet Hotel",
          formattedAddress: "Sylhet Hotel, Bangladesh",
          countryCode: "bd",
          country: "Bangladesh",
          city: "Sylhet",
          resultType: "amenity",
          category: "accommodation.hotel",
        }),
      ],
    })
    const cityResult = rankGeoapifyCandidates({
      request: {
        query: "Sylhet",
        lookupKind: "city",
        country: "Bangladesh",
      },
      candidates: [
        candidate({
          providerPlaceId: "sylhet-city",
          displayName: "Sylhet",
          formattedAddress: "Sylhet, Bangladesh",
          countryCode: "bd",
          country: "Bangladesh",
          city: "Sylhet",
          resultType: "city",
        }),
      ],
    })

    expect(amenityResult.status).toBe("no_confident_match")
    expect(cityResult.status).toBe("verified")
  })

  test("requires named attraction candidates to match name or context", () => {
    const result = rankGeoapifyCandidates({
      request: {
        query: "Ratargul Swamp Forest",
        lookupKind: "specific_place",
        destination: "Sylhet",
        country: "Bangladesh",
      },
      candidates: [
        candidate({
          providerPlaceId: "unrelated-attraction",
          displayName: "Sylhet Tourist Office",
          formattedAddress: "Sylhet, Bangladesh",
          countryCode: "bd",
          country: "Bangladesh",
          city: "Sylhet",
          resultType: "amenity",
          category: "tourism.sights",
        }),
      ],
    })

    expect(result.status).toBe("no_confident_match")
  })

  test("applies the named local POI distance boundary", () => {
    const request = {
      query: "Ratargul Swamp Forest",
      lookupKind: "specific_place" as const,
      destination: "Sylhet",
      country: "Bangladesh",
    }
    const destinationContext = {
      query: "Sylhet",
      country: "Bangladesh",
      countryCode: "bd",
      location: {
        lat: 24.8949,
        lng: 91.8687,
      },
    }

    expect(
      rankGeoapifyCandidates({
        request,
        destinationContext,
        candidates: [
          candidate({
            providerPlaceId: "inside-boundary",
            displayName: "Ratargul Swamp Forest",
            formattedAddress: "Ratargul Swamp Forest, Sylhet, Bangladesh",
            countryCode: "bd",
            country: "Bangladesh",
            city: "Sylhet",
            resultType: "amenity",
            category: "tourism.sights",
            distance: LOCAL_POI_MAX_DISTANCE_METERS,
          }),
        ],
      }).status
    ).toBe("verified")
    expect(
      rankGeoapifyCandidates({
        request,
        destinationContext,
        candidates: [
          candidate({
            providerPlaceId: "outside-boundary",
            displayName: "Ratargul Swamp Forest",
            formattedAddress: "Ratargul Swamp Forest, Bangladesh",
            countryCode: "bd",
            country: "Bangladesh",
            resultType: "amenity",
            category: "tourism.sights",
            distance: LOCAL_POI_MAX_DISTANCE_METERS + 1,
          }),
        ],
      }).status
    ).toBe("no_confident_match")
  })

  test("rejects generic activity text before canonicalization", () => {
    for (const query of [
      "Lunch at local eatery",
      "Check-in and freshen up",
      "Free time",
      "Travel from Dhaka to Sylhet",
    ]) {
      const result = rankGeoapifyCandidates({
        request: {
          query,
          lookupKind: "specific_place",
          destination: "Sylhet",
          country: "Bangladesh",
        },
        candidates: [
          candidate({
            providerPlaceId: "restaurant",
            displayName: "Random Restaurant",
            formattedAddress: "Sylhet, Bangladesh",
            countryCode: "bd",
            country: "Bangladesh",
            city: "Sylhet",
            resultType: "amenity",
            category: "catering.restaurant",
          }),
        ],
      })

      expect(result.status).toBe("no_confident_match")
    }
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

function candidate(overrides: Partial<GeoapifyCandidate>): GeoapifyCandidate {
  return {
    providerPlaceId: "place",
    displayName: "Place",
    formattedAddress: "Place, Sylhet, Bangladesh",
    location: {
      lat: 24.8949,
      lng: 91.8687,
    },
    rankConfidence: 1,
    rankMatchType: "full_match",
    ...overrides,
  }
}
