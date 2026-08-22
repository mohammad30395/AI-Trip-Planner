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
- [ ] Milestone 20 - Google Places enrichment
- [ ] Milestone 21 - Mapbox trip map
- [ ] Milestone 22 - Arcjet free quota
- [ ] Milestone 23 - Clerk Billing paid access
- [ ] Milestone 24 - Production readiness and Vercel deployment

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
- The trip payload validator is intentionally conservative and must be tightened when the AI itinerary and Google Places enrichment schemas are implemented.
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
- Generated hotels, prices, addresses, and place names are unverified model output until Google Places enrichment is implemented.
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
- Generated hotels, prices, addresses, and place names remain unverified model output until Google Places enrichment is implemented.
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
- Place photos are placeholders until Google Places enrichment is implemented.
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
- Trip card images remain placeholders until Google Places enrichment is implemented.
- If it has not already been rotated, the existing `OPEN_ROUTER_API_KEY` should be rotated in OpenRouter and replaced in `.env.local` because it was accidentally printed in terminal output during Milestone 13.

Next milestone:
- Milestone 20
