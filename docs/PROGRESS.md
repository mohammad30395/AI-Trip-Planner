# Progress

## Milestone Checklist

- [x] Milestone 00 - Read-only preflight
- [x] Milestone 01 - Next.js scaffold
- [x] Milestone 02 - Project governance and source of truth
- [x] Milestone 03 - UI foundation
- [x] Milestone 04 - Landing page
- [x] Milestone 05 - Route skeletons
- [x] Milestone 06 - Clerk authentication
- [x] Milestone 07 - Convex + Clerk auth bridge
- [x] Milestone 08 - Database schema and authorization
- [x] Milestone 09 - User profile sync
- [x] Milestone 10 - Create trip UI shell
- [x] Milestone 11 - Generative UI component mapping
- [x] Milestone 12 - AI contract and schema
- [x] Milestone 13 - OpenRouter server client
- [x] Milestone 14 - AI-driven conversation
- [x] Milestone 15 - AI itinerary generation
- [x] Milestone 16 - Save trip
- [x] Milestone 17 - View trip data page
- [x] Milestone 18 - Trip presentation components
- [x] Milestone 19 - My trips
- [x] Milestone 19A - Place provider migration: Google Places to Geoapify
- [x] Revised Prompt 20 - Geoapify server place adapter
- [x] Milestone 21 - Place enrichment in the UI
- [x] Milestone 22 - Arcjet rate limiting
- [x] Milestone 23 - Clerk Billing UI
- [x] Milestone 24 - Clerk Billing paid access
- [x] Milestone 24A - Map provider migration: Mapbox to Leaflet + OpenStreetMap
- [x] Milestone 25 - Leaflet interactive map
- [x] Milestone 26 - Leaflet markers and interaction
- [x] Milestone 27 - UX resilience
- [x] Milestone 28 - Security and privacy audit
- [x] Milestone 29 - Automated tests
- [x] Post-build Fix - Canonical place matching
- [ ] Milestone 30 - Production readiness and Vercel deployment

## Post-build Fix - Canonical Place Matching

Changed:
- Added safe match metadata to the normalized place-enrichment contract:
  `matchStatus`, `matchScore`, and `matchedQuery`.
- Extended internal place-enrichment requests with lookup kind, area, and
  optional country context without changing the Convex schema.
- Updated the Geoapify server adapter to resolve destination city context when
  available, request a small candidate set, use supported `type`, `filter`,
  `bias`, and `limit` parameters, and rank candidates before accepting one.
- Added conservative candidate rejection for unrelated hotel results,
  mismatched country/geography, weak name matches, and generic activity text.
- Updated hotel and map lookup requests to include hotel area context and
  explicit lookup kinds.
- Skipped canonical lookups for generic activity text such as local meals,
  check-in, free time, and transfers.
- Updated map input normalization to require an accepted match status before a
  place can generate a marker.
- Added a Dhaka to Sylhet, 3-day smoke-style unit fixture that rejects a North
  American local candidate and keeps the remaining marker inside Sylhet-area
  coordinates.
- Documented the stricter matching contract in architecture and decisions.

Commands run:
- `npx tsc --noEmit`
- `npm test`
- `npm run lint`

Results:
- `npx tsc --noEmit` passed.
- `npm test` passed with 4 test files and 34 tests.
- `npm run lint` passed.

Open issues:
- Geoapify images and `/my-trips` cover images remain intentionally unchanged.
- Destination country is strongest when supplied or when provider destination
  geocoding returns a country code. A later milestone can collect structured
  country context in the trip brief.

## Milestone 00 - Read-only Preflight

Changed:
- Inspected the starting repository state without changing files.

Results:
- Repository was a clean Git repo with only `.gitattributes` tracked.
- No initialized app or unrelated project code was detected.
- Node.js satisfied the current Next.js minimum.

## Milestone 01 - Next.js Scaffold

Changed:
- Scaffolded a Next.js App Router application with TypeScript, Tailwind CSS, ESLint, and npm.
- Replaced default demo page content with a minimal compiling landing shell.
- Added local command documentation to `README.md`.

Results:
- `npm install` completed, audited 360 packages, and reported 0 vulnerabilities.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.

Open issues:
- npm reported an allow-scripts review warning for `unrs-resolver`; no action was taken.
- Future Clerk route interception should use `proxy.ts` because this project is on Next.js 16.

## Milestone 02 - Project Governance and Source of Truth

Changed:
- Replaced scaffold agent guidance with project governance in `AGENTS.md`.
- Added persistent product, architecture, decision, and environment documentation.
- Rebuilt this progress file as the milestone source of truth.

Commands run:
- `git status --porcelain=v1 --branch`
- `rg --files -uu -g '!.git' -g '!node_modules' -g '!.next'`
- `npm run lint`
- `npm run build`

Results:
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.

Open issues:
- None currently known.

Next milestone:
- Milestone 03

## Milestone 03 - UI Foundation

Changed:
- Initialized shadcn/ui with the current CLI for the existing Next.js and Tailwind CSS v4 project.
- Added only the `button`, `card`, `input`, and `badge` UI primitives.
- Added `components/app-container.tsx` for shared page width and padding.
- Added app-level CSS vocabulary for page containers, section spacing, card radius, muted text, and focus-visible rings.
- Kept the home page minimal and server-rendered.
- Set `agentRules: false` in `next.config.ts` so `next dev` preserves the concise project `AGENTS.md`.
- Removed `tw-animate-css` and `lucide-react` after shadcn setup because no selected primitive requires them in this milestone.

Commands run:
- `git status --porcelain=v1 --branch`
- `rg --files -uu -g '!.git' -g '!node_modules' -g '!.next'`
- `npx shadcn@latest init --help`
- `npx shadcn@latest init --defaults --no-monorepo`
- `npx shadcn@latest add card input badge`
- `npm uninstall tw-animate-css`
- `npm uninstall lucide-react`
- `rg 'use client|lucide|tw-animate|@clerk|convex|arcjet|openai|openrouter|mapbox|google' -n . -g '!node_modules' -g '!.git' -g '!.next'`
- `npm run lint`
- `npm run build`
- `npm run dev`
- `curl -sS -I http://localhost:3000`
- `curl -sS http://localhost:3000`

Results:
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- Local dev render returned HTTP 200 and included the expected minimal home page content.
- No app-authored `"use client"` directives were introduced.
- No Clerk, Convex, AI, Arcjet, Google Places, Mapbox, billing, Magic UI, or Aceternity packages were added.

Open issues:
- Browser console inspection was limited because the browser plugin's required Node execution tool was not exposed in this session. The app was verified with server render, dev logs, lint, build, and absence of app-authored client components.

Next milestone:
- Milestone 04

## Milestone 04 - Landing Page

Changed:
- Replaced the minimal home page with a public landing page shell.
- Added server-rendered landing components for the header, hero, how-it-works section, destination grid, product preview placeholder, and footer.
- Added local generated destination images under `public/landing/`.
- Linked the primary Create Trip CTA to `/create-trip` without implementing that route.
- Kept the page static with no authentication, database, AI, Arcjet, Google Places, Mapbox, billing, Magic UI, or Aceternity integration.
- Added explicit border-box base styling to prevent mobile width overflow.

Commands run:
- `git status --porcelain=v1 --branch`
- `rg --files -uu -g '!.git' -g '!node_modules' -g '!.next'`
- `sips -g pixelWidth -g pixelHeight`
- `magick ... -crop ...`
- `npm run lint`
- `npm run build`
- `npm run start`
- Headless Chrome desktop screenshot at `1440px`
- Headless Chrome emulated mobile screenshots at `390px`

Results:
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- Desktop production screenshot looked coherent.
- Emulated mobile viewport reported `scrollWidth` equal to `clientWidth` at 390px.
- Mobile production screenshots covered the hero, destination cards, product preview, and footer without text overlap or horizontal overflow.

Open issues:
- None currently known.

Next milestone:
- Milestone 05

## Milestone 05 - Route Skeletons

Changed:
- Added placeholder route pages for `/create-trip`, `/my-trips`, `/pricing`, and `/view-trip/[tripId]`.
- Added a shared app route-group layout for trip-related routes without enforcing authentication.
- Updated public header and footer navigation to point at real route boundaries.
- Read the dynamic trip route `tripId` from async App Router `params` and displayed it as placeholder content.

Commands run:
- `git status --short --branch`
- `rg --files -g '!node_modules' -g '!.next'`
- `npm run lint`
- `rg 'use client|@clerk|convex|arcjet|openai|openrouter|mapbox|google' app components docs package.json -n`
- `npm run build`
- `npm run start`
- `curl -sS -o /tmp/ai-trip-create-trip.html -w '/create-trip %{http_code}\n' http://localhost:3000/create-trip`
- `curl -sS -o /tmp/ai-trip-my-trips.html -w '/my-trips %{http_code}\n' http://localhost:3000/my-trips`
- `curl -sS -o /tmp/ai-trip-pricing.html -w '/pricing %{http_code}\n' http://localhost:3000/pricing`
- `curl -sS -o /tmp/ai-trip-view-trip.html -w '/view-trip/sample-trip-123 %{http_code}\n' http://localhost:3000/view-trip/sample-trip-123`
- `rg -q 'Create Trip' /tmp/ai-trip-create-trip.html && rg -q 'Planned inputs' /tmp/ai-trip-create-trip.html`
- `rg -q 'My Trips' /tmp/ai-trip-my-trips.html && rg -q 'No saved trips yet' /tmp/ai-trip-my-trips.html`
- `rg -q 'Pricing' /tmp/ai-trip-pricing.html && rg -q 'Free access' /tmp/ai-trip-pricing.html && rg -q 'Paid access' /tmp/ai-trip-pricing.html`
- `rg -q 'sample-trip-123' /tmp/ai-trip-view-trip.html && rg -q 'Dynamic route placeholder' /tmp/ai-trip-view-trip.html`

Results:
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- Production route visits returned HTTP 200 for `/create-trip`, `/my-trips`, `/pricing`, and `/view-trip/sample-trip-123`.
- Placeholder content was present in each visited route.
- No Clerk, Convex, AI, Arcjet, Google Places, Mapbox, billing, loading, or data-fetching behavior was implemented.

Open issues:
- In-app browser automation was unavailable because the required Node browser-control tool was not exposed in this session, so route visits were verified through the local production server and direct HTTP requests.
- The next prompt should confirm whether the shifted milestone order keeps authentication as Milestone 06.

Next milestone:
- Milestone 06

## Milestone 06 - Clerk Authentication

Changed:
- Installed `@clerk/nextjs` 7.8.0.
- Wrapped the App Router root with `ClerkProvider` inside `body`.
- Added Next.js 16 request interception with root-level `proxy.ts` and `clerkMiddleware()`.
- Added public Clerk component routes at `/sign-in` and `/sign-up`.
- Added shared auth controls that render signed-out sign-in/create-trip CTAs and signed-in `UserButton` without rendering user identifiers.
- Protected `/create-trip`, `/my-trips`, and `/view-trip/[tripId]` with server-side `auth.protect()`.
- Kept `/pricing` public and recorded that decision in `docs/DECISIONS.md`.
- Added a simple authenticated status check on `/create-trip` that does not expose user data.
- Updated `docs/ENVIRONMENT.md` with Clerk custom auth route variable names only.

Commands run:
- `git status --short --branch`
- `find app components lib -maxdepth 4 -type f | sort`
- `find . -maxdepth 2 -name '.env*' -type f | sort`
- `npm install @clerk/nextjs`
- `node -p "require('./package.json').dependencies['@clerk/nextjs']"`
- `rg "export .*ClerkProvider|export .*Show|export .*SignIn|export .*SignUp|export .*UserButton" node_modules/@clerk/nextjs -n --glob '*.d.ts'`
- `rg "clerkMiddleware|auth\\.protect|function auth|declare const auth" node_modules/@clerk/nextjs -n --glob '*.d.ts'`
- `node -e "for (const name of ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY','CLERK_SECRET_KEY','NEXT_PUBLIC_CLERK_SIGN_IN_URL','NEXT_PUBLIC_CLERK_SIGN_UP_URL','NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL','NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL']) console.log(name + '=' + (process.env[name] ? 'present' : 'missing'))"`
- `npm run lint`
- `npm run build`
- `npm run start`
- `curl -sS -o /tmp/auth-home.html -w '/ %{http_code}\n' http://localhost:3000/`
- `curl -sS -o /tmp/auth-pricing.html -w '/pricing %{http_code}\n' http://localhost:3000/pricing`
- `curl -sS -o /tmp/auth-sign-in.html -w '/sign-in %{http_code}\n' http://localhost:3000/sign-in`
- `curl -sS -o /tmp/auth-sign-up.html -w '/sign-up %{http_code}\n' http://localhost:3000/sign-up`
- `curl -sS -o /tmp/auth-create-trip.html -D /tmp/auth-create-trip.headers -w '/create-trip %{http_code}\n' http://localhost:3000/create-trip`
- `curl -sS -o /tmp/auth-my-trips.html -D /tmp/auth-my-trips.headers -w '/my-trips %{http_code}\n' http://localhost:3000/my-trips`
- `curl -sS -o /tmp/auth-view-trip.html -D /tmp/auth-view-trip.headers -w '/view-trip/sample-trip-123 %{http_code}\n' http://localhost:3000/view-trip/sample-trip-123`
- `rg "userId|currentUser|emailAddress|firstName|lastName" app components -n`
- `rg "@clerk|convex|arcjet|openai|openrouter|mapbox|google|@clerk/ui" package.json app components proxy.ts docs -n`
- `git status --short --branch`
- `node -e "... verified required Clerk variable names are present without printing values ..."`
- `npm run lint`
- `npm run build`
- `npm run start`
- `curl -sS -o /tmp/m06-home.html -w '/ %{http_code}\n' http://localhost:3000/`
- `curl -sS -o /tmp/m06-pricing.html -w '/pricing %{http_code}\n' http://localhost:3000/pricing`
- `curl -sS -o /tmp/m06-sign-in.html -w '/sign-in %{http_code}\n' http://localhost:3000/sign-in`
- `curl -sS -o /tmp/m06-sign-up.html -w '/sign-up %{http_code}\n' http://localhost:3000/sign-up`
- `curl -sS -o /tmp/m06-create-trip.html -D /tmp/m06-create-trip.headers -w '/create-trip %{http_code}\n' http://localhost:3000/create-trip`
- `curl -sS -o /tmp/m06-my-trips.html -D /tmp/m06-my-trips.headers -w '/my-trips %{http_code}\n' http://localhost:3000/my-trips`
- `curl -sS -o /tmp/m06-view-trip.html -D /tmp/m06-view-trip.headers -w '/view-trip/sample-trip-123 %{http_code}\n' http://localhost:3000/view-trip/sample-trip-123`
- `awk 'BEGIN{IGNORECASE=1} /^location:/{...}' /tmp/m06-create-trip.headers /tmp/m06-my-trips.headers /tmp/m06-view-trip.headers`
- `rg -q 'AI Trip Planner|Create Trip' /tmp/m06-home.html`
- `rg -q 'Pricing|Free access|Paid access' /tmp/m06-pricing.html`
- `rg -q 'Sign in|Sign up|clerk|Clerk' /tmp/m06-sign-in.html`
- `rg -q 'Sign up|Sign in|clerk|Clerk' /tmp/m06-sign-up.html`

Results:
- `npm install @clerk/nextjs` completed, audited 609 packages, and reported 0 vulnerabilities.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- Required Clerk variable names are present in `.env.local`; values were not printed.
- Production runtime no longer fails on missing Clerk configuration.
- Public routes `/` and `/pricing` returned HTTP 200.
- Clerk routes `/sign-in` and `/sign-up` returned HTTP 200 with Clerk/auth content present.
- Signed-out requests to `/create-trip`, `/my-trips`, and `/view-trip/sample-trip-123` returned HTTP 307 redirects to the sign-in route.

Open issues:
- Interactive sign-in, sign-out, and authenticated page access still require a browser session. The in-app browser automation tool was unavailable in this session, so this final human-in-the-browser check remains manual.
- Future Convex, route handlers, and server actions must repeat authorization at the server/data boundary; route protection alone is not authorization.
- npm repeated the allow-scripts review warning for `unrs-resolver`; no action was taken.

Next milestone:
- Milestone 07

## Milestone 07 - Convex + Clerk Auth Bridge

Changed:
- Installed the allowed `convex` dependency.
- Initialized an anonymous local Convex deployment with `npx convex dev --once`.
- Added a client-side `ConvexClientProvider` using `ConvexProviderWithClerk` and Clerk's `useAuth` hook.
- Wrapped the existing `ClerkProvider` children with the Convex provider in the root layout.
- Added `convex/auth.config.ts` using `process.env.CLERK_JWT_ISSUER_DOMAIN` and `applicationID: "convex"`.
- Added a temporary `convex/auth.ts` `whoAmI` query that reads `ctx.auth.getUserIdentity()` and returns only safe debug booleans.
- Added an authenticated `/create-trip` Convex identity check component.
- Added `NEXT_PUBLIC_CONVEX_SITE_URL` to environment docs as a generated Convex variable name.

Commands run:
- `git status --short --branch`
- `find app components lib -maxdepth 4 -type f | sort`
- `find . -maxdepth 3 -name 'convex' -o -name '_generated' -o -name '.env*'`
- `node -e "... checked Convex and Clerk variable-name presence without printing values ..."`
- `npm install convex`
- `npx convex dev --once`
- `npx convex env --help`
- `npx convex dev`
- `npx convex env --deployment local set CLERK_JWT_ISSUER_DOMAIN ...`
- `npx convex codegen --help`
- `npx convex codegen`
- `npx convex dev --once`
- `node -e "... checked Convex variable-name presence without printing values ..."`
- `npx convex env --deployment local list --names-only`
- `node -e "... derived Clerk issuer without printing it and ran npx convex dev --once with CLERK_JWT_ISSUER_DOMAIN in the child environment ..."`
- `node -e "... checked Convex and Clerk variable-name presence and format without printing values ..."`
- `npx convex dev --once`
- `rg "auth" convex/_generated/api.d.ts convex/_generated/api.js -n`
- `npx convex run auth:whoAmI`
- `npx convex run auth:whoAmI --identity '{"subject":"debug-subject","issuer":"https://debug.example","emailVerified":true}'`
- `rg "userId|currentUser|emailAddress|firstName|lastName|tokenIdentifier|identity\\.email|identity\\.name|identity\\.givenName|identity\\.familyName" app components convex -n`
- `npm run lint`
- `npm run build`
- `npm run start`
- `curl -sS -o /tmp/m07-home.html -w '/ %{http_code}\n' http://localhost:3000/`
- `curl -sS -o /tmp/m07-pricing.html -w '/pricing %{http_code}\n' http://localhost:3000/pricing`
- `curl -sS -o /tmp/m07-sign-in.html -w '/sign-in %{http_code}\n' http://localhost:3000/sign-in`
- `curl -sS -o /tmp/m07-sign-up.html -w '/sign-up %{http_code}\n' http://localhost:3000/sign-up`
- `curl -sS -o /tmp/m07-create-trip.html -D /tmp/m07-create-trip.headers -w '/create-trip %{http_code}\n' http://localhost:3000/create-trip`
- `curl -sS -o /tmp/m07-my-trips.html -D /tmp/m07-my-trips.headers -w '/my-trips %{http_code}\n' http://localhost:3000/my-trips`
- `curl -sS -o /tmp/m07-view-trip.html -D /tmp/m07-view-trip.headers -w '/view-trip/sample-trip-123 %{http_code}\n' http://localhost:3000/view-trip/sample-trip-123`
- `awk 'BEGIN{IGNORECASE=1} /^location:/{...}' /tmp/m07-create-trip.headers /tmp/m07-my-trips.headers /tmp/m07-view-trip.headers`
- `rg -q 'AI Trip Planner|Create Trip' /tmp/m07-home.html`
- `rg -q 'Pricing|Free access|Paid access' /tmp/m07-pricing.html`
- `rg -q 'Sign in|Sign up|clerk|Clerk' /tmp/m07-sign-in.html`
- `rg -q 'Sign up|Sign in|clerk|Clerk' /tmp/m07-sign-up.html`

Results:
- `npm install convex` completed, audited 614 packages, and reported 0 vulnerabilities.
- `npx convex dev --once` initialized a local anonymous Convex deployment and generated `convex/_generated/*`.
- Convex wrote generated Convex variable names to `.env.local`; values were not printed.
- `npx convex dev` prepared existing functions, then stopped after `convex/auth.config.ts` was added because `CLERK_JWT_ISSUER_DOMAIN` is not set in the Convex deployment environment.
- `npx convex codegen` also stopped on the same missing Convex environment variable, so generated API types do not yet include `api.auth.whoAmI`.
- Follow-up verification after manual setup still reports `CLERK_JWT_ISSUER_DOMAIN` missing from the Convex deployment environment.
- `.env.local` contains generated Convex variable names, but `CLERK_JWT_ISSUER_DOMAIN` was not present by name when checked.
- Passing `CLERK_JWT_ISSUER_DOMAIN` through the shell to `npx convex dev --once` did not satisfy Convex; it must be configured in the Convex deployment environment.
- Follow-up verification after configuring the cloud development deployment succeeded with `npx convex dev --once`.
- Generated Convex API types now include `api.auth.whoAmI`.
- `npx convex run auth:whoAmI` completed successfully for the unauthenticated/null contract.
- A synthetic Convex identity run returned only the safe debug booleans from `whoAmI`.
- Authored code does not return or render client-supplied user IDs, email addresses, names, photos, or Convex token identifiers.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2 and `.env.local` loaded.
- Production route checks returned HTTP 200 for `/`, `/pricing`, `/sign-in`, and `/sign-up`.
- Signed-out production requests to `/create-trip`, `/my-trips`, and `/view-trip/sample-trip-123` returned HTTP 307 redirects to the sign-in route.

Open issues:
- Full browser-authenticated Convex token exchange still requires signing in through Clerk in a browser session. The server and Convex side are configured and synced; automated checks verified the unauthenticated contract and function behavior with a synthetic Convex identity.
- npm repeated allow-scripts review warnings for `unrs-resolver` and `esbuild`; no action was taken.

Next milestone:
- Milestone 08

## Milestone 08 - Database Schema and Authorization

Changed:
- Added Convex schema tables for `users` and `trips`.
- Added required indexes for user lookup by authenticated identity key and trip listing by owner/creation time.
- Added conservative validators for trip status, enrichment status, and a placeholder structured trip payload.
- Added `users:upsertCurrentUserFromIdentity`, deriving the stored user identity from `ctx.auth.getUserIdentity()`.
- Added secure trip functions to create, save, list, and get current-user trips.
- Returned sanitized trip records to clients without the internal `ownerIdentityKey`.
- Recorded the decision to use Convex document IDs as trip identifiers for now.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `rg "ownerIdentityKey|tokenIdentifier|identity\\.email|identity\\.name|identity\\.givenName|identity\\.familyName" app components -n`
- `rg "ownerId|ownerIdentityKey|user_id|userId|email" convex/trips.ts convex/users.ts -n`
- `npx convex dev --once`
- `npx convex run trips:listCurrentUserTrips`
- `npx convex run trips:createTrip '{"source":"Dhaka","destination":"Tokyo","durationDays":5,"budget":"moderate","groupSize":2}'`
- `npx convex run users:upsertCurrentUserFromIdentity`
- `npx convex run users:upsertCurrentUserFromIdentity --identity ...`
- `npx convex run trips:createTrip ... --identity ...`
- `npx convex run trips:getCurrentUserTrip ... --identity ...`
- `npx convex run trips:listCurrentUserTrips --identity ...`
- `rg "ownerIdentityKey" /tmp/m08-list-owner-a.json`
- `npx convex run trips:saveTrip ... --identity ...`
- `npm run lint`
- `npm run build`

Results:
- `npx convex dev --once` passed and synced the schema/functions.
- Unauthenticated `users` and `trips` functions rejected with `UNAUTHENTICATED`.
- Synthetic authenticated user upsert, trip create, trip get, trip list, and trip save checks passed.
- A different synthetic identity was rejected from reading another identity's trip with `UNAUTHORIZED`.
- Trip list output did not include the internal `ownerIdentityKey`.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.

Open issues:
- The trip payload validator is intentionally conservative and must be tightened when the AI itinerary and provider enrichment schemas are implemented.
- Synthetic debug user/trip records were created in the development Convex deployment during smoke testing.
- Full browser-authenticated Convex calls still depend on signing in through Clerk in a local browser session.

Next milestone:
- Milestone 09

## Milestone 09 - User Profile Sync

Changed:
- Added a silent `UserProfileSync` client component that runs inside the existing Convex/Clerk provider after Clerk has loaded and the user is signed in.
- Updated `users:upsertCurrentUserFromIdentity` to accept only optional display text while still deriving the identity key from `ctx.auth.getUserIdentity()`.
- Added `users:getCurrentUserProfile` for safe profile smoke checks.
- Removed the temporary visible Convex identity UI from `/create-trip`.
- Kept the small server-side `auth:whoAmI` query as a low-risk auth bridge test function.
- Recorded that Clerk remains the source of truth for authentication and billing, while Convex stores only minimal app profile data.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `rg --files app components convex docs`
- `sed -n ... app/layout.tsx components/convex-client-provider.tsx components/auth/convex-auth-status.tsx app/(app)/create-trip/page.tsx convex/*.ts`
- `npx convex dev --once`
- `npm run lint`
- `npm run build`
- `npx convex run users:upsertCurrentUserFromIdentity '{"displayName":"Milestone Nine A"}' --identity ...`
- `npx convex run users:upsertCurrentUserFromIdentity '{"displayName":"Milestone Nine B"}' --identity ...`
- `diff -u /tmp/m09-user-a-1 /tmp/m09-user-a-2`
- `cmp -s /tmp/m09-user-a-1 /tmp/m09-user-b`
- `npx convex run users:getCurrentUserProfile --identity ...`
- `npx convex run trips:createTrip ... --identity ...`
- `npx convex run trips:getCurrentUserTrip ... --identity ...`
- `npx convex run trips:listCurrentUserTrips --identity ...`
- `rg "$trip_id" /tmp/m09-list-b`
- `rg "ConvexAuthStatus|whoAmI|api\\.auth\\.whoAmI" app components convex -n -g '!convex/_generated/**'`
- `rg "ownerId|ownerIdentityKey|user_id|userId|emailAddress|primaryEmailAddress|imageUrl|token" app components convex -n -g '!convex/_generated/**'`

Results:
- `npx convex dev --once` passed and regenerated/synced Convex functions.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- Repeating the same synthetic authenticated profile upsert returned the same profile id.
- Two synthetic authenticated identities returned distinct Convex profile ids.
- Safe profile queries returned only `_id`, `displayName`, `createdAt`, and `updatedAt`.
- A trip created by one synthetic identity could not be read by the other; Convex returned `UNAUTHORIZED`.
- The other identity's trip list did not include the first identity's trip id.
- No client code passes owner ids, emails, image URLs, tokens, or Clerk metadata to Convex authorization.

Open issues:
- Full verification with two real Clerk test users still requires signing into the app in a browser with two Clerk accounts. Automated checks verified the same Convex authorization boundary with two synthetic authenticated identities.
- Synthetic debug profile/trip records were created in the development Convex deployment during smoke testing.

Next milestone:
- Milestone 10

## Milestone 10 - Create Trip UI Shell

Changed:
- Replaced the placeholder `/create-trip` authenticated page content with a client-driven local trip-planning shell.
- Added a two-column responsive layout with a conversation/selection panel and a live trip preview panel.
- Added typed local flow models for message role, UI selector, budget tier, group type, requirements, current step, loading state, and error state.
- Added deterministic mock assistant progression for source, destination, duration, budget, group, review, and complete states.
- Added UI-boundary validation for required text, duration range, group type, and group size.
- Added Reset/Start Over behavior.
- Kept all flow logic local; no AI, Convex persistence, Google Places, Mapbox, Arcjet, billing, fetch, or save calls were added.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `sed -n ... app/(app)/create-trip/page.tsx app/(app)/layout.tsx components/ui/*.tsx app/globals.css`
- `npm run lint`
- `npm run build`
- `rg "convex|api\\.|openai|openrouter|arcjet|mapbox|google|fetch\\(|axios|saveTrip|createTrip\\(" app/(app)/create-trip components/create-trip -n`
- `node --experimental-strip-types --input-type=module ... create-trip-flow reducer smoke test`
- `npm run dev`
- `curl -sS -o /tmp/m10-create-trip.html -D /tmp/m10-create-trip.headers -w '/create-trip %{http_code}\\n' http://localhost:3000/create-trip`
- `curl -sS -o /tmp/m10-home.html -w '/ %{http_code}\\n' http://localhost:3000/`

Results:
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- Source scan found no AI, Convex, Google, Mapbox, Arcjet, fetch, Axios, or save calls in the create-trip shell.
- Reducer smoke test validated missing-source error, bad-duration error, full local completion, message growth, destination state, and reset back to the source step.
- Local dev server started successfully on `http://localhost:3000`.
- Signed-out `/create-trip` returned HTTP 307, preserving Clerk route protection.
- Public `/` returned HTTP 200.

Open issues:
- Browser automation for desktop/mobile authenticated completion could not be run because the required browser JavaScript execution tool was not exposed in this session. The flow still needs a manual browser pass after signing in through Clerk.
- The Node reducer smoke test emitted a module-type warning because the project package is not marked as an ES module; no package metadata was changed.

Next milestone:
- Milestone 11

## Milestone 11 - Generative UI Component Mapping

Changed:
- Added a single `renderGenerativeUI` mapping from a narrow selector union to pre-built React components.
- Added focused typed UI blocks for source/destination input, duration input, budget selection, group size/type, review/confirm, and final placeholder states.
- Replaced the rough prompt-10 controls in `ConversationPanel` with the renderer output.
- Changed the create-trip reducer to accept typed submissions from components instead of rough field mutations.
- Added safe fallback rendering for unknown selector values.
- Kept canonical requirement state only in the reducer; assistant messages do not duplicate selector state.
- Added a persistent decision that AI/data may select pre-built components but must never generate JSX.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `sed -n ... components/create-trip/*.tsx components/create-trip/*.ts`
- `npm run lint`
- `npm run build`
- `node --experimental-strip-types --input-type=module ... create-trip-flow selector smoke test`
- `rg "convex|api\\.|openai|openrouter|arcjet|mapbox|google|fetch\\(|axios|saveTrip|createTrip\\(" app/(app)/create-trip components/create-trip -n`
- `rg "renderGenerativeUI|UnknownSelectorFallback|aria-pressed|aria-label|onSubmit|onSelect" components/create-trip -n`
- `tool_search` for browser JavaScript execution tooling
- `npm run dev`
- `curl -sS -o /tmp/m11-create-trip.html -D /tmp/m11-create-trip.headers -w '/create-trip %{http_code}\\n' http://localhost:3000/create-trip`
- `curl -sS -o /tmp/m11-home.html -w '/ %{http_code}\\n' http://localhost:3000/`

Results:
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- Selector smoke test walked `source > destination > duration > budget > group > review > final`, completed the flow, reset to `source`, and preserved validation for an empty source.
- Source scan found no AI, Convex persistence, Google, Mapbox, Arcjet, fetch, Axios, or save calls in the create-trip shell.
- Accessibility scan confirmed the mapped controls include labeled inputs, `aria-pressed` selection state, and typed submit/select callbacks.
- Local dev server started successfully on `http://localhost:3000`.
- Signed-out `/create-trip` returned HTTP 307, preserving Clerk route protection.
- Public `/` returned HTTP 200.

Open issues:
- Authenticated browser testing of every rendered selector still requires signing in through Clerk. Browser automation could not be used because the required JavaScript execution tool was not exposed in this session.
- The Node selector smoke test emitted the same module-type warning as the previous milestone because the project package is not marked as an ES module; no package metadata was changed.

Next milestone:
- Milestone 12

## Milestone 12 - AI Contract and Schema

Changed:
- Added shared AI contract types and strict JSON Schemas in `lib/ai/contract.ts`.
- Defined the conversational step response: assistant text, next UI selector, and optional normalized requirement update.
- Defined the final itinerary response: `travelPlan`, summary, hotels, and day-by-day itinerary activities.
- Added dependency-free pure parsers/guards that convert `unknown` data into typed data or explicit validation errors.
- Added valid and invalid fixtures in `lib/ai/fixtures.ts` for manual and future unit-test use.
- Reused shared budget, group, and UI selector types from the AI contract in the create-trip flow.
- Documented the AI boundary in `docs/ARCHITECTURE.md` and persistent contract decisions in `docs/DECISIONS.md`.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `rg --files app components convex lib docs`
- `sed -n ... convex/schema.ts components/create-trip/*.ts components/create-trip/*.tsx`
- `node --experimental-strip-types --input-type=module ... AI parser fixture smoke test`
- `rg "latitude|longitude|lat|lng|placeId|photo|canonical|additionalProperties|parseConversationalStepResponse|parseFinalItineraryResponse" lib/ai docs components/create-trip -n`
- `npm run lint`
- `npm run build`

Results:
- Valid conversational and final itinerary fixtures parsed successfully.
- Invalid conversational fixtures failed validation.
- Invalid final itinerary fixtures failed validation, including rejection of model-provided coordinate fields.
- Source scan confirmed strict schema markers, parser exports, and the documented canonical Google Places boundary.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.

Open issues:
- No OpenRouter network call is connected yet.
- Existing Convex `generatedTripPayload` validation remains the earlier conservative placeholder; it should be migrated carefully before saving real AI itinerary responses because development records may still use the placeholder shape.
- The Node parser smoke test emitted the same module-type warning as earlier milestones because the project package is not marked as an ES module; no package metadata was changed.

Next milestone:
- Milestone 13

## Milestone 13 - OpenRouter Server Client

Changed:
- Installed the `openai` package for OpenRouter's OpenAI-compatible API.
- Added a server-only OpenRouter client module in `lib/ai/openrouter.ts`.
- Added server-side validation for `OPEN_ROUTER_API_KEY` and `OPEN_ROUTER_MODEL` without printing values.
- Configured the OpenAI SDK with the OpenRouter base URL, app title header, no automatic retries, and a 20 second timeout.
- Added a temporary protected `/api/openrouter-smoke` route that requests strict JSON Schema structured output using the conversational contract from Milestone 12.
- Sanitized browser responses so raw provider errors, headers, request IDs, and key material are not exposed.
- Documented the OpenRouter server boundary and provider-error handling decisions.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `npm install openai`
- `node -p "require('./package.json').dependencies.openai"`
- `test -d node_modules/server-only`
- `rg "baseURL|defaultHeaders|timeout|signal|response_format" node_modules/openai -n --glob '*.d.ts'`
- `npm run build`
- `npm run lint`
- `node ... environment presence check for OPEN_ROUTER_API_KEY and OPEN_ROUTER_MODEL`
- `npm run dev`
- `curl -sS -o /tmp/m13-openrouter-smoke-anon.html -D /tmp/m13-openrouter-smoke-anon.headers -w '/api/openrouter-smoke %{http_code}\n' http://localhost:3000/api/openrouter-smoke`
- `curl -sS -o /tmp/m13-home.html -w '/ %{http_code}\n' http://localhost:3000/`
- `node --env-file=.env.local --experimental-strip-types --input-type=module ... OpenRouter structured-output smoke call`
- `curl -sS -o /tmp/m13-openrouter-smoke-anon-2.html -D /tmp/m13-openrouter-smoke-anon-2.headers -w '/api/openrouter-smoke %{http_code}\n' http://localhost:3000/api/openrouter-smoke`
- `curl -sS -o /tmp/m13-home-2.html -w '/ %{http_code}\n' http://localhost:3000/`

Results:
- `npm install openai` completed, audited 615 packages, and reported 0 vulnerabilities.
- `OPEN_ROUTER_API_KEY` is present by name.
- `OPEN_ROUTER_MODEL` is present by name.
- The live server-side OpenRouter smoke call succeeded with schema-valid JSON, assistant text present, `nextUISelector` set to `source`, provider model metadata present, and finish reason `stop`.
- Signed-out `/api/openrouter-smoke` returned HTTP 307 to `/sign-in`, verifying the route is not anonymously callable.
- Public `/` returned HTTP 200.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- The smoke request uses OpenRouter `provider.require_parameters: true` and a 600 token cap so structured-output routing has enough completion budget.
- Plain Node still cannot directly import `lib/ai/openrouter.ts` because its Next.js bundler-style extensionless import differs from Node's stripped TypeScript resolver, so the live command imported the shared contract directly and used the same SDK/base URL/request shape.

Open issues:
- If it has not already been rotated, the existing `OPEN_ROUTER_API_KEY` should be rotated in OpenRouter and replaced in `.env.local` because it was accidentally printed in terminal output during this milestone. Do not share or paste the old value anywhere.
- npm repeated allow-scripts review warnings for `unrs-resolver` and `esbuild`; no action was taken.

Next milestone:
- Milestone 14

## Milestone 14 - AI-Driven Conversation

Changed:
- Added `lib/ai/conversation.ts` with dependency-free request and response envelope validation for compact trip conversation payloads.
- Added authenticated `/api/ai-model` as the server boundary for AI trip-interviewer turns.
- Generalized `lib/ai/openrouter.ts` with `runOpenRouterConversationStep` while keeping the Milestone 13 smoke helper.
- Built a system instruction that collects only source, destination, duration, budget, and group details, returns the strict conversational schema, and does not generate final itineraries.
- Replaced deterministic mock progression in `/create-trip` with client calls to `/api/ai-model`.
- Preserved local UI boundary validation, disabled duplicate submissions while pending, and added abort/stale-response handling for reset.
- Added safe client fallback behavior for invalid or failed AI responses while preserving collected fields.
- Added deterministic `READY_FOR_FINAL` state after review confirmation; final itinerary generation remains disconnected.
- Updated create-trip copy and preview text to reflect the AI conversation boundary.
- Documented the AI conversation route and READY_FOR_FINAL decision.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `rg --files app components lib convex docs`
- `sed -n ... components/create-trip/*.tsx components/create-trip/*.ts lib/ai/*.ts app/api/*.ts`
- `npm run lint`
- `npm run build`
- `node ... environment presence check for OPEN_ROUTER_API_KEY and OPEN_ROUTER_MODEL`
- `rg "arcjet|saveTrip|createTrip\\(|Google|Places|mapbox|billing|finalItinerary|parseFinalItinerary|hotels|itinerary" app/api/ai-model components/create-trip lib/ai/openrouter.ts -n`
- `rg "auth\\.protect|runOpenRouterConversationStep|parseTripConversationRequest|parseTripConversationResponseEnvelope|READY_FOR_FINAL|isLoading|AbortController" app/api/ai-model components/create-trip lib/ai -n`
- `npm run dev`
- `curl -sS -o /tmp/m14-ai-model-anon.html -D /tmp/m14-ai-model-anon.headers -w '/api/ai-model %{http_code}\n' -X POST http://localhost:3000/api/ai-model ...`
- `curl -sS -o /tmp/m14-create-trip.html -D /tmp/m14-create-trip.headers -w '/create-trip %{http_code}\n' http://localhost:3000/create-trip`
- `curl -sS -o /tmp/m14-home.html -w '/ %{http_code}\n' http://localhost:3000/`
- `node --env-file=.env.local --experimental-strip-types --input-type=module ... OpenRouter conversation smoke call`
- `node --experimental-strip-types --input-type=module ... create-trip reducer smoke test`

Results:
- `OPEN_ROUTER_API_KEY` is present by name.
- `OPEN_ROUTER_MODEL` is present by name.
- Signed-out `/api/ai-model` returned HTTP 307 to `/sign-in`, verifying the route is not anonymously callable.
- Signed-out `/create-trip` returned HTTP 307 to `/sign-in`, preserving route protection.
- Public `/` returned HTTP 200 and expected home content.
- A live server-side OpenRouter conversation smoke call succeeded with schema-valid JSON, assistant text present, `nextUISelector` set to `destination`, provider model metadata present, and finish reason `stop`.
- Reducer smoke testing passed for non-linear AI-selected steps, READY_FOR_FINAL transition, and reset.
- Source scans found no Arcjet integration, Convex trip saving, Google Places calls, Mapbox integration, billing checks, or final itinerary parsing/generation connected to the create-trip conversation.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.

Open issues:
- Full authenticated browser end-to-end testing through Clerk still requires signing into the local app with a Clerk test user. Automated checks covered route protection, live provider response shape, and reducer behavior.
- The Node reducer smoke test emitted the existing module-type warning because the project package is not marked as an ES module; no package metadata was changed.
- If it has not already been rotated, the existing `OPEN_ROUTER_API_KEY` should be rotated in OpenRouter and replaced in `.env.local` because it was accidentally printed in terminal output during Milestone 13.

Next milestone:
- Milestone 15

## Milestone 15 - Final Itinerary Generation

Changed:
- Added `lib/ai/itinerary.ts` with dependency-free validation for complete final-generation requests, response envelopes, and itinerary day-count matching.
- Extended the final itinerary contract with required `estimatedPriceText` fields and activity `timeWindow` fields.
- Added authenticated `/api/ai-itinerary` as a distinct final-generation route separate from conversational `/api/ai-model`.
- Added `runOpenRouterFinalItinerary` to the server-only OpenRouter module with strict final itinerary JSON Schema output.
- Added minimal/excluded reasoning controls and a larger token budget for final itinerary calls so structured JSON has enough output room.
- Added final-generation reducer actions separate from conversational actions.
- Added client-side final itinerary generation from `READY_FOR_FINAL`, with pending-state duplicate prevention, retry behavior, stale-response handling, and reset aborts.
- Stored generated itineraries only in client state.
- Rendered generated summaries, hotels, day-by-day activities, time windows, generated estimate text, and practical notes in the create-trip UI.
- Labeled presented prices as generated estimates and kept Google Places, Convex persistence, Arcjet, Mapbox, and billing disconnected.
- Updated architecture and decision docs for the final itinerary boundary and generated-estimate policy.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `rg --files app components lib docs`
- `sed -n ... lib/ai/*.ts components/create-trip/*.tsx components/create-trip/*.ts`
- `npm run lint`
- `npm run build`
- `npm run dev`
- `curl -sS -o /tmp/m15-ai-itinerary-anon.html -D /tmp/m15-ai-itinerary-anon.headers -w '/api/ai-itinerary %{http_code}\n' -X POST http://localhost:3000/api/ai-itinerary ...`
- `curl -sS -o /tmp/m15-home.html -w '/ %{http_code}\n' http://localhost:3000/`
- `node ... environment presence check for OPEN_ROUTER_API_KEY and OPEN_ROUTER_MODEL`
- `node --env-file=.env.local --experimental-strip-types --input-type=module ... three OpenRouter final itinerary smoke calls`
- `node --env-file=.env.local --experimental-strip-types --input-type=module ... Bali final itinerary retry with minimal reasoning`
- `node ... inline itinerary day-count mismatch validation smoke check`
- `rg "convex|saveTrip|createTrip\\(|GOOGLE|Google Places|mapbox|Mapbox|arcjet|billing|CLERK_SECRET|OPEN_ROUTER_API_KEY" app/api/ai-itinerary components/create-trip lib/ai -n`

Results:
- `OPEN_ROUTER_API_KEY` is present by name.
- `OPEN_ROUTER_MODEL` is present by name.
- Signed-out `/api/ai-itinerary` returned HTTP 307 to `/sign-in`, verifying the route is not anonymously callable.
- Public `/` returned HTTP 200.
- Live final-generation smoke tests passed for Tokyo 3 days, Paris 2 days, and Bali 1 day.
- Each passing live final-generation response parsed through the strict final itinerary schema and had itinerary day count matching requested duration.
- The first Bali 1-day attempt hit provider `finishReason: length`; increasing final token budget and sending minimal/excluded reasoning produced a passing retry.
- Inline day-count mismatch validation returned the clear error `generated itinerary day count did not match the requested duration`.
- Source scan found no Convex persistence, Google Places integration, Mapbox integration, Arcjet integration, or billing enforcement in the final-generation path.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.

Open issues:
- Full authenticated browser E2E through Clerk still requires signing into the local app with a Clerk test user.
- Generated hotels, prices, addresses, and place names are unverified model output until revised Geoapify enrichment is implemented.
- Final itinerary results are client-state only and are not persisted to Convex yet.
- The Node live-smoke commands emitted the existing module-type warning because the project package is not marked as an ES module; no package metadata was changed.
- If it has not already been rotated, the existing `OPEN_ROUTER_API_KEY` should be rotated in OpenRouter and replaced in `.env.local` because it was accidentally printed in terminal output during Milestone 13.

Next milestone:
- Milestone 16

## Milestone 16 - Save Trip

Changed:
- Tightened new Convex trip saves to the validated final itinerary schema from Milestones 12 and 15.
- Added a server-authorized `trips:saveGeneratedTrip` mutation that derives ownership from `ctx.auth.getUserIdentity()`.
- Used Convex document IDs as the saved trip identifiers; no UUID dependency was added.
- Added a `saveRequestKey` index and mutation lookup for idempotent save retries.
- Added `groupType` and final itinerary payload support to saved trip records.
- Kept explicit legacy read compatibility for earlier development trip records with old placeholder payloads and old budget labels; new save mutations only accept current budget tiers and final itinerary payloads.
- Added client save state, Save Trip/Retry Save controls, duplicate-submit prevention, and redirect to `/view-trip/[tripId]` after a successful save.
- Updated `/view-trip/[tripId]` to load saved trip data through an owner-authorized Convex query.
- Kept Google Places enrichment, Mapbox, Arcjet quota, and billing disconnected.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `sed -n ... convex/schema.ts convex/trips.ts components/create-trip/*.ts* app/(app)/view-trip/[tripId]/page.tsx`
- `npx convex dev --once`
- `npx convex data trips --format json | node ... minimal legacy-shape inspection`
- `node --input-type=module ... Convex save idempotency and owner/other-user authorization smoke test`
- `node --input-type=module ... unauthenticated save rejection and public-id query smoke test`
- `npm run lint`
- `npm run build`
- `npx convex codegen`

Results:
- Initial `npx convex dev --once` failed because existing development `trips` documents used legacy budget values from older milestones.
- After adding explicit legacy read compatibility, `npx convex dev --once` passed and Convex functions were ready.
- Convex smoke test saved a generated itinerary for a synthetic authenticated identity.
- Repeating the same save with the same `saveRequestKey` returned the same trip ID.
- The owner identity could fetch the saved trip, and a different identity was rejected with `UNAUTHORIZED`.
- An unauthenticated save was rejected with `UNAUTHENTICATED`.
- The string-based `/view-trip/[tripId]` Convex query succeeded for the owner.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- `npx convex codegen` passed.

Open issues:
- Full browser E2E through Clerk still requires signing into the local app with a Clerk test user, then running create -> generate -> save -> redirect.
- Existing development Convex data includes legacy test trips from earlier milestones. The schema keeps them readable, but new trip saves use the current final itinerary contract.
- Generated hotels, prices, addresses, and place names remain unverified model output until revised Geoapify enrichment is implemented.
- If it has not already been rotated, the existing `OPEN_ROUTER_API_KEY` should be rotated in OpenRouter and replaced in `.env.local` because it was accidentally printed in terminal output during Milestone 13.

Next milestone:
- Milestone 17

## Milestone 17 - View Trip Data Page

Changed:
- Refined the secure Convex trip view query to return explicit view states for unauthenticated, malformed ID, not found, unauthorized, malformed legacy data, and valid trip data.
- Kept Convex identity and ownership checks as the authoritative data boundary.
- Kept the Next.js dynamic route on the current async App Router `params` API.
- Reworked the saved trip page into a minimal data view with direct props instead of a TripDetailContext.
- Rendered a compact trip header with destination, source, duration, budget, group size, created date, and trip ID.
- Reduced itinerary presentation to summary/count data only; no Google Places, Mapbox, Arcjet, billing, or external network calls were added.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `sed -n ... convex/trips.ts convex/schema.ts app/(app)/view-trip/[tripId]/page.tsx components/trips/saved-trip-detail.tsx`
- `npx convex dev --once`
- `node --input-type=module ... Convex view-state smoke test`
- `npx convex run --inline-query ... valid-missing-ID candidate search`
- `npm run lint`
- `npm run build`
- `npx convex codegen`
- `rg -nP '[^\\x00-\\x7F]' app components convex lib docs`
- `rg "Google Places|GOOGLE_PLACE|mapbox|Mapbox|arcjet|billing|OPEN_ROUTER_API_KEY|OPEN_ROUTER_MODEL|fetch\\(" ...`

Results:
- `npx convex dev --once` passed and Convex functions were ready.
- Valid owned trip query returned `ok`.
- Malformed route ID query returned `malformed_id`.
- Another synthetic user's trip query returned `unauthorized`.
- Unauthenticated query returned `unauthenticated`.
- Legacy/draft trip query returned `malformed_legacy_data`.
- A bounded search did not find a syntactically valid missing Convex trip ID in the current development deployment, so the implemented `not_found` branch was not exercised without adding destructive or test-only code.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- `npx convex codegen` passed.
- Source scans found no Google Places, Mapbox, Arcjet, billing, OpenRouter secret access, fetch calls, or non-ASCII edits in the touched path.

Open issues:
- Full browser E2E through Clerk still requires signing into the local app with a Clerk test user to view an actual saved trip page.
- The `not_found` state is implemented for valid Convex IDs that no longer exist, but it was not automatically reproduced because this milestone did not add deletion/debug code.
- Existing development Convex data still includes legacy test trips from earlier milestones; those now render a distinct legacy-data state.
- If it has not already been rotated, the existing `OPEN_ROUTER_API_KEY` should be rotated in OpenRouter and replaced in `.env.local` because it was accidentally printed in terminal output during Milestone 13.

Next milestone:
- Milestone 18

## Milestone 18 - Trip Presentation Components

Changed:
- Added a pure trip presentation adapter in `lib/trips/presentation.ts` that validates stored model payloads and normalizes display data.
- Added focused trip presentation components for the summary/header, hotel list/cards, day-by-day timeline, and activity/place cards.
- Rendered stored itinerary content defensively with optional field handling and fallback messages.
- Labeled unverified prices and place details as AI-generated estimates.
- Added local photo placeholders for hotels and activities without calling Google Places.
- Reworked the saved trip view container to handle Convex view states and pass valid trip data directly to presentation components.
- Kept Google Places, Mapbox, payments, Arcjet, external fetches, and new dependencies out of this milestone.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `sed -n ... components/trips/saved-trip-detail.tsx lib/ai/contract.ts app/(app)/view-trip/[tripId]/page.tsx convex/trips.ts`
- `node ... in-memory TypeScript smoke test for buildTripPresentation`
- `npm run lint`
- `npm run build`
- `rg -nP '[^\\x00-\\x7F]' app components convex lib docs`
- `rg "Google Places|GOOGLE_PLACE|mapbox|Mapbox|arcjet|billing|OPEN_ROUTER_API_KEY|OPEN_ROUTER_MODEL|fetch\\(|axios|Aceternity|Magic UI" ...`

Results:
- Pure presentation smoke test passed for a 1-day trip, a 7-day trip, long place names, missing optional hotel/place fields, and malformed missing payload rejection.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- Source scans found no Google Places, Mapbox, Arcjet, billing, OpenRouter secret access, fetch/Axios usage, Aceternity/Magic UI dependency, or non-ASCII edits in the touched path.

Open issues:
- Full browser E2E through Clerk still requires signing into the local app with a Clerk test user and opening a saved trip.
- Place photos are placeholders until revised Geoapify enrichment is implemented.
- If it has not already been rotated, the existing `OPEN_ROUTER_API_KEY` should be rotated in OpenRouter and replaced in `.env.local` because it was accidentally printed in terminal output during Milestone 13.

Next milestone:
- Milestone 19

## Milestone 19 - My Trips

Changed:
- Replaced the `/my-trips` placeholder with a signed-in saved-trip dashboard.
- Added `components/trips/my-trips-dashboard.tsx` using the owner-scoped `trips:listCurrentUserTrips` Convex query.
- Added responsive saved-trip cards with destination, source, duration, budget/group label, created date, status, enrichment state, placeholder imagery, and links to `/view-trip/[tripId]`.
- Added a loading skeleton, empty state with Create Trip CTA, and route-level error state.
- Added a pure `lib/trips/dashboard.ts` adapter for defensive card formatting.
- Kept sorting newest first through the existing `by_owner_created_at` index and `order("desc")` query.
- Did not add delete/archive, Google Places, Mapbox, billing, Arcjet, external fetches, or dependencies.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `sed -n ... app/(app)/my-trips/page.tsx components/trips/*.tsx lib/trips/*.ts convex/trips.ts`
- `npm run lint`
- `npm run build`
- `node --input-type=module ... Convex list dashboard smoke test`
- `rg -nP '[^\\x00-\\x7F]' app components convex lib docs`
- `rg "owner|email|userId|user_id|Google Places|GOOGLE_PLACE|mapbox|Mapbox|arcjet|billing|OPEN_ROUTER_API_KEY|OPEN_ROUTER_MODEL|fetch\\(|axios|delete|archive" ...`
- `curl -sS -o /tmp/m19-my-trips.html -D /tmp/m19-my-trips.headers -w '/my-trips %{http_code}\\n' http://localhost:3000/my-trips`

Results:
- Convex smoke test passed for a synthetic user with zero trips.
- Convex smoke test passed for a synthetic user with one saved trip.
- Convex smoke test passed for a synthetic user with several saved trips.
- Newest-first ordering was verified for newly created synthetic fixtures.
- A second synthetic user could not see another user's trips.
- Signed-out `/my-trips` returned HTTP 307 to the sign-in flow.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- Source scans found no route/query owner, email, or user ID parameter handling in the dashboard path, and no Google Places, Mapbox, Arcjet, billing, fetch/Axios, delete/archive, or non-ASCII edits.

Open issues:
- Full authenticated browser E2E through Clerk still requires signing into the local app with a Clerk test user and opening `/my-trips`.
- Trip card images remain placeholders until revised Geoapify enrichment is implemented.
- If it has not already been rotated, the existing `OPEN_ROUTER_API_KEY` should be rotated in OpenRouter and replaced in `.env.local` because it was accidentally printed in terminal output during Milestone 13.

Next milestone:
- Milestone 19A

## Milestone 19A - Place Provider Migration: Google Places to Geoapify

Changed:
- Updated current source-of-truth docs so Geoapify is the selected place-enrichment provider instead of Google Places API (New).
- Recorded the architecture deviation explicitly: original provider was Google Places API (New), replacement provider is Geoapify, and the reason is the unavailable Google Cloud billing/payment prerequisite.
- Documented that Geoapify calls are server-only through a future internal `app/api/place-enrichment/route.ts` boundary.
- Documented `GEOAPIFY_API_KEY` as server-only and explicitly prohibited `NEXT_PUBLIC_GEOAPIFY_API_KEY`.
- Documented the future provider-neutral enriched place contract: provider, providerPlaceId, displayName, formattedAddress, location, optional image, and attribution metadata.
- Updated active AI validation and prompt wording to say provider enrichment, not Google, supplies canonical place data.
- Preserved historical notes about earlier prompts; Google-specific historical mentions are superseded by this migration.
- Did not add a Geoapify runtime route, API call, dependency, or UI behavior change.

Commands run:
- `git status --short --branch && git branch --show-current`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `rg -n -i "Google Places|Places API \\(New\\)|GOOGLE_PLACE_API_KEY|NEXT_PUBLIC_GOOGLE_PLACE_API_KEY|canonical Google|Google place|Google photo|photo resource names|canonical coordinates|canonical location|placeId|coordinates|photos|photo" ...`
- `rg -n "GOOGLE_PLACE_API_KEY|NEXT_PUBLIC_GOOGLE_PLACE_API_KEY|NEXT_PUBLIC_GEOAPIFY_API_KEY|GEOAPIFY_API_KEY|Google Places|Geoapify|placeId|providerPlaceId|canonical" ...`
- `node -e "... checked place-provider environment variable names without printing values ..."`
- `npm run lint`
- `npm run build`

Results:
- Current architecture, spec, decisions, and environment docs identify Geoapify as the future place-enrichment provider.
- `GEOAPIFY_API_KEY` is documented server-only.
- `NEXT_PUBLIC_GEOAPIFY_API_KEY` is documented only as prohibited.
- `.env.local` contains `GEOAPIFY_API_KEY` by name, and no public Geoapify or Google place-provider key names were present.
- No Geoapify network call was implemented.
- No new dependency was installed.
- AI-generated coordinates remain non-authoritative.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.

Open issues:
- Revised Prompt 20 must implement Geoapify enrichment and respect Geoapify free-plan plus OpenStreetMap attribution requirements.
- Configure `GEOAPIFY_API_KEY` in deployment environments when Revised Prompt 20 is implemented; no value was printed in this milestone.

Next milestone:
- Revised Prompt 20

## Revised Prompt 20 - Geoapify Server Place Adapter

Changed:
- Added the authenticated provider-neutral `app/api/place-enrichment/route.ts` server route.
- Added `lib/places/place-enrichment.ts` with the internal `PlaceEnrichment` type, request validation, request length limits, search-text construction, and attribution metadata.
- Added `lib/places/geoapify.ts` as a server-only Geoapify adapter using built-in `fetch`.
- Implemented Geoapify Geocoding Search lookup with a small result limit and normalized `providerPlaceId`, display name, formatted address, and canonical coordinates.
- Implemented optional Geoapify Place Details lookup for `wiki_and_media.image`; details failures fall back to the base geocoding result.
- Added sanitized handling for missing configuration, no results, provider auth failures, rate/quota responses, malformed provider data, provider 5xx failures, and timeouts.
- Kept Geoapify URLs and the `GEOAPIFY_API_KEY` server-only; route JSON responses and development diagnostics do not include the key or full provider request URLs.
- Updated architecture and decision docs for the implemented route, server-only adapter, canonical provider coordinates, AI-coordinate hint policy, and attribution requirements.
- Did not modify stored trip data, add UI, add dependencies, or implement maps.

Commands run:
- `git status --short --branch && git branch --show-current`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `rg --files app lib components convex docs | sort`
- Official Geoapify documentation lookup for Geocoding Search, Place Details, and attribution requirements
- `npm run lint`
- `node --env-file=.env.local --experimental-strip-types --input-type=module -e "... attempted direct adapter smoke import ..."`
- `node --env-file=.env.local -e "... live Geoapify lookup with sanitized output ..."`
- `npm run dev`
- `curl -sS ... -X POST http://localhost:3000/api/place-enrichment ...`
- `npm run build`
- `rg -n "NEXT_PUBLIC_GEOAPIFY_API_KEY|GEOAPIFY_API_KEY|geoapify.com/v|apiKey|console\\.(log|warn|error)|axios|Google Places|GOOGLE_PLACE" app lib docs package.json`
- `node --experimental-strip-types --input-type=module -e "... place request parser smoke check ..."`
- `git diff --stat`

Results:
- `npm run lint` passed.
- Live Geoapify lookup for a public place returned a valid normalized shape with provider, providerPlaceId presence, display name, formatted address presence, finite coordinates, attribution provider, and optional image availability. No key or provider URL was printed.
- Signed-out POST to `/api/place-enrichment` returned HTTP 307 to `/sign-in`, verifying the route is protected.
- `npm run build` passed with Next.js 16.3.2 and included `/api/place-enrichment`.
- Parser smoke check accepted a trimmed valid request and rejected an overlong query plus a non-object body. Node emitted the existing module-type warning; no package metadata was changed.
- Direct adapter import through plain Node did not run because Node cannot resolve the app's Next.js `@/` path alias outside the Next build. The Next production build compiled the adapter successfully, and the live provider lookup was verified with the same documented endpoint/field contract.
- Source scan found no Axios dependency/use and no `NEXT_PUBLIC_GEOAPIFY_API_KEY` outside documentation that explicitly prohibits it.

Open issues:
- Full authenticated browser/API smoke through Clerk still requires signing in locally with a Clerk test user.
- Place enrichment is not persisted to Convex yet and stored trip data remains unchanged.
- Superseded by Milestone 24A: future map rendering uses Leaflet with
  OpenStreetMap-compatible tiles instead of Mapbox.

Next milestone:
- Milestone 21

## Milestone 21 - Place Enrichment in the UI

Changed:
- Added a client-side place enrichment layer in `components/trips/place-enrichment.tsx`.
- Hotel and activity cards now call only the internal `/api/place-enrichment` route and consume only the normalized `PlaceEnrichment` contract.
- Added a modest module-level in-memory lookup cache keyed by normalized semantic query, destination, city, and address context.
- Rendered canonical formatted address, providerPlaceId, and Geoapify coordinates for enriched hotels and activities.
- Added optional provider image rendering with HTTPS-only URL validation and stable image placeholders.
- Added stable loading, empty, and error states so one failed lookup does not break the itinerary.
- Added reusable Geoapify and OpenStreetMap attribution to the trip presentation.
- Extended shared response validation in `lib/places/place-enrichment.ts` so the client validates route responses before rendering.
- Documented that enrichment remains UI/in-memory only for now; no Convex schema or stored trip data was changed.
- Did not add Mapbox, dependencies, billing, Arcjet, or persistent caching.

Commands run:
- `git status --short --branch && git branch --show-current`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `sed -n ... components/trips/trip-presentation.tsx components/trips/saved-trip-detail.tsx lib/trips/presentation.ts app/api/place-enrichment/route.ts lib/places/place-enrichment.ts`
- `npm run lint`
- `node --experimental-strip-types --input-type=module -e "... normalized response/request parser smoke check ..."`
- `node --env-file=.env.local -e "... live Geoapify exact, ambiguous-with-context, and no-result lookups with sanitized output ..."`
- `node -e "... provider auth/error smoke with deliberately fake key ..."`
- `node --env-file=.env.local -e "... missing-image and Place Details failure smoke checks ..."`
- `npm run build`
- `rg -n "NEXT_PUBLIC_GEOAPIFY_API_KEY|GEOAPIFY_API_KEY|geoapify\\.com/v|apiKey|axios|mapbox|Mapbox|raw Geoapify|fetch\\(" app components lib docs package.json`
- `rg -n "providerPlaceId|formattedAddress|Canonical coordinates|PlaceAttributionNotice|usePlaceEnrichment|placeLookupCache|https:" components/trips lib/places app/api/place-enrichment docs/ARCHITECTURE.md docs/DECISIONS.md`
- `git diff --stat`

Results:
- `npm run lint` passed after adjusting the enrichment hook to avoid synchronous state writes inside effects.
- `npm run build` passed with Next.js 16.3.2.
- Shared parser smoke accepted a valid normalized place response, accepted a no-result error envelope, rejected malformed coordinates, and confirmed repeated semantic context normalizes consistently.
- Live exact lookup returned a provider place ID, formatted address, and finite coordinates.
- Live ambiguous lookup with destination context returned a provider place ID, formatted address, and finite coordinates.
- Live gibberish lookup returned zero results for the provider no-result case.
- Provider auth/error smoke returned a non-success provider status with a deliberately fake key value; no real key or URL was printed.
- Missing-image smoke found a geocoded place with no details image and verified the fallback condition.
- Place Details failure smoke returned a non-success details status, matching the adapter's non-fatal fallback path.
- Source scans found no public Geoapify key, no Axios, no Mapbox implementation, and UI fetches only to internal app routes.

Open issues:
- Full authenticated browser verification still requires signing in with a Clerk test user and opening a saved trip containing hotels and activities.
- Enriched canonical place data remains in-memory UI state only; persist it later only if map behavior requires it.
- The rate-limit UI path uses the same normalized error rendering as other provider errors; a live 429 was not intentionally triggered.

Next milestone:
- Milestone 22

## Milestone 22 - Arcjet Rate Limiting

Changed:
- Installed the allowed `@arcjet/next` dependency.
- Added the shared non-secret free generation policy in `lib/quota/free-generation-quota.ts`.
- Added the server-only Arcjet token-bucket adapter in `lib/quota/trip-generation.ts`.
- Protected only `/api/ai-itinerary` with Arcjet after request validation and before OpenRouter inference.
- Identified quota subjects with Clerk's server-verified stable `userId`.
- Added typed final-generation error envelopes for quota and configuration errors.
- Updated the create-trip UI to preserve the trip brief and show a quota message with a Pricing CTA when blocked.
- Documented quota boundaries, retry behavior, and the future paid bypass boundary.
- Did not rate-limit page loads, saved-trip reads, place enrichment, Convex queries, or ordinary route visits.

Commands run:
- `git status --short --branch && git branch --show-current`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `find app components lib convex docs -maxdepth 5 -type f | sort`
- Official Arcjet documentation lookup for Next.js, rate limiting, token bucket rules, and Clerk identity characteristics
- `npm install @arcjet/next`
- `rg -n "tokenBucket|rateLimit|ArcjetRateLimitReason|requested" node_modules/@arcjet node_modules/arcjet -g '*.d.ts'`
- `node --env-file=.env.local -e "... checked variable-name presence without printing values ..."`
- `npm run lint`
- `npm run build`
- `npm run start -- --port 3001`
- `curl -sS ... -X POST http://localhost:3001/api/ai-itinerary ...`
- `awk 'BEGIN{IGNORECASE=1} /^location:/{print}' /tmp/m22-ai-itinerary-unauth.headers`

Results:
- `npm install @arcjet/next` completed, audited 635 packages, and reported 0 vulnerabilities.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2 and included `/api/ai-itinerary`.
- Signed-out POST to `/api/ai-itinerary` returned HTTP 307 to `/sign-in`, verifying unauthenticated calls are rejected before quota or AI work.
- `ARCJET_KEY` is missing by environment variable name-presence check, so live Arcjet allowed, rapid duplicate, and exhausted-quota tests were not run.
- No Arcjet key, OpenRouter key, Clerk secret, or other secret value was printed.

Open issues:
- Add `ARCJET_KEY` to `.env.local` and deployment environments before live final-generation quota enforcement can work.
- After `ARCJET_KEY` is configured, run one authenticated allowed generation, a rapid duplicate-click check, and an exhausted-quota check.
- Premium quota bypass remains deferred to the Clerk Billing milestone.

Next milestone:
- Milestone 23

## Milestone 23 - Clerk Billing UI

Changed:
- Replaced the `/pricing` placeholder with Clerk's current `PricingTable` component from `@clerk/nextjs`.
- Configured the pricing table for user/B2C plans and set successful checkout continuation to `/create-trip`.
- Kept `/pricing` public so signed-out users can review plans before signing in.
- Kept the existing free-quota CTA path from create-trip quota errors to `/pricing`.
- Left `UserButton` as the account-management entry point; Clerk-managed billing management appears there when user billing plans are enabled and public in Clerk.
- Documented that Clerk Billing owns checkout/subscription state and that Convex must not duplicate subscription status as security truth.
- Did not hardcode a paid plan, feature, or entitlement slug.
- Did not implement paid Arcjet bypass or AI authorization changes.
- Did not add dependencies or integrate Stripe directly.

Commands run:
- `git status --short --branch && git branch --show-current`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `rg -n "PricingTable|UserButton|billing|Billing|plan|subscription|commerce|organizationProfile|userProfile" node_modules/@clerk/nextjs ...`
- Official Clerk Billing documentation lookup for B2C plans, `PricingTable`, `UserButton`, and subscription management
- `npm run lint`
- `npm run build`
- `npm run start -- --port 3001`
- `curl -sS -o /tmp/m23-pricing.html -D /tmp/m23-pricing.headers -w '%{http_code}\\n' http://localhost:3001/pricing`
- `node --env-file=.env.local -e "... checked Clerk variable-name presence without printing secret values ..."`

Results:
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2 and included `/pricing`.
- Production `/pricing` returned HTTP 200 and rendered the page shell with Clerk Billing copy and the Clerk `PricingTable` client component boundary.
- Required Clerk variable names are present by name-presence check.
- No plan, feature, entitlement slug, checkout status, or subscription state was duplicated into Convex.

Open issues:
- Clerk Dashboard setup still needs to be completed or confirmed:
  1. Enable Billing in the Clerk Dashboard for this development instance.
  2. Use Clerk's development payment gateway for local/test checkout.
  3. Create a user/B2C paid subscription plan.
  4. Mark the plan publicly available so it appears in `PricingTable`.
  5. Add a feature/entitlement for unlimited trip generation and record the exact slug before Milestone 24.
  6. Verify `/pricing` visually while signed out and signed in.
  7. Complete a test checkout and confirm Clerk account management exposes subscription management.
- Paid users still do not bypass Arcjet. That belongs to Milestone 24 after the exact entitlement slug is confirmed.

Next milestone:
- Milestone 24 after Clerk Dashboard setup and checkout verification

## Milestone 24 - Clerk Billing Paid Access

Changed:
- Added `lib/billing/trip-generation-access.ts` with the confirmed Clerk Billing feature key `unlimited_trip_generation`.
- Updated `/api/ai-itinerary` to authenticate with Clerk, check `authObject.has({ feature })` server-side, and bypass the free Arcjet token-bucket quota only for premium users.
- Kept final-generation request validation and OpenRouter response validation for both free and premium users.
- Returned a small typed access status (`free` or `premium`, plus whether quota was enforced) in final-generation responses.
- Updated the create-trip reducer and final-generation UI to show a Free/Premium status badge from the server response.
- Preserved the quota-block Pricing CTA for free users.
- Corrected create-trip preview copy so it no longer says quota and billing are disconnected.
- Documented that Clerk remains the billing authority and Convex does not store premium status as security truth.
- Did not accept client-supplied `isPremium`, plan names, subscription flags, or entitlement claims.
- Did not add dependencies, Stripe integration, Mapbox, or new persistence.
- Corrected the entitlement value after Clerk dashboard setup confirmation: current Clerk B2C Billing docs check features with the configured dashboard slug directly, and the installed SDK type accepts the exact slug even though autocomplete suggests scoped examples.

Commands run:
- `git status --short --branch && git branch --show-current`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `node --env-file=.env.local -e "... checked required variable-name presence without printing values ..."`
- `node -e "... listed matching .env.local variable names only ..."`
- `rg -n "unlimited_trip_generation|ENTITLE|FEATURE|PLAN|PREMIUM|Billing|billing|has\\(" app components lib docs convex package.json -g '!*.js'`
- Official Clerk authorization and B2C Billing documentation lookup
- Inspected installed `@clerk/shared` types for `CheckAuthorizationParams`, `FeatureProtectParams`, and `Autocomplete`
- `rg -n "user:unlimited_trip_generation|unlimited_trip_generation" app components lib docs package.json`
- `npm run lint`
- `npm run build`
- Direct Arcjet token-bucket smoke with a synthetic user ID
- `npm run start -- --port 3001`
- `curl -sS ... -X POST http://localhost:3001/api/ai-itinerary ...`

Results:
- `ARCJET_KEY`, Clerk keys, and OpenRouter variable names are present by name-presence check. Values were not printed.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2 and included `/api/ai-itinerary`.
- Signed-out POST to `/api/ai-itinerary` returned HTTP 307 to the sign-in flow, verifying unauthenticated calls are still rejected before quota or AI work.
- Direct Arcjet smoke used a synthetic user ID and returned safe decision metadata only. It verified Arcjet key connectivity and rate-limit decisions, but local direct calls returned `ALLOW` twice, so browser-authenticated quota exhaustion should still be verified in-app.
- The premium bypass path is implemented through Clerk's server-verified `has({ feature: "unlimited_trip_generation" })` check. No client flag can authorize premium access.
- After the dashboard confirmation correction, no active `user:unlimited_trip_generation` references remain. The production build passed, which verifies the installed Clerk type surface accepts the exact dashboard slug.

Open issues:
- Full premium-user verification requires signing in with a Clerk test user that has the `unlimited_trip_generation` feature through Clerk Billing, then generating an itinerary and confirming the Premium badge plus quota bypass.
- Full free exhausted verification should be done in the browser with a signed-in free Clerk user because the standalone Arcjet script does not reliably simulate the full Next.js request context.
- No separate Arcjet bot/security rules are configured yet; if added later, they should run for both free and premium users.

Next milestone:
- Milestone 24A

## Milestone 24A - Map Provider Migration: Mapbox to Leaflet + OpenStreetMap

Changed:
- Updated current source-of-truth docs so future map work uses Leaflet with an OpenStreetMap-compatible tile layer instead of Mapbox GL JS.
- Recorded the architecture deviation explicitly: original provider was Mapbox, replacement approach is Leaflet plus OpenStreetMap-compatible tiles, and the reason is unavailable Mapbox payment-method onboarding.
- Removed `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` as a current environment requirement.
- Documented that no Leaflet or OpenStreetMap secret is required for the selected setup.
- Documented the provider-neutral future map contract: normalized Geoapify coordinates feed a Leaflet client map with OSM-compatible tiles, markers, and popups.
- Documented that Geoapify remains server-side and authoritative for canonical map coordinates and provider place IDs.
- Documented that OpenStreetMap attribution and tile usage obligations must be respected, and that public OSM tiles are not an unlimited production CDN or SLA-backed service.
- Updated active create-trip preview copy to refer to the future Leaflet map milestone.
- Marked the older Mapbox future-work note as superseded by this migration.
- Preserved working behavior through Milestone 24. No map dependency, map component, runtime refactor, or Prompt 25 work was added.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `rg -n -i "mapbox|mapbox-gl|NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN|Mapbox token|Mapbox globe|WebGL|3D route|3D map|public Mapbox|canonical Mapbox|globe" . -g '!node_modules' -g '!.next' -g '!.git'`
- `rg -n -i "map|coordinates|providerPlaceId|location|Geoapify|OpenStreetMap|tile|attribution" app components lib convex docs -g '!node_modules' -g '!.next'`
- `rg -n -i "leaflet|OpenStreetMap|OSM|tile|NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN|Mapbox" docs/PROJECT_SPEC.md docs/ARCHITECTURE.md docs/DECISIONS.md docs/ENVIRONMENT.md components/create-trip/trip-preview-panel.tsx`
- `node -e "... checked leaflet/react-leaflet/mapbox-gl dependency absence ..."`
- Official OpenStreetMap tile usage policy lookup
- `npm run lint`
- `npm run build`

Results:
- Current product, architecture, decision, and environment docs identify Leaflet plus OpenStreetMap-compatible tiles as the future map approach.
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is no longer documented as a required current environment variable.
- No `leaflet`, `react-leaflet`, `mapbox-gl`, or map implementation dependency was installed.
- Active code has no Mapbox integration; only historical progress notes mention Mapbox as earlier non-implementation history or as superseded by this migration.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.

Open issues:
- Future map implementation must choose a tile URL in application code/configuration, include visible attribution, and respect the selected tile provider policy.
- If production traffic exceeds appropriate use of public OSM standard tiles, switch to a suitable OSM-derived tile provider or self-hosted tiles before launch.

Next milestone:
- Milestone 25

## Milestone 25 - Leaflet Interactive Map

Changed:
- Verified Leaflet's current stable package before installation. Leaflet 1.9.4 is the stable/latest release; Leaflet 2.0.0-alpha.1 remains alpha and was not used.
- Installed `leaflet@1.9.4`.
- Added `@types/leaflet` only after confirming the installed Leaflet package does not ship TypeScript declaration files.
- Imported Leaflet CSS from `app/layout.tsx`, which is the existing Next.js global CSS boundary.
- Added `components/trips/trip-map.tsx` as a dedicated client component that dynamically imports Leaflet inside `useEffect`.
- Initialized `L.map` with a ref container, guarded against double initialization, invalidated size after render, and called `map.remove()` on cleanup.
- Added the application-controlled standard HTTPS OpenStreetMap tile URL with visible OpenStreetMap attribution.
- Centered the map on one canonical Geoapify-enriched place when available. If enrichment is unavailable, the map uses a documented global fallback center.
- Added the map to saved-trip presentation without itinerary markers, popups, clustering, extra plugins, map tokens, or map environment variables.
- Reused the existing normalized place-enrichment contract and did not depend on raw Geoapify JSON or AI coordinates.
- Documented the implemented Leaflet boundary and OSM tile policy constraints.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/*.md package.json`
- Official Leaflet documentation/package lookup
- Official OpenStreetMap tile usage policy lookup
- `npm view leaflet version types typings dist-tags --json`
- `npm install leaflet@1.9.4`
- `find node_modules/leaflet -maxdepth 3 \( -name '*.d.ts' -o -name 'leaflet.css' \) -print`
- `npm install -D @types/leaflet`
- `npm run lint`
- `npm run build`
- `npm run start -- --port 3001`
- `curl -sS ... http://localhost:3001/`
- `curl -sS ... http://localhost:3001/view-trip/sample`
- `npm ls leaflet @types/leaflet --depth=0`
- `rg -n "leaflet|tile\\.openstreetmap|NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN|mapbox-gl|react-leaflet|GEOAPIFY_API_KEY|OPEN_ROUTER_API_KEY|CLERK_SECRET_KEY" app components lib docs package.json next.config.ts`

Results:
- `npm install leaflet@1.9.4` completed and reported 0 vulnerabilities.
- `npm install -D @types/leaflet` completed and reported 0 vulnerabilities.
- `npm run lint` passed after fixing a React refs rule in the Leaflet lifecycle code.
- `npm run build` passed with Next.js 16.3.2 and included `/view-trip/[tripId]`.
- Production `/` returned HTTP 200.
- Signed-out production `/view-trip/sample` returned HTTP 307 to Clerk sign-in, so protected trip-map rendering remains behind authentication.
- `npm ls` shows `leaflet@1.9.4` and `@types/leaflet@1.9.22`.
- Source scan found the tile URL only as an application-controlled constant and found no `mapbox-gl` or `react-leaflet` dependency/use.
- No Geoapify, OpenRouter, Clerk, Arcjet, or map secret values were printed or moved client-side.

Open issues:
- Authenticated browser verification still needs to be completed with a Clerk session and a saved trip: open a saved trip, confirm the Leaflet map renders, navigate away/back, resize the viewport, and confirm no duplicate-map or hydration errors appear under React Strict Mode.
- Public OSM standard tiles remain suitable for development and modest use only. Production launch should re-evaluate traffic and switch to an appropriate OSM-derived tile provider or self-hosted tiles if needed.

Next milestone:
- Milestone 26

## Milestone 26 - Leaflet Markers and Interaction

Changed:
- Added `lib/trips/map.ts` with pure helpers that build normalized map lookup requests from hotels and activities and deduplicate enriched places by `providerPlaceId`.
- Extended the place-enrichment client module with a shared multi-lookup hook so the map and trip cards reuse the same normalized `/api/place-enrichment` cache.
- Updated the Leaflet map to render one marker per unique canonical Geoapify-enriched place and skip places without verified provider coordinates.
- Used a project-owned Leaflet `divIcon` marker style so the app does not depend on default Leaflet marker image asset paths in the Next.js bundle.
- Built Leaflet popups with DOM text nodes for place name, day label, and formatted address. No AI or itinerary HTML is passed into `bindPopup` or `setContent`.
- Added card-to-map focus through each canonical place panel's `Show on map` button.
- Added marker-to-card focus and smooth scroll through `data-provider-place-id`, without making the card state drive another marker event loop.
- Cleaned up marker layers, marker listeners, marker refs, and the Leaflet map on data changes and unmount.
- Kept the OpenStreetMap attribution control visible and kept the app-controlled OSM tile URL.
- Documented marker, popup, and interaction boundaries in architecture and decisions docs.
- Did not add clustering, extra map plugins, arbitrary tile URLs, new secrets, or server-side map logic.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/*.md package.json`
- Official Leaflet marker, popup, `divIcon`, layer group, `fitBounds`, and `flyTo` documentation lookup
- `npm run lint`
- `node <<'NODE' ... marker helper smoke for 0, 1, 21, duplicate providerPlaceId, and missing coordinates ... NODE`
- `npm run build`
- `npm run lint && npm run build`
- `npm run start -- --port 3001`
- `curl -sS ... http://localhost:3001/`
- `curl -sS ... http://localhost:3001/view-trip/sample`
- `rg -n "bindPopup|setContent|dangerouslySetInnerHTML|innerHTML|divIcon|marker\\(|layerGroup|flyTo|fitBounds|scrollIntoView|tile\\.openstreetmap|NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN|react-leaflet|mapbox-gl|GEOAPIFY_API_KEY|OPEN_ROUTER_API_KEY|CLERK_SECRET_KEY" app components lib docs package.json`

Results:
- `npm run lint` passed cleanly.
- Marker helper smoke passed for 0 markers, 1 marker, 21 markers, repeated `providerPlaceId` deduplication, and malformed/missing coordinates being rejected before mapping.
- `npm run build` passed with Next.js 16.3.2 and included `/view-trip/[tripId]`.
- Production `/` returned HTTP 200.
- Signed-out production `/view-trip/sample` returned HTTP 307 to Clerk sign-in.
- Source scan found project-owned `divIcon`, marker/layer cleanup APIs, DOM-built popup binding, app-controlled OSM tile URL, and no `react-leaflet`, `mapbox-gl`, or public map-token requirement.
- No Geoapify, OpenRouter, Clerk, Arcjet, or map secret values were printed or moved client-side.

Open issues:
- Authenticated browser verification still needs a Clerk session and saved trip with enriched places: confirm 0-marker fallback, 1 marker, many markers, duplicate places, card-to-map focus, marker-to-card scroll, resize behavior, and navigation away/back without duplicate marker layers.
- Public OSM standard tiles remain suitable for development and modest use only. Production launch should re-evaluate traffic and switch to an appropriate OSM-derived tile provider or self-hosted tiles if needed.

Next milestone:
- Milestone 27

## Milestone 27 - UX Resilience

Changed:
- Added `lib/errors/user-safe-error.ts` as a small typed error model that separates user-safe messages from minimal internal diagnostic tags.
- Added unmount cancellation cleanup for create-trip conversational and final itinerary requests so stale responses do not update the UI after navigation/reset.
- Replaced client-side AI/save diagnostic console noise with user-safe retry messages that preserve collected requirements, generated itineraries, and failed-save state.
- Made Clerk Billing entitlement verification recoverable at the final itinerary server boundary. If premium entitlement cannot be checked, the route applies the free quota and returns a safe access notice instead of crashing.
- Extended final itinerary access parsing and UI display to support that safe billing notice.
- Added per-card Geoapify enrichment retry controls that retry only the failed place lookup and do not regenerate the AI itinerary.
- Added AbortController support for direct place-enrichment card lookups and guarded aborted lookups from becoming sticky cache entries.
- Added Leaflet initialization and OpenStreetMap tile-load failure messages that keep itinerary text and canonical coordinates visible.
- Added a route-level error boundary for `/view-trip/[tripId]` so unexpected saved-trip render/load failures can be retried or navigated away from safely.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/*.md package.json`
- `rg -n "console\\.|throw new Error|fetch\\(|has\\(|quota|error" components app lib`
- `npm run lint`
- `npm run build`
- `npm run dev`
- `curl -s -o /tmp/place-enrichment.out -w "%{http_code} %{content_type}\\n" -X POST http://localhost:3000/api/place-enrichment ...`
- `curl -s -o /tmp/ai-itinerary.out -w "%{http_code} %{content_type}\\n" -X POST http://localhost:3000/api/ai-itinerary ...`
- `curl -s -o /tmp/view-trip.out -w "%{http_code} %{content_type}\\n" http://localhost:3000/view-trip/not-a-trip`

Results:
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- Signed-out `/api/place-enrichment` returned HTTP 307 before any Geoapify lookup.
- Signed-out `/api/ai-itinerary` returned HTTP 307 before any Arcjet/OpenRouter work.
- Signed-out `/view-trip/not-a-trip` returned HTTP 307 to Clerk protection.
- No secret values, full auth tokens, full prompts, or Geoapify provider URLs were printed.
- No dependencies were added.

Open issues:
- Authenticated browser failure-path verification still needs a signed-in Clerk session and saved trips: test AI malformed/provider failures, Arcjet 429 quota UI, Convex save retry, Geoapify no-result/rate/auth failures, Leaflet tile failure, and billing entitlement unavailable behavior in the browser.
- Place-enrichment map/list bulk lookups still use shared promise deduplication and active-state cleanup. Direct card lookups have abort support; a future persistent enrichment cache can make bulk cancellation more granular if needed.

Next milestone:
- Milestone 28

## Milestone 28 - Security and Privacy Audit

Changed:
- Added `docs/SECURITY_REVIEW.md` with findings, fixes, verified controls, OSM tile policy notes, and remaining risks.
- Tightened Geoapify optional image normalization so only HTTPS image URLs enter the normalized provider contract.
- Tightened place-enrichment response parsing so non-HTTPS provider image URLs are rejected before UI state.
- Confirmed `.env*` files are ignored and no `.env*` files are tracked.
- Confirmed forbidden public place/map variables are absent by name: `NEXT_PUBLIC_GEOAPIFY_API_KEY`, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, `GOOGLE_PLACE_API_KEY`, and `NEXT_PUBLIC_GOOGLE_PLACE_API_KEY`.
- Confirmed active Mapbox and Google Places runtime assumptions are absent; remaining mentions are historical/superseded docs.
- Confirmed Convex owner authorization derives from Clerk/Convex identity and does not accept client-provided owner, user, email, premium, plan, or subscription flags as authorization.
- Confirmed Geoapify and Leaflet provider URLs are application/server-controlled constants and not client-supplied backend URLs.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/PROJECT_SPEC.md docs/ARCHITECTURE.md docs/DECISIONS.md docs/ENVIRONMENT.md docs/PROGRESS.md package.json`
- `git check-ignore -v .env.local .env .env.development .env.production`
- `git ls-files '.env*'`
- Official OpenStreetMap tile usage policy lookup
- `rg -n "(CLERK_SECRET_KEY|ARCJET_KEY|OPEN_ROUTER_API_KEY|OPEN_ROUTER_MODEL|GEOAPIFY_API_KEY|NEXT_PUBLIC_GEOAPIFY_API_KEY|NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN|GOOGLE_PLACE_API_KEY|NEXT_PUBLIC_GOOGLE_PLACE_API_KEY|CONVEX_DEPLOYMENT|CLERK_JWT_ISSUER_DOMAIN|sk-|pk_live|sk_live|sk_test|apiKey|secret|token|password)" ...`
- `rg -n "(dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML|bindPopup|setContent|new URL\\(|fetch\\(|redirect\\(|router\\.push|window\\.location|href=|src=|backgroundImage|tileLayer|tile\\.openstreetmap|mapbox|Mapbox|NEXT_PUBLIC_MAPBOX|GOOGLE_PLACE|Geoapify|geoapify)" ...`
- `rg -n "(ownerIdentityKey|userId|user_id|email|isPremium|premium|planName|subscription|has\\(|auth\\.protect|getUserIdentity|tokenIdentifier)" ...`
- `rg -n "(BEGIN .*KEY|PRIVATE KEY|sk-[A-Za-z0-9]|sk_or|pk_live|sk_live|sk_test|AIza|eyJ[A-Za-z0-9_-]{20,}|password\\s*=|secret\\s*=|token\\s*=|apiKey\\s*=)" ...`
- `node --env-file=.env.local -e "... variable-name presence check without printing values ..."`
- `npm audit --audit-level=moderate`
- `npm run lint`
- `npm run build`

Results:
- No secret values were printed.
- `.env.local`, `.env`, `.env.development`, and `.env.production` are ignored by `.gitignore`.
- No `.env*` files are tracked by Git.
- Name-only environment check reported required configured variables present and forbidden public Geoapify/Mapbox/Google place variables missing.
- `npm audit --audit-level=moderate` reported 0 vulnerabilities.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- OSM policy review confirmed the current HTTPS standard tile URL and visible attribution are required, public tiles are best-effort/no-SLA, and bulk/preload/offline tile scraping is prohibited.

Open issues:
- If the OpenRouter key previously printed during Milestone 13 has not already been rotated, rotate it in OpenRouter and update `.env.local` and deployment environments.
- Authenticated browser testing is still needed for real Clerk sessions, Convex owner isolation, premium entitlement behavior, Arcjet exhaustion, Geoapify provider failures, and Leaflet tile failures.
- Public OSM standard tiles should be re-evaluated before production traffic; use an appropriate OSM-derived provider or self-hosted tiles if expected use exceeds modest interactive viewing.
- No separate Arcjet bot/security rule currently protects premium users. Future abuse controls should apply to both free and premium users.

Next milestone:
- Milestone 29

## Milestone 29 - Automated Tests

Changed:
- Added Vitest 4.1.11 as the smallest project test runner for Node-mode pure TypeScript tests.
- Added `vitest.config.mts` with a local `server-only` test alias so server-only modules can be imported by Node tests without changing production boundaries.
- Added `npm test` and `npm run test:watch` scripts.
- Added test commands to `README.md` and `AGENTS.md`.
- Added AI contract tests for valid conversational responses, invalid selectors, valid final itineraries, malformed itineraries, and day-count validation.
- Added create-trip state tests for validation, compact requirements, requirement updates, AI success transition, and final-readiness checks.
- Added mocked Geoapify adapter tests for successful geocoding/details, no result, malformed coordinates, auth/quota/provider errors, details failure fallback, and HTTPS-only image handling.
- Added pure billing access tests for free quota enforcement and premium quota bypass.
- Added pure map tests for providerPlaceId deduplication, coordinate validation, fixed HTTPS OSM tile config, fallback/canonical center selection, and marker popup text modeling.
- Moved Leaflet-facing constants and marker text data into `lib/trips/map.ts` so they can be tested without live OSM tile requests or browser map initialization.
- Kept Convex authorization test coverage limited to audit/static review. A full supported Convex function test pattern would require an additional dedicated Convex test harness dependency, so it was not added in this milestone.
- Did not add browser smoke automation because signed-in Clerk and Convex flows need a practical mocked auth/browser harness that is beyond the smallest runner setup.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/PROJECT_SPEC.md docs/ARCHITECTURE.md docs/DECISIONS.md docs/PROGRESS.md package.json`
- `rg --files -g '*test*' -g '*spec*' -g 'vitest.config.*' -g 'jest.config.*' -g 'playwright.config.*' -g 'cypress.config.*' -g 'tsconfig*.json'`
- `rg -n "(vitest|jest|playwright|cypress|node:test|describe\\(|it\\(|test\\()" . -g '!node_modules' -g '!.next' -g '!.git'`
- `npm view vitest version peerDependencies engines --json`
- `npm install -D vitest@4.1.11`
- `npm test`
- `npm audit --audit-level=moderate`
- `npm run lint`
- `npm run build`

Results:
- No real API keys were added to tests.
- Tests use fixtures and mocks; they do not call Geoapify, OpenStreetMap tiles, Clerk Billing, OpenRouter, Arcjet, Convex, or other external providers.
- `npm test` passed: 4 test files, 24 tests.
- `npm audit --audit-level=moderate` reported 0 vulnerabilities.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.

Open issues:
- Add Convex function-level tests later if a dedicated Convex test harness is approved.
- Add browser smoke automation later when a signed-in Clerk test strategy and mocked provider/data layer are defined.
- npm reported allow-scripts review warnings for `esbuild` and `unrs-resolver`; no script approval was performed.

Next milestone:
- Milestone 30

## Milestone 30 - Responsive + Accessibility + Performance

Changed:
- Added explicit labels, helper descriptions, and error associations for the generated source, destination, duration, and group-size form controls.
- Added accessible group labeling for budget and group-type selector button groups.
- Tightened the public header for narrow screens with wrapping, truncation, and non-shrinking auth controls.
- Reduced the default mobile/tablet Leaflet map height while preserving a larger desktop map.
- Made map focus transitions respect `prefers-reduced-motion`: map focus uses `setView` instead of `flyTo`, card scrolling uses automatic scrolling, and CSS transitions/animations are minimized for reduced-motion users.
- Confirmed existing protections for optional Geoapify images, OpenStreetMap attribution, Leaflet cleanup, popup text construction, and deduplicated place-enrichment requests remained intact.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/PROJECT_SPEC.md docs/ARCHITECTURE.md docs/DECISIONS.md docs/ENVIRONMENT.md docs/PROGRESS.md package.json`
- `npm ls @playwright/test playwright lighthouse --depth=0 || true`
- `which chromium; which chromium-browser; which google-chrome; which lighthouse; test -x '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' ...`
- `sed -n ... components/create-trip/generative-ui.tsx components/trips/trip-map.tsx components/trips/place-enrichment.tsx components/trips/trip-presentation.tsx components/trips/my-trips-dashboard.tsx components/trips/saved-trip-detail.tsx components/landing/site-header.tsx components/auth/auth-controls.tsx app/globals.css`
- `npm test`
- `npm run lint`
- `npm run build`
- `npm run dev`
- Headless Chrome responsive route/viewport check for `/`, `/pricing`, `/create-trip`, `/my-trips`, and `/view-trip/m30-smoke` at 360px, 768px, 1366px, and 1920px widths.

Results:
- `npm test` passed: 4 test files, 24 tests.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- Headless Chrome found no horizontal overflow on `/` or `/pricing` at phone, tablet, laptop, or wide desktop widths.
- Protected pages redirected to Clerk sign-in at all tested widths when no browser session was present, as expected.
- Lighthouse was not run because no local `lighthouse` package or command is installed, and this milestone does not allow adding dependencies.
- Playwright was not run because no local Playwright dependency is installed, and this milestone does not allow adding dependencies.

Open issues:
- Authenticated responsive browser testing still needs a signed-in Clerk session and saved trips: complete `/create-trip`, `/my-trips`, and `/view-trip/[tripId]` visual checks with real Convex data, including Leaflet map rendering, marker/card focus, and attribution readability.
- Lighthouse diagnostics can be added later if a performance audit dependency/tooling is approved.
- Public OpenStreetMap standard tiles remain for development/modest use; production traffic should re-evaluate tile-provider capacity before launch.

Next milestone:
- Milestone 31

## Milestone 31 - Production Build + Vercel Prep

Changed:
- Added Node.js `24.x` and npm `11.x` engine assumptions to `package.json` and lockfile metadata.
- Added `build:vercel` so Vercel can run Convex deploy before the Next.js production build while explicitly setting `NEXT_PUBLIC_CONVEX_URL` for the client bundle.
- Added `docs/PRODUCTION.md` with Vercel, Convex, Clerk, OpenRouter, Arcjet, Geoapify, Leaflet, OpenStreetMap, and post-deploy smoke checklists.
- Updated `docs/ENVIRONMENT.md` with `CONVEX_DEPLOY_KEY` as build/CI-only and reiterated that `.env.local` must not be copied to production.
- Updated `docs/DECISIONS.md` with production deployment decisions.
- Replaced the default Next.js README deployment text with a pointer to the project production checklist.
- Confirmed no Mapbox account/token production prerequisite remains.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/PROJECT_SPEC.md docs/ARCHITECTURE.md docs/DECISIONS.md docs/ENVIRONMENT.md docs/PROGRESS.md package.json`
- Official Convex Vercel deployment documentation lookup
- Official Convex `npx convex deploy` CLI documentation lookup
- Official Vercel Node.js runtime/version documentation lookup
- Official Next.js Node.js minimum documentation lookup
- Official Geoapify API key/security documentation lookup
- Official OpenStreetMap tile usage policy lookup
- `node --version && npm --version`
- `which vercel`
- `vercel --version`
- `rg --files -g 'vercel.json' -g '.vercel/**' -g 'next.config.*' -g '.gitignore' -g 'convex.json' -g 'README.md' -g 'tsconfig.json'`
- `rg -n "process\\.env\\.|NEXT_PUBLIC_|CLERK_|ARCJET_|OPEN_ROUTER_|GEOAPIFY_|CONVEX_" app components convex lib next.config.ts -g '!convex/_generated/**'`
- `git check-ignore -v .env.local .env .env.production .env.development`
- `git ls-files '.env*'`
- `rg -n "localhost|127\\.0\\.0\\.1|NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN|NEXT_PUBLIC_GEOAPIFY_API_KEY|GOOGLE_PLACE_API_KEY|NEXT_PUBLIC_GOOGLE_PLACE_API_KEY" ...`
- `npm install --package-lock-only`
- `npm test`
- `npm run lint`
- `npm run build`
- `npm audit --audit-level=moderate`
- `git diff --check`

Results:
- Local runtime checked: Node.js `v24.19.0`, npm `11.17.0`.
- Vercel CLI is installed: `58.0.0`. Authentication was not checked and no deploy was attempted.
- `npm install --package-lock-only` added no packages and reported 0 vulnerabilities; npm repeated existing allow-scripts review warnings for install-script packages.
- `.env.local`, `.env`, `.env.production`, and `.env.development` are ignored by `.gitignore`.
- No `.env*` files are tracked by Git.
- Active code does not contain localhost production dependencies.
- Active code does not require `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, `NEXT_PUBLIC_GEOAPIFY_API_KEY`, `GOOGLE_PLACE_API_KEY`, or `NEXT_PUBLIC_GOOGLE_PLACE_API_KEY`.
- `npm test` passed: 4 test files, 24 tests.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- `npm audit --audit-level=moderate` reported 0 vulnerabilities.
- `git diff --check` passed.

Open issues:
- Vercel project is not deployed yet. Milestone 32 must perform the deploy only after dashboard variables are configured.
- `CONVEX_DEPLOY_KEY` must be generated in Convex and set in Vercel before `npm run build:vercel` can work in production.
- `CLERK_JWT_ISSUER_DOMAIN` must be set in the Convex production deployment environment.
- Clerk production origins, redirect URLs, and billing plan visibility must be verified against the final production domain.
- Geoapify production key restrictions depend on the account and hosting setup; configure the strongest available restrictions in Geoapify MyProjects without exposing the key.
- Public OpenStreetMap standard tiles are best-effort and suitable only for modest interactive traffic; production launch must choose a compliant tile alternative if expected traffic is higher.
- A clean `.next` deletion attempt was blocked by shell safety rules, so the successful local build used the normal `next build` output behavior.

Next milestone:
- Milestone 32

## Post-Milestone 31 My Trips Convex Auth Guard

Changed:
- Updated `/my-trips` dashboard to skip the owner-scoped Convex query until `useConvexAuth()` reports verified auth.
- Changed `trips:listCurrentUserTrips` to return a safe `unauthenticated` status if called without a verified Convex identity instead of throwing `ConvexError: UNAUTHENTICATED`.
- Synced the updated Convex function to the active development deployment.

Reason:
- The local app could show a Next.js error overlay from `trips:listCurrentUserTrips` when the page rendered before Convex had verified the Clerk token.

Commands run:
- `git status --short --branch`
- `sed -n ... docs/PROJECT_SPEC.md docs/ARCHITECTURE.md docs/DECISIONS.md docs/ENVIRONMENT.md docs/PROGRESS.md components/trips/my-trips-dashboard.tsx convex/trips.ts`
- `rg -n "useQuery\\(api\\.trips|useQuery\\(" components app tests`
- `npm test`
- `npm run lint`
- `npm run build`
- `npx convex dev --once`
- `git diff --check`

Results:
- `npm test` passed: 4 test files, 28 tests.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- `npx convex dev --once` completed and reported Convex functions ready.
- `git diff --check` passed.
- No secret values were printed.

Open issues:
- If `/my-trips` stays on the account-sync message after refresh/sign-in, the Clerk Convex integration/JWT template or active Convex auth configuration still needs to be fixed. Do not bypass Convex server identity checks.

Next milestone:
- Milestone 32

## Post-Milestone 31 User Profile Sync Auth Guard

Changed:
- Updated `UserProfileSync` to wait for both Clerk sign-in and verified Convex auth before calling `users:upsertCurrentUserFromIdentity`.
- Prevented the local Next.js error overlay caused by an unauthenticated Convex profile-sync mutation during auth startup or misconfiguration.

Reason:
- The local app could show `ConvexError: UNAUTHENTICATED` from `users:upsertCurrentUserFromIdentity` even though the mutation failure was recoverable and should not run until Convex auth is ready.

Commands run:
- `git status --short --branch`
- `sed -n ... docs/PROJECT_SPEC.md docs/ARCHITECTURE.md docs/DECISIONS.md docs/ENVIRONMENT.md docs/PROGRESS.md AGENTS.md package.json components/auth/user-profile-sync.tsx convex/users.ts`
- `npm test`
- `npm run lint`
- `npm run build`
- `git diff --check`

Results:
- `npm test` passed: 4 test files, 28 tests.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- `git diff --check` passed.
- No secret values were printed.

Open issues:
- If Convex auth never becomes verified, the profile sync now waits quietly; fix the Clerk Convex integration/JWT template named `convex` and active Convex auth configuration rather than bypassing server identity checks.

Next milestone:
- Milestone 32

## Post-Milestone 31 Convex Save Auth Fix

Changed:
- Synced Convex development deployment with `npx convex dev --once`.
- Confirmed the active development deployment exposes `trips:saveGeneratedTrip`.
- Updated the create-trip save flow so a stale `useConvexAuth()` false state no longer blocks saving when Clerk can issue the `convex` token.
- Added a separate user-safe message for the case where Clerk cannot issue the `convex` token at all.
- Added test coverage for the Clerk Convex token readiness branch.

Reason:
- The save flow was stopping before the mutation with "Convex could not verify the Clerk token." After syncing Convex, the client should allow a fresh Clerk `convex` token to proceed to the mutation instead of blocking on stale auth state.

Commands run:
- `npx convex dev --once`
- Name-only `.env.local` variable presence check
- `npx convex function-spec`
- `npm test`
- `npm run lint`
- `npm run build`
- `git diff --check`

Results:
- `npx convex dev --once` completed and reported Convex functions ready for the development deployment.
- `npx convex function-spec` confirmed `trips:saveGeneratedTrip` exists on the active development deployment.
- `npm test` passed: 4 test files, 28 tests.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- `git diff --check` passed.
- No secret values were printed.

Open issues:
- Browser sessions that were signed in before the Convex sync may need a refresh, or sign out/sign in, so Clerk issues a fresh `convex` token.
- If the UI says Clerk cannot issue the `convex` token, enable Clerk's Convex integration or JWT template named `convex` in the Clerk Dashboard.
- The visible Arcjet key from the IDE should be rotated in Arcjet and updated in local/Vercel environments.

Next milestone:
- Milestone 32

## Post-Milestone 31 Save Trip Reliability Fix

Changed:
- Added a small user-safe Convex trip-save error classifier.
- Updated `/create-trip` to wait for Convex-authenticated Clerk identity before calling the save mutation.
- Kept generated itineraries in client state on save failure and surfaced actionable messages for Convex auth, deployment/function sync, validation, and network failures.
- Added unit coverage for save readiness and common Convex save failure classification.

Reason:
- The create-trip page could show a generic save failure after successful itinerary generation when Convex could not verify Clerk auth or when the configured Convex deployment was out of sync.

Commands run:
- `git status --short --branch`
- `sed -n ... components/create-trip/create-trip-shell.tsx convex/trips.ts convex/schema.ts components/convex-client-provider.tsx convex/auth.config.ts`
- Official Convex Clerk auth documentation lookup
- `npm test`
- `npm run lint`
- `npm run build`
- `git diff --check`
- `NEXT_PUBLIC_CONVEX_URL=https://placeholder.convex.cloud npm run build:vercel`

Results:
- `npm test` passed: 4 test files, 27 tests.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- `git diff --check` passed.
- `npm run build:vercel` passed through the manual `NEXT_PUBLIC_CONVEX_URL` fallback path using a non-secret placeholder URL.
- No secret values were printed.

Open issues:
- If the save message says Convex auth cannot verify Clerk, confirm Clerk's Convex integration/JWT template named `convex`, set `CLERK_JWT_ISSUER_DOMAIN` on the active Convex deployment, then run `npx convex dev` locally or `npx convex deploy` for production.
- The visible Arcjet key from the IDE should be rotated in Arcjet and updated in local/Vercel environments.

Next milestone:
- Milestone 32

## Post-Milestone 31 Create-Trip AI Conversation Fix

Changed:
- Added `lib/ai/conversation-fallback.ts` with a deterministic server-side interviewer fallback for requirement collection.
- Updated `/api/ai-model` to return the fallback response when OpenRouter conversation calls fail, time out, return invalid output, or are missing configuration.
- Added test coverage for fallback selector progression.

Reason:
- The create-trip page could become stuck with "Assistant response unavailable" during requirement collection if the AI conversation provider rejected the request or returned unsupported structured output.

Commands run:
- `git status --short --branch`
- `sed -n ... app/api/ai-model/route.ts components/create-trip/create-trip-shell.tsx components/create-trip/create-trip-flow.ts lib/ai/openrouter.ts lib/ai/conversation.ts lib/ai/contract.ts`
- Name-only `.env.local` presence check for AI, Clerk, Convex, and Arcjet variables
- `npm test`
- `npm run lint`
- `npm run build`

Results:
- `npm test` passed: 4 test files, 25 tests.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- No secret values were printed.

Open issues:
- Final itinerary generation still requires a working `OPEN_ROUTER_API_KEY` and `OPEN_ROUTER_MODEL`.
- The visible Arcjet key from the IDE should be rotated in Arcjet and updated in local/Vercel environments.

Next milestone:
- Milestone 32

## Post-Milestone 31 Vercel Build Fix

Changed:
- Added `vercel.json` so Vercel uses `npm run build:vercel` instead of the default plain `npm run build`.
- Added an explicit Vercel install command of `npm ci` so dependency installation follows the committed lockfile.
- Replaced the direct Convex deploy package script with `scripts/vercel-build.mjs`.
- The Vercel build script now supports two deployment paths:
  - preferred: `CONVEX_DEPLOY_KEY` is set, so Convex deploys and injects `NEXT_PUBLIC_CONVEX_URL`;
  - fallback: `NEXT_PUBLIC_CONVEX_URL` is set manually, so Next.js builds while Convex functions are assumed to be deployed separately.
- If neither Convex variable is configured, the build fails early with a concise configuration message.
- Clarified the Convex client missing-URL error so Vercel build failures point to `CONVEX_DEPLOY_KEY` and the Convex-aware build command.
- Updated `docs/PRODUCTION.md` to explain that `NEXT_PUBLIC_CONVEX_URL` is injected by `convex deploy`, dashboard build-command overrides must also use `npm run build:vercel`, dashboard install-command overrides should use `npm ci`, and Vercel should redeploy without build cache after changing build settings.

Reason:
- Vercel deployment logs showed `npm run build` was being used directly, so `NEXT_PUBLIC_CONVEX_URL` was missing during prerendering of `/_not-found`.

Commands run:
- `git status --short --branch`
- `sed -n ... AGENTS.md docs/PROJECT_SPEC.md docs/ARCHITECTURE.md docs/DECISIONS.md docs/ENVIRONMENT.md docs/PROGRESS.md package.json`
- Official Vercel `vercel.json` build command documentation lookup
- Official Convex Vercel deployment documentation lookup
- `npm ci`
- `node --check scripts/vercel-build.mjs`
- `npm test`
- `npm run lint`
- `npm run build`
- `NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210 npm run build:vercel`
- `env -u CONVEX_DEPLOY_KEY -u NEXT_PUBLIC_CONVEX_URL node scripts/vercel-build.mjs; exit_code=$?; printf 'expected_exit=%s\n' "$exit_code"; test "$exit_code" -eq 1`
- `node -e "JSON.parse(require('node:fs').readFileSync('vercel.json','utf8')); console.log('vercel.json valid JSON')"`

Results:
- `npm ci` passed locally on Node.js 24/npm 11; the visible Vercel `eslint` line is a warning, not a fatal error.
- `node --check scripts/vercel-build.mjs` passed.
- `npm test` passed: 4 test files, 24 tests.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.3.2.
- `npm run build:vercel` passed through the manual `NEXT_PUBLIC_CONVEX_URL` fallback path using a non-secret local placeholder URL.
- The no-Convex-config path exits with code 1 and prints only variable names, not values.
- `vercel.json` is valid JSON.
- No deployment was run and no secret values were printed.

Open issues:
- Preferred Vercel setup: configure `CONVEX_DEPLOY_KEY` so Convex deploys during `npm run build:vercel`.
- Fallback Vercel setup: configure `NEXT_PUBLIC_CONVEX_URL` manually only if Convex functions are deployed separately.
- If the Vercel dashboard has an explicit Build Command override, set it to `npm run build:vercel` or remove the override so `vercel.json` controls it.
- If the Vercel dashboard has an explicit Install Command override, set it to `npm ci` or remove the override so `vercel.json` controls it.

Next milestone:
- Milestone 32
