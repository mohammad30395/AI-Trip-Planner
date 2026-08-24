# Decisions

## 2026 Technical Decisions

- Use the current stable Next.js App Router rather than pinning to tutorial-era framework versions.
- Use `proxy.ts` for request interception on Next.js 16+. Use `middleware.ts` only if the installed framework version requires it.
- Use Clerk for authentication and billing.
- Convex authentication must use verified server identity. Never authorize with a client-supplied `userId`.
- Use Convex document IDs as trip identifiers until a public slug requirement is introduced.
- Store trip ownership with the Convex-authenticated identity key derived on the server, never with a client-supplied owner field.
- Keep Convex user profiles minimal for app display/state. Clerk remains the source of truth for authentication and billing.
- Use a Generative UI mapping where model/data output selects from pre-built typed React components; model output must never generate JSX.
- Define AI response contracts in shared TypeScript plus strict JSON Schemas before any model call is connected.
- Parse unknown model output through dependency-free guards that return typed data or explicit validation errors.
- Call OpenRouter only from a server route through the OpenAI SDK compatible endpoint.
- Prefer strict JSON Schema structured output when the selected model and endpoint support it.
- Use the official OpenRouter OpenAI-compatible base URL in a server-only client module.
- Protect temporary AI smoke routes with Clerk before provider work begins.
- Treat OpenRouter provider errors as server diagnostics only; browser responses must not include raw provider errors, headers, request IDs, or key material.
- Apply explicit timeout/abort handling to OpenRouter calls before wiring product flows.
- Use `/api/ai-model` as the authenticated AI conversation boundary. The client sends compact context only, never secrets or authorization identifiers.
- Use `/api/ai-itinerary` as the distinct authenticated final-generation boundary so conversational and itinerary schemas cannot be confused.
- Store generated final itineraries in client state only until the Convex persistence milestone.
- Treat model-generated prices, place details, ratings, business availability, and coordinates as unverified; UI price labels must say they are generated estimates.
- Call Geoapify only from the server through an internal place-enrichment route.
- Use Geoapify Geocoding Search for free-text semantic place lookup.
- Use the provider-neutral route `app/api/place-enrichment/route.ts` for place lookups.
- Geoapify Place Details may be used after lookup for optional additional details or images, and Place Details failures must fall back to the base geocoding result.
- Treat provider-enriched `providerPlaceId`, formatted address, and coordinates as canonical for maps.
- Do not trust model-generated coordinates as canonical.
- Keep place images optional and provide placeholder fallbacks when provider images are absent.
- Render provider images only after HTTPS URL validation.
- Respect Geoapify free-plan limits and OpenStreetMap attribution requirements.
- Never log full Geoapify request URLs because the API key is a provider query parameter.
- Keep place enrichment in memory/UI-only for now. Do not change Convex schema until map or persistence requirements make persisted canonical place data necessary.
- Run Arcjet before expensive AI work to enforce free quota and abuse controls.
- The free tier default is one successful trip generation per rolling/day policy documented in one config.
- Store the free generation quota policy in `lib/quota/free-generation-quota.ts`
  so UI copy and server enforcement share one source.
- Enforce Arcjet only on `/api/ai-itinerary`, after request validation and
  before OpenRouter inference. Page loads, saved-trip reads, and place
  enrichment are not part of this quota.
- Track Arcjet quota by Clerk's server-verified stable `userId`, not by client
  input or email.
- Consume one token for each valid final-generation attempt. Duplicate client
  submissions are disabled, but provider failures after the Arcjet decision may
  still consume the attempt until a future billing/idempotency policy changes
  that explicitly.
- Paid Clerk Billing entitlement bypasses the free generation quota at the
  final-generation server boundary.
- Use Clerk's server-side `has({ feature })` authorization check with the
  confirmed dashboard feature key `unlimited_trip_generation`.
- The installed Clerk SDK's type hints include scoped examples such as
  `user:*`, but current Clerk B2C Billing documentation checks feature access
  with the configured dashboard feature slug directly.
- Never accept `isPremium`, plan names, subscription flags, or entitlement
  claims from the client as authorization.
- Render `/pricing` with Clerk's current `PricingTable` for user plans because
  this product bills individual trip-planning users rather than organizations.
- Clerk Billing owns checkout and subscription management; do not integrate
  Stripe directly for this project.
- Do not store subscription status in Convex as security truth. Clerk remains
  the billing authority.
- Do not expose Clerk billing internals to the browser. The final-generation
  route returns only a small Free/Premium access status for UI display.
- Run Leaflet client-side and clean up map instances on unmount.
- Feed Leaflet provider-neutral normalized place data, not raw Geoapify JSON.
- Configure base-map tile URLs in application code/configuration; never accept a
  tile URL from user input.
- Keep `/pricing` public so unauthenticated visitors can review access options before signing in. Enforce paid entitlement checks later at billing-protected server/data boundaries, not by hiding the pricing page.

## 2026 Place Provider Deviation

- Original provider in the prompt pack: Google Places API (New).
- Replacement provider for this build: Geoapify.
- Reason: the Google Cloud billing/payment prerequisite is unavailable for this project.
- The current architecture must not pretend Geoapify is Google Places.
- `GEOAPIFY_API_KEY` is server-only. Do not create or use `NEXT_PUBLIC_GEOAPIFY_API_KEY`.
- AI coordinates remain hints only; provider-enriched coordinates are canonical for map rendering.

## 2026 Map Provider Deviation

- Original map provider in the prompt pack: Mapbox GL JS with a public Mapbox token and future 3D/globe-style map assumptions.
- Replacement map approach for this build: Leaflet client components with an OpenStreetMap-compatible tile layer.
- Reason: the Mapbox payment-method onboarding prerequisite is unavailable for this project.
- The product changes from a planned 3D globe/map experience to a stable 2D interactive map unless a later approved provider is added.
- No `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, Leaflet secret, or OpenStreetMap secret is required for the selected setup.
- Geoapify remains the server-side source for canonical `providerPlaceId`, formatted address, and coordinates used by maps.
- AI coordinates remain hints only and must not be displayed as verified map coordinates.
- Leaflet map code must consume normalized provider-neutral place data, then render markers and popups; it must not depend on raw Geoapify JSON.
- Public `tile.openstreetmap.org` standard tiles are not an unlimited production CDN or SLA-backed service. Any use must follow the current OSM tile usage policy, including visible OpenStreetMap attribution, valid web Referer behavior, caching, and no bulk download, preload, or offline tile scraping.
