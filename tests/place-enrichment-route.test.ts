import { afterEach, describe, expect, test, vi } from "vitest"

import {
  GeoapifyProviderError,
  enrichPlaceWithGeoapify,
} from "@/lib/places/geoapify"
import { POST } from "@/app/api/place-enrichment/route"

vi.mock("@clerk/nextjs/server", () => ({
  auth: {
    protect: vi.fn(async () => undefined),
  },
}))

vi.mock("@/lib/places/geoapify", () => {
  class GeoapifyConfigurationError extends Error {
    readonly missingVariables: string[]

    constructor(missingVariables: string[]) {
      super("Geoapify configuration is incomplete.")
      this.name = "GeoapifyConfigurationError"
      this.missingVariables = missingVariables
    }
  }

  class GeoapifyProviderError extends Error {
    readonly code: string
    readonly status: number

    constructor(code: string, status: number, message: string) {
      super(message)
      this.name = "GeoapifyProviderError"
      this.code = code
      this.status = status
    }
  }

  return {
    GEOAPIFY_TIMEOUT_MS: 8_000,
    GeoapifyConfigurationError,
    GeoapifyProviderError,
    enrichPlaceWithGeoapify: vi.fn(),
  }
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("place enrichment route response semantics", () => {
  test("returns HTTP 200 for successfully processed no-confident-match lookups", async () => {
    vi.mocked(enrichPlaceWithGeoapify).mockRejectedValueOnce(
      new GeoapifyProviderError(
        "provider_no_confident_match",
        404,
        "No confident canonical place match was found."
      )
    )

    const response = await POST(jsonRequest({ query: "Hotel Supreme" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      matchStatus: "no_confident_match",
      message: "No confident canonical place match was found.",
    })
  })

  test("keeps real provider failures on the non-success path", async () => {
    vi.mocked(enrichPlaceWithGeoapify).mockRejectedValueOnce(
      new GeoapifyProviderError(
        "provider_unavailable",
        503,
        "Place provider lookup failed."
      )
    )

    const response = await POST(jsonRequest({ query: "Ratargul Swamp Forest" }))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({
      ok: false,
      error: "Place provider lookup failed.",
    })
  })
})

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/place-enrichment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}
