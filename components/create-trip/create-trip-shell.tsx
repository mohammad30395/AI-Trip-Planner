"use client"

import { useReducer } from "react"

import { Badge } from "@/components/ui/badge"

import { ConversationPanel } from "./conversation-panel"
import {
  createTripReducer,
  getCurrentSelector,
  initialCreateTripState,
} from "./create-trip-flow"
import { TripPreviewPanel } from "./trip-preview-panel"

function CreateTripShell() {
  const [state, dispatch] = useReducer(
    createTripReducer,
    initialCreateTripState
  )
  const selector = getCurrentSelector(state.currentStep)

  return (
    <section className="grid min-w-0 gap-6">
      <div className="max-w-3xl">
        <Badge variant="outline">Local planning shell</Badge>
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight">
          Create Trip
        </h1>
        <p className="app-muted mt-3 max-w-2xl leading-7">
          Collect the trip requirements in a deterministic local flow. AI
          generation, saved trips, quota checks, billing, maps, and place
          enrichment are intentionally not connected yet.
        </p>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:items-start">
        <ConversationPanel
          dispatch={dispatch}
          selector={selector}
          state={state}
        />
        <TripPreviewPanel requirements={state.requirements} step={state.currentStep} />
      </div>
    </section>
  )
}

export { CreateTripShell }
