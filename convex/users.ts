import { ConvexError } from "convex/values"
import { v } from "convex/values"

import type { MutationCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"

async function requireIdentity(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()

  if (identity === null) {
    throw new ConvexError("UNAUTHENTICATED")
  }

  return identity
}

function normalizeDisplayName(displayName: string | undefined) {
  const normalized = displayName?.trim()

  if (!normalized) {
    return undefined
  }

  return normalized.slice(0, 120)
}

export const upsertCurrentUserFromIdentity = mutation({
  args: {
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const now = Date.now()
    const displayName = normalizeDisplayName(args.displayName ?? identity.name)

    const existing = await ctx.db
      .query("users")
      .withIndex("by_identity_key", (q) =>
        q.eq("identityKey", identity.tokenIdentifier)
      )
      .unique()

    const userPatch = {
      clerkSubject: identity.subject,
      updatedAt: now,
      ...(displayName !== undefined ? { displayName } : {}),
    }

    if (existing !== null) {
      await ctx.db.patch(existing._id, userPatch)
      return existing._id
    }

    return await ctx.db.insert("users", {
      identityKey: identity.tokenIdentifier,
      ...userPatch,
      createdAt: now,
    })
  },
})

export const getCurrentUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()

    if (identity === null) {
      throw new ConvexError("UNAUTHENTICATED")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_identity_key", (q) =>
        q.eq("identityKey", identity.tokenIdentifier)
      )
      .unique()

    if (user === null) {
      return null
    }

    return {
      _id: user._id,
      displayName: user.displayName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  },
})
