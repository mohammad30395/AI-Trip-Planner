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

## Server Boundary

Secrets and paid or expensive operations stay server-only.

Server-only responsibilities:
- Clerk secret-key operations
- Clerk Billing entitlement checks
- Convex mutations and queries that require verified identity
- Arcjet quota/rate-limit checks
- OpenRouter AI calls
- Google Places API (New) calls
- Structured itinerary validation before persistence

AI, Google Places, and Arcjet logic must not run in client components.

## Persistence

Convex is the persistent backend for users, saved trips, itinerary records, quota records, and enriched place references.

Convex authorization must be based on verified server identity from Clerk/Convex auth configuration. A client-supplied `userId` is never sufficient for authorization.
