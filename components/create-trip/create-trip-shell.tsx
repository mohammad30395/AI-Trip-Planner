"use client"

import { useReducer, useRef } from "react"

import { Badge } from "@/components/ui/badge"
import { parseTripConversationResponseEnvelope } from "@/lib/ai/conversation"

import { ConversationPanel } from "./conversation-panel"
import {
  buildUserMessage,
  createTripReducer,
  getCurrentSelector,
  getCompactRequirements,
  getRecentConversationContext,
  initialCreateTripState,
  validateCurrentStep,
  type BudgetTier,
  type GroupSelection,
  type TripRequirements,
} from "./create-trip-flow"
import { TripPreviewPanel } from "./trip-preview-panel"

function CreateTripShell() {
  const [state, dispatch] = useReducer(
    createTripReducer,
    initialCreateTripState
  )
  const requestSequence = useRef(0)
  const pendingController = useRef<AbortController | null>(null)
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

  function resetFlow() {
    requestSequence.current += 1
    pendingController.current?.abort()
    pendingController.current = null
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
          Collect trip requirements with a server-side AI interviewer. Final
          itinerary generation, saved trips, quota checks, billing, maps, and
          place enrichment are intentionally not connected yet.
        </p>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:items-start">
        <ConversationPanel
          onConfirm={() => submitRequirements(state.requirements)}
          onReset={resetFlow}
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
