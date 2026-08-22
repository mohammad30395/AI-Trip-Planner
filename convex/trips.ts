import { ConvexError, v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import {
  enrichmentStatusValidator,
  tripPayloadValidator,
  tripStatusValidator,
} from "./schema"

type AuthCtx = QueryCtx | MutationCtx

async function requireOwnerIdentityKey(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity()

  if (identity === null) {
    throw new ConvexError("UNAUTHENTICATED")
  }

  return identity.tokenIdentifier
}

async function getOwnedTripOrThrow(ctx: AuthCtx, tripId: Id<"trips">) {
  const ownerIdentityKey = await requireOwnerIdentityKey(ctx)
  const trip = await ctx.db.get(tripId)

  if (trip === null) {
    throw new ConvexError("TRIP_NOT_FOUND")
  }

  if (trip.ownerIdentityKey !== ownerIdentityKey) {
    throw new ConvexError("UNAUTHORIZED")
  }

  return trip
}

function toClientTrip(trip: Doc<"trips">) {
  return {
    _id: trip._id,
    _creationTime: trip._creationTime,
    status: trip.status,
    source: trip.source,
    destination: trip.destination,
    durationDays: trip.durationDays,
    budget: trip.budget,
    groupSize: trip.groupSize,
    generatedTripPayload: trip.generatedTripPayload,
    enrichmentStatus: trip.enrichmentStatus,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  }
}

const tripInputArgs = {
  source: v.string(),
  destination: v.string(),
  durationDays: v.number(),
  budget: v.string(),
  groupSize: v.number(),
}

export const createTrip = mutation({
  args: {
    ...tripInputArgs,
    status: v.optional(tripStatusValidator),
    generatedTripPayload: v.optional(tripPayloadValidator),
    enrichmentStatus: v.optional(enrichmentStatusValidator),
  },
  handler: async (ctx, args) => {
    const ownerIdentityKey = await requireOwnerIdentityKey(ctx)
    const now = Date.now()

    return await ctx.db.insert("trips", {
      ownerIdentityKey,
      status: args.status ?? "draft",
      source: args.source,
      destination: args.destination,
      durationDays: args.durationDays,
      budget: args.budget,
      groupSize: args.groupSize,
      generatedTripPayload: args.generatedTripPayload,
      enrichmentStatus: args.enrichmentStatus ?? "not_started",
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const saveTrip = mutation({
  args: {
    tripId: v.id("trips"),
    status: v.optional(tripStatusValidator),
    generatedTripPayload: v.optional(tripPayloadValidator),
    enrichmentStatus: v.optional(enrichmentStatusValidator),
  },
  handler: async (ctx, args) => {
    await getOwnedTripOrThrow(ctx, args.tripId)

    const patch: {
      status?: Doc<"trips">["status"]
      generatedTripPayload?: Doc<"trips">["generatedTripPayload"]
      enrichmentStatus?: Doc<"trips">["enrichmentStatus"]
      updatedAt: number
    } = {
      updatedAt: Date.now(),
    }

    if (args.status !== undefined) {
      patch.status = args.status
    }
    if (args.generatedTripPayload !== undefined) {
      patch.generatedTripPayload = args.generatedTripPayload
    }
    if (args.enrichmentStatus !== undefined) {
      patch.enrichmentStatus = args.enrichmentStatus
    }

    await ctx.db.patch(args.tripId, patch)

    return args.tripId
  },
})

export const listCurrentUserTrips = query({
  args: {},
  handler: async (ctx) => {
    const ownerIdentityKey = await requireOwnerIdentityKey(ctx)

    const trips = await ctx.db
      .query("trips")
      .withIndex("by_owner_created_at", (q) =>
        q.eq("ownerIdentityKey", ownerIdentityKey)
      )
      .order("desc")
      .collect()

    return trips.map(toClientTrip)
  },
})

export const getCurrentUserTrip = query({
  args: {
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    const trip = await getOwnedTripOrThrow(ctx, args.tripId)

    return toClientTrip(trip)
  },
})
