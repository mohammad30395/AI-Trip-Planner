import { ConvexError } from "convex/values"

import type { MutationCtx } from "./_generated/server"
import { mutation } from "./_generated/server"

async function requireIdentity(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()

  if (identity === null) {
    throw new ConvexError("UNAUTHENTICATED")
  }

  return identity
}

export const upsertCurrentUserFromIdentity = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const now = Date.now()

    const existing = await ctx.db
      .query("users")
      .withIndex("by_identity_key", (q) =>
        q.eq("identityKey", identity.tokenIdentifier)
      )
      .unique()

    const userPatch = {
      clerkSubject: identity.subject,
      displayName: identity.name,
      updatedAt: now,
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
