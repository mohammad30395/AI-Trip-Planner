# Environment

Variable names only. Never commit or print values.

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Client-safe | Clerk browser initialization |
| `CLERK_SECRET_KEY` | Server-only | Clerk server operations |
| `NEXT_PUBLIC_CONVEX_URL` | Client-safe | Convex client URL |
| `CONVEX_DEPLOYMENT` | Server-only | Generated Convex deployment identifier, if present |
| `CLERK_JWT_ISSUER_DOMAIN` | Server-only | Convex auth configuration for Clerk JWT issuer |
| `ARCJET_KEY` | Server-only | Arcjet protection and quota checks |
| `OPEN_ROUTER_API_KEY` | Server-only | OpenRouter server calls |
| `OPEN_ROUTER_MODEL` | Server-only | Server-selected OpenRouter model |
| `GOOGLE_PLACE_API_KEY` | Server-only | Google Places API (New) server calls |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Client-safe | Mapbox GL JS browser maps |
