const PREMIUM_TRIP_GENERATION_FEATURE = "unlimited_trip_generation" as const

type TripGenerationAccessStatus = {
  tier: "free" | "premium"
  quotaEnforced: boolean
  notice?: string
}

function getTripGenerationAccessStatus(
  hasPremiumEntitlement: boolean,
  notice?: string
) {
  return {
    tier: hasPremiumEntitlement ? "premium" : "free",
    quotaEnforced: !hasPremiumEntitlement,
    ...(notice !== undefined ? { notice } : {}),
  } satisfies TripGenerationAccessStatus
}

export {
  PREMIUM_TRIP_GENERATION_FEATURE,
  getTripGenerationAccessStatus,
  type TripGenerationAccessStatus,
}
