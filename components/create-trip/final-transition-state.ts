import type { FinalItineraryResponse } from "@/lib/ai/contract"
import type { FinalItineraryQuota } from "@/lib/ai/itinerary"

type FinalPresentationState =
  | "ready"
  | "generating"
  | "quotaBlocked"
  | "generationError"
  | "awaitingSave"
  | "saving"
  | "saveError"
  | "savedNavigating"

type FinalPresentationStateInput = {
  finalError: string | null
  finalQuota: FinalItineraryQuota | null
  finalItinerary: FinalItineraryResponse | null
  isGeneratingFinal: boolean
  isSavingTrip: boolean
  saveError: string | null
  savedTripId: string | null
}

function getFinalPresentationState({
  finalError,
  finalQuota,
  finalItinerary,
  isGeneratingFinal,
  isSavingTrip,
  saveError,
  savedTripId,
}: FinalPresentationStateInput): FinalPresentationState {
  if (savedTripId !== null) {
    return "savedNavigating"
  }

  if (isSavingTrip) {
    return "saving"
  }

  if (finalItinerary !== null && saveError !== null) {
    return "saveError"
  }

  if (finalItinerary !== null) {
    return "awaitingSave"
  }

  if (isGeneratingFinal) {
    return "generating"
  }

  if (finalQuota !== null) {
    return "quotaBlocked"
  }

  if (finalError !== null) {
    return "generationError"
  }

  return "ready"
}

export { getFinalPresentationState }
export type { FinalPresentationState, FinalPresentationStateInput }
