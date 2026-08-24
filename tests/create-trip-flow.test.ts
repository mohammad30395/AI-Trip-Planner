import { describe, expect, test } from "vitest"

import type { ConversationalStepResponse } from "@/lib/ai/contract"
import { buildFallbackConversationResponse } from "@/lib/ai/conversation-fallback"
import {
  formatSaveTripMutationError,
  getConvexTokenReadinessError,
  getSaveTripReadinessError,
} from "@/lib/convex/save-trip-errors"
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

  test("builds deterministic conversation fallback selectors", () => {
    expect(buildFallbackConversationResponse({ source: "Dhaka" })).toMatchObject({
      nextUISelector: "destination",
    })
    expect(
      buildFallbackConversationResponse({
        source: "Dhaka",
        destination: "Tokyo",
        durationDays: 4,
        budgetTier: "mid-range",
        groupSize: 2,
        groupType: "couple",
      })
    ).toMatchObject({
      nextUISelector: "review",
    })
  })
})

describe("create-trip save error handling", () => {
  test("blocks save attempts until Convex auth is verified", () => {
    expect(
      getSaveTripReadinessError({
        isLoading: true,
        isAuthenticated: false,
      })
    ).toContain("Convex authentication is still loading")

    expect(
      getSaveTripReadinessError({
        isLoading: false,
        isAuthenticated: false,
      })
    ).toContain("Clerk sign-in succeeded, but Convex could not verify")

    expect(
      getSaveTripReadinessError({
        isLoading: false,
        isAuthenticated: true,
      })
    ).toBeNull()
  })

  test("classifies common Convex save failures into user-safe messages", () => {
    expect(
      formatSaveTripMutationError(new Error("ConvexError: UNAUTHENTICATED"))
    ).toContain("Convex could not verify")

    expect(
      formatSaveTripMutationError(
        new Error("Could not find public function trips:saveGeneratedTrip")
      )
    ).toContain("latest trip save function")

    expect(
      formatSaveTripMutationError(new Error("ArgumentValidationError"))
    ).toContain("database save contract")
  })

  test("classifies missing Clerk Convex token separately from Convex rejection", () => {
    expect(getConvexTokenReadinessError("available")).toBeNull()
    expect(getConvexTokenReadinessError("missing")).toContain(
      "could not issue the `convex` token"
    )
    expect(getConvexTokenReadinessError("unknown")).toContain(
      "Convex could not verify"
    )
  })
})
