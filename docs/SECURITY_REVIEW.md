# Security Review

Milestone: 28 - Security and Privacy Audit
Date: 2026-08-24

## Scope

Reviewed current source, docs, config, Convex functions, Next.js routes, AI and
provider adapters, map code, environment handling, and dependency audit output.
No secret values were read or printed.

## Findings and Fixes

### Fixed: Provider Image URL Contract

Geoapify optional image URLs were already HTTPS-checked before rendering, but
the normalized provider contract could still carry a non-HTTPS image URL.

Fix:
- `lib/places/geoapify.ts` now accepts only HTTPS image URLs from Geoapify
  Place Details.
- `lib/places/place-enrichment.ts` now validates response-envelope image URLs
  as HTTPS before accepting them into the normalized contract.

Impact:
- Missing or non-HTTPS provider images are treated as absent.
- Place lookup success is not invalidated by missing images.

## Verified Controls

- `.env*` files are ignored by `.gitignore`; no `.env*` files are tracked.
- Forbidden current place/map public variables are absent by name:
  `NEXT_PUBLIC_GEOAPIFY_API_KEY`, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`,
  `GOOGLE_PLACE_API_KEY`, and `NEXT_PUBLIC_GOOGLE_PLACE_API_KEY`.
- Server-only integrations read server variables only:
  `GEOAPIFY_API_KEY`, `OPEN_ROUTER_API_KEY`, `OPEN_ROUTER_MODEL`,
  `ARCJET_KEY`, and `CLERK_SECRET_KEY`.
- Clerk route protection is present on app routes and API routes that require
  authentication.
- Convex trip and user functions derive identity from
  `ctx.auth.getUserIdentity()` and do not authorize with client-provided
  `userId`, email, premium, subscription, or owner flags.
- Convex trip queries use owner-scoped indexes or explicit owner checks before
  returning data.
- `/api/ai-model` and `/api/ai-itinerary` validate request bodies and input
  lengths before provider calls.
- For free users, `/api/ai-itinerary` enforces Arcjet before OpenRouter final
  itinerary inference.
- Premium access is checked server-side through Clerk Billing `has({ feature })`
  and is never accepted from the client.
- Geoapify URLs are constructed from server-owned constants and user input is
  only used as encoded query text/context, not as a provider URL.
- Complete Geoapify provider URLs are not logged.
- Leaflet uses an application-controlled HTTPS OpenStreetMap tile URL constant;
  users, AI output, and trip data cannot supply tile URLs.
- OpenStreetMap attribution remains visible through Leaflet attribution and
  place-data attribution remains rendered in trip presentation.
- Leaflet popup content is built with DOM text nodes. No AI HTML is passed to
  `bindPopup` or `setContent`.
- No active `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or dynamic function
  construction was found in app code.
- `npm audit --audit-level=moderate` reported 0 vulnerabilities.

## OpenStreetMap Tile Policy Notes

The current OSM tile policy for `tile.openstreetmap.org` requires the exact
HTTPS tile URL, visible attribution, valid browser Referer behavior, and normal
caching. It prohibits bulk downloading, prefetch/offline tile scraping, and
HTTP tile URLs. OSM standard tiles are best-effort with no SLA and should not be
treated as an unlimited production CDN.

Current implementation matches the development/modest-use requirements:
- `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- visible `OpenStreetMap contributors` attribution
- no app-owned tile proxy or arbitrary tile URL input

## Remaining Risks

- Historical progress notes record that an OpenRouter key was accidentally
  printed during Milestone 13. If that key has not already been rotated, rotate
  it in OpenRouter and replace it in `.env.local` and deployment environments.
- Authenticated browser testing is still needed for Clerk sessions, Convex
  owner isolation, premium entitlement behavior, Arcjet exhaustion, Geoapify
  provider errors, and Leaflet tile failures.
- Public OSM standard tiles are suitable for development and modest use only.
  Before production launch, evaluate traffic and use an appropriate OSM-derived
  tile provider or self-hosted tiles if needed.
- No separate Arcjet bot/security rule currently protects premium users. The
  current quota rule correctly gates free final-generation attempts; future
  abuse controls should run for both free and premium users.
