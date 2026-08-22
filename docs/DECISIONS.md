# Decisions

## 2026 Technical Decisions

- Use the current stable Next.js App Router rather than pinning to tutorial-era framework versions.
- Use `proxy.ts` for request interception on Next.js 16+. Use `middleware.ts` only if the installed framework version requires it.
- Use Clerk for authentication and billing.
- Convex authentication must use verified server identity. Never authorize with a client-supplied `userId`.
- Use Convex document IDs as trip identifiers until a public slug requirement is introduced.
- Store trip ownership with the Convex-authenticated identity key derived on the server, never with a client-supplied owner field.
- Keep Convex user profiles minimal for app display/state. Clerk remains the source of truth for authentication and billing.
- Call OpenRouter only from a server route through the OpenAI SDK compatible endpoint.
- Prefer strict JSON Schema structured output when the selected model and endpoint support it.
- Call Google Places API (New) server-side.
- Treat Google Places API (New) as authoritative for place IDs, canonical coordinates, and photos.
- Do not trust model-generated coordinates as canonical.
- Run Arcjet before expensive AI work to enforce free quota and abuse controls.
- The free tier default is one successful trip generation per rolling/day policy documented in one config.
- Paid Clerk Billing entitlement bypasses the free quota.
- Run Mapbox client-side and clean up map instances on unmount.
- Keep `/pricing` public so unauthenticated visitors can review access options before signing in. Enforce paid entitlement checks later at billing-protected server/data boundaries, not by hiding the pricing page.
