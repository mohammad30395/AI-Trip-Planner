import "server-only"

import arcjet, { tokenBucket } from "@arcjet/next"

import type { FinalItineraryQuota } from "@/lib/ai/itinerary"

import { FREE_GENERATION_QUOTA } from "./free-generation-quota"

class ArcjetConfigurationError extends Error {
  readonly missingVariables: string[]

  constructor(missingVariables: string[]) {
    super("Arcjet configuration is incomplete.")
    this.name = "ArcjetConfigurationError"
    this.missingVariables = missingVariables
  }
}

type TripGenerationQuotaResult =
  | {
      ok: true
    }
  | {
      ok: false
      quota: FinalItineraryQuota
    }

function createTripGenerationArcjet(key: string) {
  return arcjet({
    key,
    rules: [
      tokenBucket({
        mode: "LIVE",
        characteristics: ["userId"],
        refillRate: FREE_GENERATION_QUOTA.successfulGenerationsPerDay,
        interval: FREE_GENERATION_QUOTA.interval,
        capacity: FREE_GENERATION_QUOTA.successfulGenerationsPerDay,
      }),
    ],
  })
}

let cachedTripGenerationArcjet:
  | ReturnType<typeof createTripGenerationArcjet>
  | null = null

function getTripGenerationArcjet() {
  const key = process.env.ARCJET_KEY?.trim()

  if (key === undefined || key.length === 0) {
    throw new ArcjetConfigurationError(["ARCJET_KEY"])
  }

  cachedTripGenerationArcjet ??= createTripGenerationArcjet(key)

  return cachedTripGenerationArcjet
}

async function enforceTripGenerationQuota(
  request: Request,
  userId: string
): Promise<TripGenerationQuotaResult> {
  const decision = await getTripGenerationArcjet().protect(request, {
    userId,
    requested: FREE_GENERATION_QUOTA.tokenCostPerFinalGenerationAttempt,
  })

  if (!decision.isDenied()) {
    return { ok: true }
  }

  const reason = decision.reason

  if (reason.isRateLimit()) {
    return {
      ok: false,
      quota: {
        limit: reason.max,
        remaining: reason.remaining,
        resetSeconds: reason.reset,
        ...(reason.resetTime !== undefined
          ? { resetAt: reason.resetTime.toISOString() }
          : {}),
      },
    }
  }

  return {
    ok: false,
    quota: {
      limit: FREE_GENERATION_QUOTA.successfulGenerationsPerDay,
      remaining: 0,
      resetSeconds: 0,
    },
  }
}

export {
  ArcjetConfigurationError,
  enforceTripGenerationQuota,
  type TripGenerationQuotaResult,
}
