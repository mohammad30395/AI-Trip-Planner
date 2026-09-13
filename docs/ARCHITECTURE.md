# Architecture

## Framework

The web app uses the current stable Next.js App Router with TypeScript and Tailwind CSS.

## Client Boundary

Client components may render forms, conversational UI, saved-trip views, and Leaflet maps.

Client-safe values:
- Clerk publishable key
- Convex public URL

Leaflet runs only inside client components and must clean up map instances on
unmount. No map API key is required for the selected Leaflet plus
OpenStreetMap-compatible tile setup.
The browser must call an internal place-enrichment route for place data. It must
never call Geoapify directly or receive the Geoapify API key.
Saved-trip presentation enriches hotel and activity cards through a client
hook that consumes only the normalized internal `PlaceEnrichment` contract.
The hook keeps a modest in-memory request cache keyed by normalized semantic
query context so repeated cards do not trigger duplicate lookups.

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

## Quota Boundary

Free final itinerary generation is enforced in `/api/ai-itinerary` before the
OpenRouter call unless Clerk Billing reports premium access. Ordinary page
loads, saved-trip reads, place enrichment, and Convex trip fetches are not rate
limited by this rule.

The shared non-secret quota policy lives in
`lib/quota/free-generation-quota.ts`. The server-only Arcjet adapter lives in
`lib/quota/trip-generation.ts`, reads `ARCJET_KEY` only on the server, and
identifies the requester with Clerk's server-verified stable `userId`.

The route authenticates the user, checks the Clerk Billing feature entitlement,
validates the final-generation request, then asks Arcjet to consume one token
for the intended final-generation attempt only when the user does not have
premium access. If Arcjet denies the request, the route returns a typed 429
response and no expensive AI call is made. The browser disables duplicate
final-generation submissions while one is pending and shows a quota message plus
a Pricing CTA when blocked.

Premium users bypass this free quota but do not bypass authentication,
validation, or OpenRouter response validation. No separate Arcjet bot/security
rules are configured yet; when added, they should run for both free and premium
users. Provider failures after the Arcjet decision may consume a free attempt;
this retry behavior is documented here so future billing/idempotency work can
adjust it deliberately.

## Billing Boundary

`/pricing` renders Clerk's user `PricingTable` component for Clerk-managed B2C
plans. Clerk owns checkout, subscription state, and account billing management.
This project does not integrate Stripe directly and does not duplicate
subscription truth into Convex.

The signed-in account menu uses Clerk's `UserButton`, whose Manage account
surface exposes Clerk-managed account features, including billing management
when Billing is enabled and the relevant user plans are public in Clerk.

Paid entitlement checks are enforced only at the AI final-generation server
boundary. The confirmed Clerk Billing feature key is
`unlimited_trip_generation`. The installed Clerk SDK autocompletes scoped
feature examples such as `user:*`, but the current B2C Billing docs and
dashboard use the configured feature slug directly for `has({ feature })`. The
route returns only a small Free/Premium access status to the browser and never
accepts client-supplied premium flags as authorization.

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
- canonical match metadata including `matchStatus`, `matchScore`, and
  `matchedQuery`

Geoapify Geocoding Search is the free-text semantic lookup provider. Geoapify
Place Details is optional after lookup and is used only as fallback-tolerant
enrichment, currently for `wiki_and_media.image` when available. Place Details
failure must not invalidate an otherwise valid geocoding result.
Geoapify geocoding results are requested as a small candidate set and ranked by
the server adapter before becoming canonical. Candidate acceptance is
conservative: requested name/address, destination city/country context, result
type, category, rank confidence, and geographic consistency are considered.
The first provider result is never automatically canonical. Saved AI place
names, addresses, and areas are lookup input only, not truth.
Only `verified` and `probable` matches become canonical; no-confident-match
results are valid lookup outcomes and are returned as empty lookups. Generic
activities such as local meals, check-in/freshen-up, free time, and travel
transfers are not canonicalized into arbitrary POIs. Provider-enriched place
IDs, addresses, and coordinates are canonical for maps only after this match
gate. AI/model-generated coordinates remain non-authoritative hints only.

Destination context is resolved first for destination-local hotel and POI
lookups. Trusted country code is used as a Geoapify country filter and as a
server-side rejection gate. Trusted destination coordinates are used as a
provider proximity bias; if Geoapify reports candidate distance, local POI
candidates beyond `LOCAL_POI_MAX_DISTANCE_METERS` are rejected. The current
120 km threshold allows destination-region attractions around a city such as
Sylhet while rejecting obviously distant cross-region or cross-continent
candidates before map construction.

## Map Boundary

Map code uses normalized Geoapify coordinates as its canonical input, then
renders them through a Leaflet client component with an OpenStreetMap-compatible
tile layer. The map builds a client-side list of enriched itinerary places,
skips places without accepted provider coordinates or an accepted match status,
deduplicates by `providerPlaceId`, and renders one project-owned `divIcon`
marker per unique place. Popups are built with DOM text nodes rather than
injected AI HTML.
Trip cards can focus the map, and marker clicks can focus/scroll the matching
card without using client-supplied authorization or raw provider payloads.
Downstream map code must consume provider-neutral place data and must never
depend on raw Geoapify JSON.

The application owns the base-map tile URL configuration. User input must never
be accepted as a tile URL or provider URL. Public OpenStreetMap standard tiles,
if selected, must follow the current OSM tile usage policy: visible attribution,
normal browser Referer behavior, caching according to response headers, no
bulk/preload/offline tile scraping, and no assumption that public OSM tiles are
an unlimited production CDN or SLA-backed service.

Provider URLs include the Geoapify key as a query parameter, so code must never
log complete Geoapify request URLs.
External provider images are optional UI enhancement only and must be validated
as HTTPS before rendering. Missing images keep stable placeholders.

## External Image Boundary

The application-level image contract is `ExternalImage`, which records only a
validated remote URL, source, `exact_place` or `representative` kind, alt text,
and optional attribution. Exact-place images may be shown only for accepted
canonical place matches. Destination covers use representative semantics even
when the image comes from a city-level provider match. Generic activities do
not receive fake canonical POI images.

Image files, base64 payloads, blobs, and downloaded image bytes must not be
stored in Convex. Current image enrichment remains on-demand through the
existing place-enrichment cache. Geoapify Place Details is checked first for
accepted canonical places. When Geoapify does not provide a valid image, the
provider-neutral resolver may use Wikimedia Commons as a URL-only secondary
provider for destination covers and accepted exact places, including hotels,
only when the strict exact-place title match gate accepts the media. Missing,
unsafe, ambiguous, or broken provider media falls back to the shared neutral
image frame.

Remote image URLs are validated before rendering. The current allowed host
family is limited to `upload.wikimedia.org` and `thumb.wikimedia.org`, the two
Wikimedia media hosts returned by the approved Commons image pipeline.
Wikimedia Commons source-page URLs may be stored as metadata only. Next Image
remote patterns must stay aligned with that validator and must not be widened
to arbitrary hosts. Do not scrape Google Images or browser search result HTML,
and do not let AI invent image URLs.

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
