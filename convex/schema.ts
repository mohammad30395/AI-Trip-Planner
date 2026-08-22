import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export const tripStatusValidator = v.union(
  v.literal("draft"),
  v.literal("generating"),
  v.literal("complete"),
  v.literal("failed")
)

export const enrichmentStatusValidator = v.union(
  v.literal("not_started"),
  v.literal("pending"),
  v.literal("enriched"),
  v.literal("failed")
)

export const budgetTierValidator = v.union(
  v.literal("budget"),
  v.literal("mid-range"),
  v.literal("premium")
)

export const groupTypeValidator = v.union(
  v.literal("solo"),
  v.literal("couple"),
  v.literal("family"),
  v.literal("friends"),
  v.literal("business")
)

export const timeOfDayValidator = v.union(
  v.literal("morning"),
  v.literal("afternoon"),
  v.literal("evening"),
  v.literal("night"),
  v.literal("flexible")
)

export const placeTextHintValidator = v.object({
  placeName: v.string(),
  address: v.optional(v.string()),
  approximateArea: v.optional(v.string()),
})

export const itineraryActivityValidator = v.object({
  title: v.string(),
  description: v.string(),
  timeOfDay: v.optional(timeOfDayValidator),
  timeWindow: v.string(),
  duration: v.optional(v.string()),
  estimatedPriceText: v.string(),
  place: v.optional(placeTextHintValidator),
})

export const itineraryDayValidator = v.object({
  dayNumber: v.number(),
  title: v.string(),
  activities: v.array(itineraryActivityValidator),
})

export const hotelRecommendationValidator = v.object({
  name: v.string(),
  description: v.string(),
  area: v.optional(v.string()),
  address: v.optional(v.string()),
  priceTier: v.optional(budgetTierValidator),
  estimatedPriceText: v.string(),
})

export const tripPayloadValidator = v.object({
  travelPlan: v.object({
    source: v.string(),
    destination: v.string(),
    durationDays: v.number(),
    budgetTier: budgetTierValidator,
    groupSize: v.number(),
    groupType: v.optional(groupTypeValidator),
  }),
  summary: v.string(),
  hotels: v.array(hotelRecommendationValidator),
  itinerary: v.array(itineraryDayValidator),
  practicalNotes: v.optional(v.array(v.string())),
})

const legacyBudgetValidator = v.union(
  budgetTierValidator,
  v.literal("moderate"),
  v.literal("comfort")
)

const legacyTripPayloadValidator = v.object({
  schemaVersion: v.literal(1),
  summary: v.optional(v.string()),
  days: v.array(
    v.object({
      dayNumber: v.number(),
      title: v.string(),
      activities: v.array(
        v.object({
          title: v.string(),
          description: v.optional(v.string()),
          placeName: v.optional(v.string()),
        })
      ),
    })
  ),
  notes: v.optional(v.array(v.string())),
})

const storedTripPayloadValidator = v.union(
  tripPayloadValidator,
  legacyTripPayloadValidator
)

export default defineSchema({
  users: defineTable({
    identityKey: v.string(),
    clerkSubject: v.string(),
    displayName: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_identity_key", ["identityKey"]),

  trips: defineTable({
    ownerIdentityKey: v.string(),
    status: tripStatusValidator,
    source: v.string(),
    destination: v.string(),
    durationDays: v.number(),
    budget: legacyBudgetValidator,
    groupSize: v.number(),
    groupType: v.optional(groupTypeValidator),
    generatedTripPayload: v.optional(storedTripPayloadValidator),
    enrichmentStatus: enrichmentStatusValidator,
    saveRequestKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_created_at", ["ownerIdentityKey", "createdAt"])
    .index("by_owner_save_request", ["ownerIdentityKey", "saveRequestKey"]),
})
