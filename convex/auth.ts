import { query } from "./_generated/server"

export const whoAmI = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()

    if (identity === null) {
      return null
    }

    return {
      isAuthenticated: true,
      emailVerified: identity.emailVerified === true,
      hasIssuer: identity.issuer.length > 0,
      hasSubject: identity.subject.length > 0,
    }
  },
})
