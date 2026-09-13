import type { FinalItineraryResponse } from "@/lib/ai/contract"

type FinalPresentationState =
  | "ready"
  | "generating"
  | "generationError"
  | "awaitingSave"
  | "saving"
  | "saveError"
  | "savedNavigating"

type FinalPresentationStateInput = {
  finalError: string | null
  finalItinerary: FinalItineraryResponse | null
  isGeneratingFinal: boolean
  isSavingTrip: boolean
  saveError: string | null
  savedTripId: string | null
}

function getFinalPresentationState({
  finalError,
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

  if (finalError !== null) {
    return "generationError"
  }

  return "ready"
}

export { getFinalPresentationState }
export type { FinalPresentationState, FinalPresentationStateInput }
