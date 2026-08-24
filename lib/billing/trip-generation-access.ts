const PREMIUM_TRIP_GENERATION_FEATURE = "unlimited_trip_generation" as const

type TripGenerationAccessStatus = {
  tier: "free" | "premium"
  quotaEnforced: boolean
}

function getTripGenerationAccessStatus(hasPremiumEntitlement: boolean) {
  return {
    tier: hasPremiumEntitlement ? "premium" : "free",
    quotaEnforced: !hasPremiumEntitlement,
  } satisfies TripGenerationAccessStatus
}

export {
  PREMIUM_TRIP_GENERATION_FEATURE,
  getTripGenerationAccessStatus,
  type TripGenerationAccessStatus,
}
