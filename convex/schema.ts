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

export const tripPayloadValidator = v.object({
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
    budget: v.string(),
    groupSize: v.number(),
    generatedTripPayload: v.optional(tripPayloadValidator),
    enrichmentStatus: enrichmentStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner_created_at", ["ownerIdentityKey", "createdAt"]),
})
