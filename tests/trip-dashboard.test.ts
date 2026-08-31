import { describe, expect, test } from "vitest"

import {
  buildTripCardData,
  type StoredTripListItem,
} from "@/lib/trips/dashboard"

const baseTrip = {
  _id: "trip_123",
  source: "New York, USA",
  destination: "London, UK",
  durationDays: 4,
  budget: "mid-range",
  groupSize: 2,
  groupType: "couple",
  status: "saved",
  enrichmentStatus: "pending",
  createdAt: Date.UTC(2026, 7, 31),
} satisfies StoredTripListItem

describe("trip dashboard card data", () => {
  test("uses persisted trip id for the saved-trip href", () => {
    expect(buildTripCardData(baseTrip).href).toBe("/view-trip/trip_123")
  })

  test("formats duration with singular and plural grammar", () => {
    expect(buildTripCardData({ ...baseTrip, durationDays: 1 }).durationLabel).toBe(
      "1 Day"
    )
    expect(buildTripCardData({ ...baseTrip, durationDays: 2 }).durationLabel).toBe(
      "2 Days"
    )
  })

  test("reuses established budget presentation labels", () => {
    expect(buildTripCardData(baseTrip).budgetLabel).toBe("Mid-range")
  })
})
