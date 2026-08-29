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

  test("failed final generation preserves the confirmed brief", () => {
    const readyState = {
      ...initialCreateTripState,
      requirements: completeRequirements,
      currentStep: "readyForFinal",
    } as const
    const generatingState = createTripReducer(readyState, {
      type: "finalGenerationStarted",
    })
    const failedState = createTripReducer(generatingState, {
      type: "finalGenerationFailed",
      error: "Itinerary generation unavailable.",
    })

    expect(failedState.currentStep).toBe("readyForFinal")
    expect(failedState.requirements).toEqual(completeRequirements)
    expect(failedState.finalItinerary).toBeNull()
    expect(failedState.finalError).toBe("Itinerary generation unavailable.")
  })

  test("retrying final generation does not rerun interview state", () => {
    const failedState = createTripReducer(
      {
        ...initialCreateTripState,
        requirements: completeRequirements,
        currentStep: "readyForFinal",
        finalError: "Itinerary generation unavailable.",
      },
      {
        type: "finalGenerationStarted",
      }
    )

    expect(failedState.currentStep).toBe("readyForFinal")
    expect(failedState.requirements).toEqual(completeRequirements)
    expect(failedState.messages).toEqual(initialCreateTripState.messages)
    expect(failedState.finalError).toBeNull()
    expect(failedState.isGeneratingFinal).toBe(true)
  })

  test("successful final generation remains available to the save flow", () => {
    const succeededState = createTripReducer(
      {
        ...initialCreateTripState,
        requirements: completeRequirements,
        currentStep: "readyForFinal",
      },
      {
        type: "finalGenerationSucceeded",
        itinerary: {
          travelPlan: {
            source: "Dhaka",
            destination: "Tokyo",
            durationDays: 3,
            budgetTier: "mid-range",
            groupSize: 2,
            groupType: "couple",
          },
          summary: "Generated summary.",
          hotels: [],
          itinerary: [
            {
              dayNumber: 1,
              title: "Arrival",
              activities: [
                {
                  title: "Free time",
                  description: "Rest after arrival.",
                  timeWindow: "Evening",
                  estimatedPriceText: "Generated estimate.",
                  place: {
                    kind: "generic_activity",
                    name: null,
                    addressHint: null,
                    areaHint: null,
                    originHint: null,
                    destinationHint: null,
                  },
                },
              ],
            },
            {
              dayNumber: 2,
              title: "Explore",
              activities: [
                {
                  title: "Visit Tokyo Tower",
                  description: "Visit Tokyo Tower.",
                  timeWindow: "Morning",
                  estimatedPriceText: "Generated estimate.",
                  place: {
                    kind: "specific_place",
                    name: "Tokyo Tower",
                    addressHint: null,
                    areaHint: "Minato City",
                    originHint: null,
                    destinationHint: null,
                  },
                },
              ],
            },
            {
              dayNumber: 3,
              title: "Departure",
              activities: [
                {
                  title: "Train to airport",
                  description: "Travel to the airport.",
                  timeWindow: "Morning",
                  estimatedPriceText: "Generated estimate.",
                  place: {
                    kind: "transport",
                    name: null,
                    addressHint: null,
                    areaHint: null,
                    originHint: "Tokyo",
                    destinationHint: "Airport",
                  },
                },
              ],
            },
          ],
        },
        access: {
          tier: "free",
          quotaEnforced: true,
        },
      }
    )

    expect(succeededState.finalItinerary?.travelPlan.destination).toBe("Tokyo")
    expect(succeededState.saveError).toBeNull()
    expect(succeededState.savedTripId).toBeNull()
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
