# Production Deployment Checklist

Milestone 31 prepares the repository for deployment but does not deploy it.

## Runtime

- Use Node.js `24.x` and npm `11.x` for Vercel builds/functions.
- Next.js 16 requires Node.js 20.9 or newer; this project targets Node 24 because the installed Arcjet package also requires Node 24.5+ or a very recent Node 22.
- Do not copy `.env.local` to production. Configure environment variables in the Vercel and Convex dashboards.

## Vercel Build Settings

Use the Vercel project root that contains this `package.json`.

Set the Vercel Build Command to:

```bash
npm run build:vercel
```

The script runs:

```bash
convex deploy --cmd "npm run build" --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL
```

This follows the current Convex Vercel deployment pattern while explicitly matching the public Convex URL variable used by the Next.js client.

Do not deploy during Milestone 31. Deployment happens in Milestone 32.

## Vercel Environment Variables

Client-safe:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
- `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`
- `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL`
- `NEXT_PUBLIC_CONVEX_URL` generated for the build by `convex deploy`

Server-only:

- `CLERK_SECRET_KEY`
- `ARCJET_KEY`
- `OPEN_ROUTER_API_KEY`
- `OPEN_ROUTER_MODEL`
- `GEOAPIFY_API_KEY`

Build/CI-only:

- `CONVEX_DEPLOY_KEY`

Not required and must not be added:

- `NEXT_PUBLIC_GEOAPIFY_API_KEY`
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
- `GOOGLE_PLACE_API_KEY`
- `NEXT_PUBLIC_GOOGLE_PLACE_API_KEY`

## Convex Dashboard Variables

Server-only deployment environment:

- `CLERK_JWT_ISSUER_DOMAIN`

Use the production Clerk issuer domain. Do not reuse development Clerk issuer values in production.

## Account And Domain Checklist

- Vercel: create the project from this repository but do not deploy until Milestone 32.
- Vercel: set Node.js version to `24.x` if the dashboard does not already use it.
- Vercel: set Build Command to `npm run build:vercel`.
- Convex: create or select the production deployment.
- Convex: generate a Production Deploy Key with deployment deploy permission and set it in Vercel as `CONVEX_DEPLOY_KEY`.
- Convex: set `CLERK_JWT_ISSUER_DOMAIN` in the production Convex deployment environment.
- Clerk: use production instance keys for Vercel production variables.
- Clerk: configure allowed origins and redirect URLs for the final production domain. Do not hardcode localhost.
- Clerk + Convex auth: use a custom production domain if required by the Clerk/Convex production auth configuration. Do not rely on localhost or development-only domains.
- Clerk Billing: confirm the Pro plan is public and the feature key is exactly `unlimited_trip_generation`.
- OpenRouter: use a production API key and model value appropriate for structured JSON Schema output.
- Arcjet: use a production site/key and confirm the one-generation-per-day free quota behavior.
- Geoapify: use a separate production key or project where possible. Keep the key server-only, monitor usage, rotate if exposed, and configure restrictions available in Geoapify MyProjects such as allowed IP addresses, HTTP referrers, origins, or CORS where they match the server-side deployment model.

## Map And Attribution

- There is no Mapbox account, token, or payment prerequisite.
- Leaflet is a local client dependency.
- The configured tile URL is `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
- OpenStreetMap attribution must remain visible and unobscured on the map.
- Browser tile requests should send normal Referer behavior, honor browser caching, and must not prefetch, bulk download, proxy, or scrape OSM public tiles.
- Public OSM standard tiles are best-effort and have no SLA. If expected production traffic may exceed modest interactive use, choose a compliant OSM-derived tile provider or self-hosted tile setup before launch.

## Post-Deploy Smoke Checklist

- Landing page loads.
- Sign-up and sign-in work from the production domain.
- Signed-out protected routes redirect to sign-in.
- Free user can complete one final trip generation.
- A generated trip can be saved once.
- Saved trip redirects to `/view-trip/[tripId]`.
- `/my-trips` lists the saved trip for the owner only.
- Geoapify enrichment resolves at least one hotel or activity.
- Missing Geoapify images show stable placeholders.
- Leaflet map renders with verified markers when enrichment coordinates exist.
- OpenStreetMap attribution remains visible on mobile and desktop.
- Pricing page renders Clerk Billing plans.
- Pro user with `unlimited_trip_generation` bypasses the free quota.
