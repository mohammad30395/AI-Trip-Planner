# Architecture

## Framework

The web app uses the current stable Next.js App Router with TypeScript and Tailwind CSS.

## Client Boundary

Client components may render forms, conversational UI, saved-trip views, and Mapbox GL JS maps.

Client-safe values:
- Clerk publishable key
- Convex public URL
- Mapbox public access token

Mapbox runs client-side and must clean up map instances on unmount.
The browser must call an internal place-enrichment route for place data. It must
never call Geoapify directly or receive the Geoapify API key.

## Server Boundary

Secrets and paid or expensive operations stay server-only.

Server-only responsibilities:
- Clerk secret-key operations
- Clerk Billing entitlement checks
- Convex mutations and queries that require verified identity
- Arcjet quota/rate-limit checks
- OpenRouter AI calls
- Geoapify place-enrichment calls
- Structured itinerary validation before persistence

AI, Geoapify, and Arcjet logic must not run in client components.

## OpenRouter Server Boundary

OpenRouter is configured only in `lib/ai/openrouter.ts`, which imports
`server-only` and must never be imported by a client component.

The temporary `/api/openrouter-smoke` route is protected by Clerk before it can
perform provider work. It validates `OPEN_ROUTER_API_KEY` and
`OPEN_ROUTER_MODEL` on the server, uses the OpenAI SDK compatible OpenRouter
endpoint, requests strict JSON Schema structured output, applies a timeout, and
returns only sanitized success or failure metadata to the browser. Structured
output smoke calls request OpenRouter provider routing with required parameter
support so the request is not sent to endpoints that cannot honor JSON Schema
output.

The `/api/ai-model` route is the authenticated server boundary for the
conversation interviewer. It accepts compact conversation messages and normalized
requirements, validates them before any provider call, and returns only the
strict conversational schema. The client validates the response envelope again
before choosing a pre-built UI component. Final itinerary generation remains
disconnected; a complete brief transitions only to `READY_FOR_FINAL`.

The `/api/ai-itinerary` route is the authenticated server boundary for final
itinerary generation. It accepts complete normalized requirements only, requests
the strict final itinerary schema, validates the model response server-side, and
rejects mismatched itinerary day counts. Generated prices and place details are
not verified facts until later Geoapify enrichment.

## Place Enrichment Boundary

Place enrichment uses the internal server route
`app/api/place-enrichment/route.ts`. That route is protected by Clerk, reads
`GEOAPIFY_API_KEY` only on the server, and calls the server-only adapter in
`lib/places/geoapify.ts`. The browser calls the internal route and receives
normalized provider-neutral place data, never raw Geoapify JSON and never the
API key.

The normalized contract for enriched places should support:
- `provider`
- `providerPlaceId`
- `displayName`
- `formattedAddress`
- `location` with `lat` and `lng`
- optional `image`
- attribution metadata

Geoapify Geocoding Search is the free-text semantic lookup provider. Geoapify
Place Details is optional after lookup and is used only as fallback-tolerant
enrichment, currently for `wiki_and_media.image` when available. Place Details
failure must not invalidate an otherwise valid geocoding result.
Provider-enriched place IDs, addresses, and coordinates are canonical for maps.
AI/model-generated coordinates remain non-authoritative hints only. Mapbox stays
client-side and consumes normalized place data instead of raw provider payloads.

Provider URLs include the Geoapify key as a query parameter, so code must never
log complete Geoapify request URLs.

## AI Contract Boundary

Model responses must pass through the shared contract in `lib/ai/contract.ts`
before they update UI state or persistence.

The contract has two response classes:
- Conversational step response: assistant text, the next Generative UI selector,
  and optional normalized requirement updates for source, destination, duration,
  budget tier, group size, and group type.
- Final itinerary response: `travelPlan`, summary, hotel recommendations, and
  day-by-day itinerary activities with generated estimate text.

The JSON Schemas are strict and use `additionalProperties: false` for object
shapes. Runtime parsers accept `unknown` data and return typed data or a clear
validation error.

AI output may include place names, addresses, and approximate area hints. It must
not provide canonical `providerPlaceId`, latitude/longitude, provider image, or
map data. Provider enrichment is the later authoritative source for place IDs,
canonical coordinates, optional images, and attribution metadata.

## Persistence

Convex is the persistent backend for users, saved trips, itinerary records, quota records, and enriched place references.

Convex authorization must be based on verified server identity from Clerk/Convex auth configuration. A client-supplied `userId` is never sufficient for authorization.
