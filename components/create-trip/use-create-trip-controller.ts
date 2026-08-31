"use client"

import { useEffect, useReducer, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { useConvexAuth, useMutation } from "convex/react"

import { api } from "@/convex/_generated/api"
import { parseTripConversationResponseEnvelope } from "@/lib/ai/conversation"
import { parseFinalItineraryResponseEnvelope } from "@/lib/ai/itinerary"
import { toStoredFinalItineraryPayload } from "@/lib/ai/itinerary-storage"
import {
  formatSaveTripMutationError,
  getConvexTokenReadinessError,
  getSaveTripReadinessError,
} from "@/lib/convex/save-trip-errors"
import {
  createUserSafeError,
  formatUserSafeErrorMessage,
} from "@/lib/errors/user-safe-error"
import { buildQuotaExceededMessage } from "@/lib/quota/free-generation-quota"

import {
  buildUserMessage,
  createTripReducer,
  getCompactRequirements,
  getCurrentSelector,
  getFinalItineraryRequirements,
  getRecentConversationContext,
  initialCreateTripState,
  validateCurrentStep,
  type BudgetTier,
  type CreateTripState,
  type GroupSelection,
  type TripRequirements,
  type UISelector,
} from "./create-trip-flow"

type CreateTripController = {
  state: CreateTripState
  selector: UISelector
  submitCurrentRequirements: () => Promise<void>
  generateFinalItinerary: () => Promise<void>
  resetFlow: () => void
  saveTrip: () => Promise<void>
  selectBudget: (value: BudgetTier) => Promise<void>
  submitDestination: (value: string) => Promise<void>
  submitDuration: (value: number) => Promise<void>
  submitGroup: (value: GroupSelection) => Promise<void>
  submitSource: (value: string) => Promise<void>
}

function useCreateTripController(): CreateTripController {
  const router = useRouter()
  const [state, dispatch] = useReducer(
    createTripReducer,
    initialCreateTripState
  )
  const clerkAuth = useAuth()
  const convexAuth = useConvexAuth()
  const saveGeneratedTrip = useMutation(api.trips.saveGeneratedTrip)
  const requestSequence = useRef(0)
  const finalRequestSequence = useRef(0)
  const saveRequestKey = useRef<string | null>(null)
  const pendingController = useRef<AbortController | null>(null)
  const pendingFinalController = useRef<AbortController | null>(null)
  const selector = getCurrentSelector(state.currentStep)

  useEffect(() => {
    return () => {
      requestSequence.current += 1
      finalRequestSequence.current += 1
      pendingController.current?.abort()
      pendingFinalController.current?.abort()
    }
  }, [])

  async function submitRequirements(requirements: TripRequirements) {
    if (state.isLoading) {
      return
    }

    const validationError = validateCurrentStep(state.currentStep, requirements)

    if (validationError !== null) {
      dispatch({
        type: "localValidationFailed",
        requirements,
        error: validationError,
      })
      return
    }

    if (state.currentStep === "review") {
      dispatch({ type: "markReadyForFinal" })
      return
    }

    if (state.currentStep === "readyForFinal") {
      return
    }

    const userMessage = buildUserMessage(state.currentStep, requirements)
    const requestId = requestSequence.current + 1
    const controller = new AbortController()

    requestSequence.current = requestId
    pendingController.current?.abort()
    pendingController.current = controller

    dispatch({
      type: "aiRequestStarted",
      requirements,
      userMessage,
    })

    try {
      const response = await fetch("/api/ai-model", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: getRecentConversationContext(state.messages, userMessage),
          requirements: getCompactRequirements(requirements),
        }),
        signal: controller.signal,
      })

      const responseBody: unknown = await response.json()
      const parsedResponse = parseTripConversationResponseEnvelope(responseBody)

      if (!response.ok || !parsedResponse.ok) {
        throw new Error("Conversation response validation failed.")
      }

      if (requestSequence.current !== requestId) {
        return
      }

      dispatch({
        type: "aiRequestSucceeded",
        response: parsedResponse.data,
      })
    } catch (error) {
      if (controller.signal.aborted || requestSequence.current !== requestId) {
        return
      }

      dispatch({
        type: "aiRequestFailed",
        error: formatUserSafeErrorMessage(
          createUserSafeError({
            code: "model_output_invalid",
            title: "Assistant response unavailable",
            message:
              "Your trip fields are preserved. Retry this step when you are ready.",
            retry: "same_stage",
            diagnostic: {
              source: "ai-model",
              reason: error instanceof Error ? error.name : "UnknownError",
            },
          })
        ),
      })
    } finally {
      if (requestSequence.current === requestId) {
        pendingController.current = null
      }
    }
  }

  async function generateFinalItinerary() {
    if (
      state.isLoading ||
      state.isGeneratingFinal ||
      state.currentStep !== "readyForFinal"
    ) {
      return
    }

    const requirements = getFinalItineraryRequirements(state.requirements)

    if (requirements === null) {
      dispatch({
        type: "finalGenerationFailed",
        error: "Complete all trip requirements before generating an itinerary.",
      })
      return
    }

    const requestId = finalRequestSequence.current + 1
    const controller = new AbortController()

    finalRequestSequence.current = requestId
    pendingFinalController.current?.abort()
    pendingFinalController.current = controller

    dispatch({ type: "finalGenerationStarted" })

    try {
      const response = await fetch("/api/ai-itinerary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requirements,
        }),
        signal: controller.signal,
      })

      const responseBody: unknown = await response.json()
      const parsedResponse = parseFinalItineraryResponseEnvelope(responseBody)

      if (!parsedResponse.ok) {
        if (
          parsedResponse.code === "quota_exceeded" &&
          parsedResponse.quota !== undefined
        ) {
          dispatch({
            type: "finalGenerationQuotaExceeded",
            error: buildQuotaExceededMessage(parsedResponse.quota),
            quota: parsedResponse.quota,
            access: parsedResponse.access ?? null,
          })
          return
        }

        throw new Error("Final itinerary response validation failed.")
      }

      if (!response.ok) {
        throw new Error("Final itinerary request failed.")
      }

      if (finalRequestSequence.current !== requestId) {
        return
      }

      saveRequestKey.current = crypto.randomUUID()

      dispatch({
        type: "finalGenerationSucceeded",
        itinerary: parsedResponse.data,
        access: parsedResponse.access,
      })
    } catch (error) {
      if (
        controller.signal.aborted ||
        finalRequestSequence.current !== requestId
      ) {
        return
      }

      dispatch({
        type: "finalGenerationFailed",
        error: formatUserSafeErrorMessage(
          createUserSafeError({
            code: "model_output_invalid",
            title: "Itinerary generation unavailable",
            message:
              "Your confirmed brief is preserved. Retry generation without re-entering the trip details.",
            retry: "same_stage",
            diagnostic: {
              source: "ai-itinerary",
              reason: error instanceof Error ? error.name : "UnknownError",
            },
          })
        ),
      })
    } finally {
      if (finalRequestSequence.current === requestId) {
        pendingFinalController.current = null
      }
    }
  }

  async function saveTrip() {
    if (state.isSavingTrip || state.finalItinerary === null) {
      return
    }

    const requirements = getFinalItineraryRequirements(state.requirements)

    if (requirements === null) {
      dispatch({
        type: "saveTripFailed",
        error: "Complete all trip requirements before saving the itinerary.",
      })
      return
    }

    const readinessError = getSaveTripReadinessError(convexAuth)

    if (readinessError !== null) {
      if (convexAuth.isLoading) {
        dispatch({
          type: "saveTripFailed",
          error: readinessError,
        })
        return
      }

      const tokenStatus = await getClerkConvexTokenStatus({
        getToken: clerkAuth.getToken,
        isLoaded: clerkAuth.isLoaded,
        isSignedIn: clerkAuth.isSignedIn,
      })
      const tokenError = getConvexTokenReadinessError(tokenStatus)

      if (tokenError !== null) {
        dispatch({
          type: "saveTripFailed",
          error: tokenError,
        })
        return
      }
    }

    if (saveRequestKey.current === null) {
      saveRequestKey.current = crypto.randomUUID()
    }

    dispatch({ type: "saveTripStarted" })

    try {
      const tripId = await saveGeneratedTrip({
        saveRequestKey: saveRequestKey.current,
        source: requirements.source,
        destination: requirements.destination,
        durationDays: requirements.durationDays,
        budget: requirements.budgetTier,
        groupSize: requirements.groupSize,
        groupType: requirements.groupType,
        generatedTripPayload: toStoredFinalItineraryPayload(state.finalItinerary),
      })

      dispatch({ type: "saveTripSucceeded", tripId })
      router.push(`/view-trip/${tripId}`)
    } catch (error) {
      dispatch({
        type: "saveTripFailed",
        error: formatSaveTripMutationError(error),
      })
    }
  }

  function resetFlow() {
    requestSequence.current += 1
    finalRequestSequence.current += 1
    saveRequestKey.current = null
    pendingController.current?.abort()
    pendingFinalController.current?.abort()
    pendingController.current = null
    pendingFinalController.current = null
    dispatch({ type: "reset" })
  }

  return {
    state,
    selector,
    submitCurrentRequirements: () => submitRequirements(state.requirements),
    generateFinalItinerary,
    resetFlow,
    saveTrip,
    selectBudget: (value) =>
      submitRequirements({
        ...state.requirements,
        budgetTier: value,
      }),
    submitDestination: (value) =>
      submitRequirements({
        ...state.requirements,
        destination: value.trim(),
      }),
    submitDuration: (value) =>
      submitRequirements({
        ...state.requirements,
        durationDays: value,
      }),
    submitGroup: (value) =>
      submitRequirements({
        ...state.requirements,
        groupSize: value.groupSize,
        groupType: value.groupType,
      }),
    submitSource: (value) =>
      submitRequirements({
        ...state.requirements,
        source: value.trim(),
      }),
  }
}

type ClerkTokenProbe = {
  isLoaded: boolean
  isSignedIn: boolean | undefined
  getToken: (options: {
    template?: "convex"
    skipCache?: boolean
  }) => Promise<string | null>
}

async function getClerkConvexTokenStatus({
  getToken,
  isLoaded,
  isSignedIn,
}: ClerkTokenProbe) {
  if (!isLoaded || !isSignedIn) {
    return "missing" as const
  }

  try {
    const token = await getToken({
      template: "convex",
      skipCache: true,
    })

    return token === null ? ("missing" as const) : ("available" as const)
  } catch {
    return "unknown" as const
  }
}

export { useCreateTripController, type CreateTripController }
