import { describe, expect, test } from "vitest"

import {
  getExternalImageRenderMode,
  normalizeExternalImage,
  normalizeExternalImageUrl,
} from "@/lib/images/external-image"
import {
  buildActivityPlaceEnrichmentRequest,
  buildDestinationCoverEnrichmentRequest,
  getSpecificPlaceNameFromActivityTitle,
} from "@/lib/places/place-lookup-policy"
import { buildPlaceEnrichmentCacheKey } from "@/components/trips/place-enrichment"

describe("external image validation and lookup policy", () => {
  test("accepts supported HTTPS Geoapify image metadata", () => {
    expect(
      normalizeExternalImage({
        url: "https://upload.wikimedia.org/wikipedia/commons/example.jpg",
        source: "geoapify",
        kind: "exact_place",
        alt: "Ratargul Swamp Forest",
        attribution: "Geoapify / Wikimedia",
      })
    ).toEqual({
      url: "https://upload.wikimedia.org/wikipedia/commons/example.jpg",
      source: "geoapify",
      kind: "exact_place",
      alt: "Ratargul Swamp Forest",
      attribution: "Geoapify / Wikimedia",
    })

    expect(
      normalizeExternalImage({
        url: "https://upload.wikimedia.org/wikipedia/commons/sylhet.jpg",
        source: "wikimedia",
        kind: "representative",
        alt: "Sylhet destination",
        attribution: "Example photographer",
        sourcePageUrl: "https://commons.wikimedia.org/wiki/File:Sylhet.jpg",
        license: "CC BY-SA 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      })
    ).toMatchObject({
      source: "wikimedia",
      kind: "representative",
      sourcePageUrl: "https://commons.wikimedia.org/wiki/File:Sylhet.jpg",
      license: "CC BY-SA 4.0",
    })
  })

  test("rejects unsafe or unsupported external image URLs", () => {
    expect(normalizeExternalImageUrl("http://upload.wikimedia.org/file.jpg")).toBeNull()
    expect(normalizeExternalImageUrl("https://fr.wikipedia.org/wiki/Tour_Eiffel")).toBeNull()
    expect(normalizeExternalImageUrl("javascript:alert(1)")).toBeNull()
    expect(normalizeExternalImageUrl("data:image/png;base64,abc")).toBeNull()
    expect(normalizeExternalImageUrl("file:///tmp/file.jpg")).toBeNull()
    expect(normalizeExternalImageUrl("https://localhost/file.jpg")).toBeNull()
    expect(normalizeExternalImageUrl("https://127.0.0.1/file.jpg")).toBeNull()
    expect(normalizeExternalImageUrl("https://images.example/file.jpg")).toBeNull()
    expect(normalizeExternalImageUrl("not a url")).toBeNull()
    expect(
      normalizeExternalImage({
        url: "https://upload.wikimedia.org/wikipedia/commons/example.jpg",
        source: "wikimedia",
        kind: "representative",
        alt: " ",
      })
    ).toBeNull()
  })

  test("models loading, successful, missing, and broken image render states", () => {
    const image = normalizeExternalImage({
      url: "https://upload.wikimedia.org/wikipedia/commons/example.jpg",
      source: "geoapify",
      kind: "representative",
      alt: "Sylhet destination",
    })

    expect(
      getExternalImageRenderMode({
        image,
        isLoading: true,
        loadFailed: false,
      })
    ).toBe("loading")
    expect(
      getExternalImageRenderMode({
        image,
        isLoading: false,
        loadFailed: false,
      })
    ).toBe("image")
    expect(
      getExternalImageRenderMode({
        image: null,
        isLoading: false,
        loadFailed: false,
      })
    ).toBe("fallback")
    expect(
      getExternalImageRenderMode({
        image,
        isLoading: false,
        loadFailed: true,
      })
    ).toBe("fallback")
  })

  test("builds destination cover lookups without inventing image URLs", () => {
    expect(buildDestinationCoverEnrichmentRequest("Sylhet")).toEqual({
      query: "Sylhet",
      lookupKind: "city",
    })
  })

  test("does not build exact-place requests for generic activities", () => {
    expect(
      buildActivityPlaceEnrichmentRequest({
        address: null,
        approximateArea: "Sylhet",
        destination: "Sylhet",
        placeName: "Lunch at local eatery",
      })
    ).toBeNull()

    expect(
      buildActivityPlaceEnrichmentRequest({
        address: null,
        approximateArea: null,
        destination: "Sylhet",
        placeName: null,
        title: "Travel from Dhaka to Sylhet",
      })
    ).toBeNull()
  })

  test("derives specific place lookup from specific activity titles only", () => {
    expect(getSpecificPlaceNameFromActivityTitle("Visit Ratargul Swamp Forest")).toBe(
      "Ratargul Swamp Forest"
    )
    expect(
      buildActivityPlaceEnrichmentRequest({
        address: null,
        approximateArea: null,
        destination: "Sylhet",
        placeName: null,
        title: "Visit Ratargul Swamp Forest",
      })
    ).toEqual({
      query: "Ratargul Swamp Forest",
      lookupKind: "specific_place",
      destination: "Sylhet",
    })
  })

  test("deduplicates repeated My Trips destination cover lookup keys", () => {
    const request = buildDestinationCoverEnrichmentRequest("Sylhet")

    expect(buildPlaceEnrichmentCacheKey(request)).toBe(
      buildPlaceEnrichmentCacheKey(buildDestinationCoverEnrichmentRequest(" Sylhet "))
    )
  })
})
