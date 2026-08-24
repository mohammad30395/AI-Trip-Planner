import { describe, expect, test } from "vitest"

import type { ConversationalStepResponse } from "@/lib/ai/contract"
import {
  applyRequirementUpdate,
  areRequirementsComplete,
  createTripReducer,
  getCompactRequirements,
  getFinalItineraryRequirements,
  getStepFromSelector,
  initialCreateTripState,
  validateCurrentStep,
  type TripRequirements,
} from "@/components/create-trip/create-trip-flow"

const completeRequirements = {
  source: "Dhaka",
  destination: "Tokyo",
  durationDays: 3,
  budgetTier: "mid-range",
  groupSize: 2,
  groupType: "couple",
} satisfies TripRequirements

describe("create-trip pure state helpers", () => {
  test("validates missing fields at the UI boundary", () => {
    expect(validateCurrentStep("source", initialCreateTripState.requirements)).toBe(
      "Enter a starting city."
    )
    expect(validateCurrentStep("duration", {
      ...initialCreateTripState.requirements,
      durationDays: 31,
    })).toBe("Duration must be between 1 and 30 days.")
  })

  test("compacts requirements without empty fields", () => {
    expect(
      getCompactRequirements({
        ...initialCreateTripState.requirements,
        source: " Dhaka ",
        durationDays: 5,
      })
    ).toEqual({
      source: "Dhaka",
      durationDays: 5,
    })
  })

  test("applies normalized requirement updates without clearing existing fields", () => {
    expect(
      applyRequirementUpdate(
        {
          ...completeRequirements,
          destination: "Osaka",
        },
        {
          destination: "Kyoto",
        }
      ).source
    ).toBe("Dhaka")
  })

  test("moves to the next selector after an AI response", () => {
    const response = {
      assistantText: "Choose a budget.",
      nextUISelector: "budget",
      requirementUpdate: {
        durationDays: 4,
      },
    } satisfies ConversationalStepResponse

    const loadingState = createTripReducer(initialCreateTripState, {
      type: "aiRequestStarted",
      requirements: {
        ...initialCreateTripState.requirements,
        source: "Dhaka",
      },
      userMessage: "Start from Dhaka",
    })
    const nextState = createTripReducer(loadingState, {
      type: "aiRequestSucceeded",
      response,
    })

    expect(nextState.currentStep).toBe("budget")
    expect(nextState.requirements.durationDays).toBe(4)
    expect(nextState.isLoading).toBe(false)
  })

  test("requires all normalized fields before final generation", () => {
    expect(areRequirementsComplete(completeRequirements)).toBe(true)
    expect(getFinalItineraryRequirements(completeRequirements)).toEqual({
      source: "Dhaka",
      destination: "Tokyo",
      durationDays: 3,
      budgetTier: "mid-range",
      groupSize: 2,
      groupType: "couple",
    })
    expect(getStepFromSelector("final", completeRequirements)).toBe(
      "readyForFinal"
    )
  })
})
