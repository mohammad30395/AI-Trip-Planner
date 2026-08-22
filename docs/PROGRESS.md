# Progress

## Milestone Checklist

- [x] Milestone 00 - Read-only preflight
- [x] Milestone 01 - Next.js scaffold
- [x] Milestone 02 - Project governance and source of truth
- [x] Milestone 03 - UI foundation
- [x] Milestone 04 - Landing page
- [x] Milestone 05 - Route skeletons
- [x] Milestone 06 - Clerk authentication
- [ ] Milestone 07 - Convex backend foundation
- [ ] Milestone 08 - Trip planning input flow
- [ ] Milestone 09 - AI itinerary generation
- [ ] Milestone 10 - Google Places enrichment
- [ ] Milestone 11 - Saved trips
- [ ] Milestone 12 - Mapbox trip map
- [ ] Milestone 13 - Arcjet free quota
- [ ] Milestone 14 - Clerk Billing paid access
- [ ] Milestone 15 - Production readiness and Vercel deployment

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
