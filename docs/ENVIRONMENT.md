# Environment

Variable names only. Never commit or print values.

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Client-safe | Clerk browser initialization |
| `CLERK_SECRET_KEY` | Server-only | Clerk server operations |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Client-safe | Clerk custom sign-in route |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Client-safe | Clerk custom sign-up route |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Client-safe | Clerk post sign-in fallback redirect |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Client-safe | Clerk post sign-up fallback redirect |
| `NEXT_PUBLIC_CONVEX_URL` | Client-safe | Convex client URL |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Client-safe | Convex HTTP actions URL, if generated |
| `CONVEX_DEPLOYMENT` | Server-only | Generated Convex deployment identifier, if present |
| `CLERK_JWT_ISSUER_DOMAIN` | Server-only | Convex auth configuration for Clerk JWT issuer |
| `ARCJET_KEY` | Server-only | Arcjet protection and quota checks |
| `OPEN_ROUTER_API_KEY` | Server-only | OpenRouter server calls |
| `OPEN_ROUTER_MODEL` | Server-only | Server-selected OpenRouter model |
| `GEOAPIFY_API_KEY` | Server-only | Geoapify place-enrichment server calls |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Client-safe | Mapbox GL JS browser maps |

Do not create or use `NEXT_PUBLIC_GEOAPIFY_API_KEY`. Geoapify calls must go
through a server route so the provider key is never exposed to the browser.
