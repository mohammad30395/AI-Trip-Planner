import type { FinalItineraryQuota } from "@/lib/ai/itinerary"

const FREE_GENERATION_QUOTA = {
  successfulGenerationsPerDay: 1,
  interval: "1d",
  intervalLabel: "day",
  tokenCostPerFinalGenerationAttempt: 1,
} as const

function formatQuotaReset(resetAt: string | undefined) {
  if (resetAt === undefined) {
    return "after the quota window resets"
  }

  const resetDate = new Date(resetAt)

  if (Number.isNaN(resetDate.getTime())) {
    return "after the quota window resets"
  }

  return resetDate.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function buildQuotaExceededMessage(quota: FinalItineraryQuota | undefined) {
  const resetCopy = formatQuotaReset(quota?.resetAt)

  return `Free trip generation is limited to ${FREE_GENERATION_QUOTA.successfulGenerationsPerDay} itinerary per ${FREE_GENERATION_QUOTA.intervalLabel}. Try again ${resetCopy}, or review paid access.`
}

export { FREE_GENERATION_QUOTA, buildQuotaExceededMessage }
