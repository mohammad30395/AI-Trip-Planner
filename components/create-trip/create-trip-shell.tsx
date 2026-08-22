"use client"

import { useReducer, useRef } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "convex/react"

import { Badge } from "@/components/ui/badge"
import { api } from "@/convex/_generated/api"
import { parseTripConversationResponseEnvelope } from "@/lib/ai/conversation"
import { parseFinalItineraryResponseEnvelope } from "@/lib/ai/itinerary"

import { ConversationPanel } from "./conversation-panel"
import {
  buildUserMessage,
  createTripReducer,
  getCurrentSelector,
  getCompactRequirements,
  getFinalItineraryRequirements,
  getRecentConversationContext,
  initialCreateTripState,
  validateCurrentStep,
  type BudgetTier,
  type GroupSelection,
  type TripRequirements,
} from "./create-trip-flow"
import { TripPreviewPanel } from "./trip-preview-panel"

function CreateTripShell() {
  const router = useRouter()
  const [state, dispatch] = useReducer(
    createTripReducer,
    initialCreateTripState
  )
  const saveGeneratedTrip = useMutation(api.trips.saveGeneratedTrip)
  const requestSequence = useRef(0)
  const finalRequestSequence = useRef(0)
  const saveRequestKey = useRef<string | null>(null)
  const pendingController = useRef<AbortController | null>(null)
  const pendingFinalController = useRef<AbortController | null>(null)
  const selector = getCurrentSelector(state.currentStep)

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
        throw new Error("AI response could not be used safely.")
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

      if (process.env.NODE_ENV === "development") {
        console.warn("Create trip AI request diagnostic", {
          name: error instanceof Error ? error.name : "UnknownError",
        })
      }

      dispatch({
        type: "aiRequestFailed",
        error:
          "The assistant response could not be used. Your trip fields are preserved; try again.",
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

      if (!response.ok || !parsedResponse.ok) {
        throw new Error("Final itinerary response could not be used safely.")
      }

      if (finalRequestSequence.current !== requestId) {
        return
      }

      saveRequestKey.current = crypto.randomUUID()

      dispatch({
        type: "finalGenerationSucceeded",
        itinerary: parsedResponse.data,
      })
    } catch (error) {
      if (
        controller.signal.aborted ||
        finalRequestSequence.current !== requestId
      ) {
        return
      }

      if (process.env.NODE_ENV === "development") {
        console.warn("Final itinerary request diagnostic", {
          name: error instanceof Error ? error.name : "UnknownError",
        })
      }

      dispatch({
        type: "finalGenerationFailed",
        error:
          "The final itinerary could not be generated safely. Your trip brief is preserved; try again.",
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
        generatedTripPayload: state.finalItinerary,
      })

      dispatch({ type: "saveTripSucceeded", tripId })
      router.push(`/view-trip/${tripId}`)
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Save generated trip diagnostic", {
          name: error instanceof Error ? error.name : "UnknownError",
        })
      }

      dispatch({
        type: "saveTripFailed",
        error:
          "The itinerary could not be saved. Your generated trip is preserved; retry saving.",
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

  return (
    <section className="grid min-w-0 gap-6">
      <div className="max-w-3xl">
        <Badge variant="outline">AI conversation shell</Badge>
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight">
          Create Trip
        </h1>
        <p className="app-muted mt-3 max-w-2xl leading-7">
          Collect trip requirements with a server-side AI interviewer, then
          generate a typed itinerary after review. Save the generated trip to
          your account when the itinerary is ready.
        </p>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:items-start">
        <ConversationPanel
          onConfirm={() => submitRequirements(state.requirements)}
          onGenerateFinal={generateFinalItinerary}
          onReset={resetFlow}
          onSaveTrip={saveTrip}
          onSelectBudget={(value: BudgetTier) =>
            submitRequirements({
              ...state.requirements,
              budgetTier: value,
            })
          }
          onSubmitDestination={(value: string) =>
            submitRequirements({
              ...state.requirements,
              destination: value.trim(),
            })
          }
          onSubmitDuration={(value: number) =>
            submitRequirements({
              ...state.requirements,
              durationDays: value,
            })
          }
          onSubmitGroup={(value: GroupSelection) =>
            submitRequirements({
              ...state.requirements,
              groupSize: value.groupSize,
              groupType: value.groupType,
            })
          }
          onSubmitSource={(value: string) =>
            submitRequirements({
              ...state.requirements,
              source: value.trim(),
            })
          }
          selector={selector}
          state={state}
        />
        <TripPreviewPanel
          requirements={state.requirements}
          step={state.currentStep}
        />
      </div>
    </section>
  )
}

export { CreateTripShell }
