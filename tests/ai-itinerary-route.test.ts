import { auth } from "@clerk/nextjs/server"
import { afterEach, describe, expect, test, vi } from "vitest"

import { POST } from "@/app/api/ai-itinerary/route"
import { runOpenRouterFinalItinerary } from "@/lib/ai/openrouter"
import type { FinalItineraryResponse } from "@/lib/ai/contract"

vi.mock("@clerk/nextjs/server", () => ({
  auth: {
    protect: vi.fn(),
  },
}))

vi.mock("@/lib/ai/openrouter", () => {
  class OpenRouterConfigurationError extends Error {
    readonly missingVariables: string[]

    constructor(missingVariables: string[]) {
      super("OpenRouter configuration is incomplete.")
      this.name = "OpenRouterConfigurationError"
      this.missingVariables = missingVariables
    }
  }

  return {
    OPENROUTER_FINAL_ITINERARY_TIMEOUT_MS: 90_000,
    OpenRouterConfigurationError,
    runOpenRouterFinalItinerary: vi.fn(),
  }
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("AI itinerary route without application quota", () => {
  test("allows authenticated non-premium users to reach OpenRouter generation", async () => {
    vi.mocked(auth.protect).mockResolvedValueOnce(clerkAuth(false))
    vi.mocked(runOpenRouterFinalItinerary).mockResolvedValueOnce({
      ok: true,
      data: {
        response: generatedItinerary,
        model: "test-model",
      },
    })

    const response = await POST(jsonRequest(validRequestBody()))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(runOpenRouterFinalItinerary).toHaveBeenCalledTimes(1)
    expect(body).toMatchObject({
      ok: true,
      access: {
        tier: "free",
      },
    })
    expect(body.quota).toBeUndefined()
  })

  test("preserves authenticated premium access while using the same generation path", async () => {
    vi.mocked(auth.protect).mockResolvedValueOnce(clerkAuth(true))
    vi.mocked(runOpenRouterFinalItinerary).mockResolvedValueOnce({
      ok: true,
      data: {
        response: generatedItinerary,
        model: "test-model",
      },
    })

    const response = await POST(jsonRequest(validRequestBody()))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(runOpenRouterFinalItinerary).toHaveBeenCalledTimes(1)
    expect(body).toMatchObject({
      ok: true,
      access: {
        tier: "premium",
      },
    })
  })

  test("keeps unauthenticated final generation blocked before AI work", async () => {
    vi.mocked(auth.protect).mockRejectedValueOnce(new Error("Unauthenticated"))

    await expect(POST(jsonRequest(validRequestBody()))).rejects.toThrow(
      "Unauthenticated"
    )
    expect(runOpenRouterFinalItinerary).not.toHaveBeenCalled()
  })

  test("rejects malformed requests before AI work", async () => {
    vi.mocked(auth.protect).mockResolvedValueOnce(clerkAuth(false))

    const response = await POST(jsonRequest({ requirements: {} }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(runOpenRouterFinalItinerary).not.toHaveBeenCalled()
    expect(body).toMatchObject({
      ok: false,
      error: "Final itinerary request is invalid.",
      access: {
        tier: "free",
      },
    })
  })

  test("keeps provider errors on the sanitized failure path", async () => {
    vi.mocked(auth.protect).mockResolvedValueOnce(clerkAuth(false))
    vi.mocked(runOpenRouterFinalItinerary).mockResolvedValueOnce({
      ok: false,
      code: "provider_error",
      error: "Raw provider details stay inside the adapter.",
    })

    const response = await POST(jsonRequest(validRequestBody()))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({
      ok: false,
      error: "Final itinerary generation failed.",
      code: "provider_error",
      access: {
        tier: "free",
      },
    })
  })

  test("keeps final itinerary duration validation active", async () => {
    vi.mocked(auth.protect).mockResolvedValueOnce(clerkAuth(false))
    vi.mocked(runOpenRouterFinalItinerary).mockResolvedValueOnce({
      ok: true,
      data: {
        response: {
          ...generatedItinerary,
          itinerary: generatedItinerary.itinerary.slice(0, 1),
        },
        model: "test-model",
      },
    })

    const response = await POST(jsonRequest(validRequestBody()))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({
      ok: false,
      error: "generated itinerary day count did not match the requested duration",
      code: "validation_error",
      access: {
        tier: "free",
      },
    })
  })
})

function clerkAuth(hasPremium: boolean) {
  return {
    userId: "user_test",
    has: vi.fn(() => hasPremium),
  } as unknown as Awaited<ReturnType<typeof auth.protect>>
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/ai-itinerary", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

function validRequestBody() {
  return {
    requirements: {
      source: "Dhaka",
      destination: "Tokyo",
      durationDays: 2,
      budgetTier: "mid-range",
      groupSize: 2,
      groupType: "couple",
    },
  }
}

const generatedItinerary = {
  travelPlan: {
    source: "Dhaka",
    destination: "Tokyo",
    durationDays: 2,
    budgetTier: "mid-range",
    groupSize: 2,
    groupType: "couple",
  },
  summary: "Generated summary.",
  hotels: [
    {
      name: "Sample Hotel",
      description: "A generated hotel option.",
      area: "Shinjuku",
      priceTier: "mid-range",
      estimatedPriceText: "Generated estimate.",
    },
  ],
  itinerary: [
    {
      dayNumber: 1,
      title: "Arrival",
      activities: [
        {
          title: "Arrive in Tokyo",
          description: "Settle in after arrival.",
          timeWindow: "Evening",
          estimatedPriceText: "Generated estimate.",
          place: {
            kind: "generic_activity",
            name: null,
            addressHint: null,
            areaHint: null,
            originHint: null,
            destinationHint: null,
          },
        },
      ],
    },
    {
      dayNumber: 2,
      title: "Explore",
      activities: [
        {
          title: "Visit Tokyo Tower",
          description: "Visit Tokyo Tower.",
          timeWindow: "Morning",
          estimatedPriceText: "Generated estimate.",
          place: {
            kind: "specific_place",
            name: "Tokyo Tower",
            addressHint: null,
            areaHint: "Minato City",
            originHint: null,
            destinationHint: null,
          },
        },
      ],
    },
  ],
} satisfies FinalItineraryResponse
