# Progress

## Milestone Checklist

- [x] Milestone 00 - Read-only preflight
- [x] Milestone 01 - Next.js scaffold
- [x] Milestone 02 - Project governance and source of truth
- [x] Milestone 03 - UI foundation
- [x] Milestone 04 - Landing page
- [ ] Milestone 05 - Authentication foundation
- [ ] Milestone 06 - Convex backend foundation
- [ ] Milestone 07 - Trip planning input flow
- [ ] Milestone 08 - AI itinerary generation
- [ ] Milestone 09 - Google Places enrichment
- [ ] Milestone 10 - Saved trips
- [ ] Milestone 11 - Mapbox trip map
- [ ] Milestone 12 - Arcjet free quota
- [ ] Milestone 13 - Clerk Billing paid access
- [ ] Milestone 14 - Production readiness and Vercel deployment

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
