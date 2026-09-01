# UI Redesign Notes

## Target Foundation

- Match the supplied travel-planner screenshots with a light-first interface,
  Poppins typography, vivid orange primary actions, broad centered content,
  warm neutral surfaces, generous rounded corners, and restrained depth.
- Keep the existing Next.js, Clerk, Convex, AI, map, and test architecture
  intact during UI redesign milestones.
- Use `app/globals.css` as the source of truth for shared visual tokens. Do not
  create a parallel theme system.

## Tokens

- Primary brand orange is `--brand-orange` / `--primary`; hover and pressed
  states use `--brand-orange-hover` and `--brand-orange-pressed`.
- Reusable semantic colors are intentionally compact: `--success`, `--rating`,
  `--info`, and `--soft-surface`.
- Radius hierarchy: `--app-control-radius`, `--app-card-radius`,
  `--app-panel-radius`, `--app-image-radius`, and `--app-pill-radius`.
- Shadow hierarchy: `--app-shadow-card`, `--app-shadow-elevated`, and
  `--app-shadow-primary`.

## Primitive Guidance

- Preserve shadcn/Base UI component APIs and existing variant names.
- Default buttons are orange with white text and accessible focus rings.
- Cards, inputs, and badges should feel soft and target-like without forcing
  feature-page redesigns into shared primitives.
- Future UI prompts should apply these tokens to pages incrementally and keep
  functional behavior unchanged unless that prompt explicitly says otherwise.

## Header Guidance

- Public and authenticated headers share the same `BrandLogo` and
  `HeaderShell` treatment: white sticky bar, compact orange mark, bold Poppins
  wordmark, centered real-route navigation, and right-aligned Clerk-aware
  controls.
- Do not add placeholder destinations such as Contact unless a real route is
  implemented by an approved milestone.
- Keep Clerk `Show` and `UserButton` behavior intact; style around them rather
  than replacing authentication behavior.
- Keep the desktop header navigation at the `lg` breakpoint and above. Tablet
  widths should use the mobile menu until the centered navigation and
  Clerk-aware actions can fit without collision.

## Landing Guidance

- The public landing hero should center the primary trip-planning action:
  heading, concise factual copy, large prompt composer, quick suggestion chips,
  see-how-it-works affordance, then a static product/workspace preview.
- Public landing interactions must route into `/create-trip`; they must not
  call AI routes, consume quota, save trips, or invent a Create Trip prefill
  contract.
- Landing composer controls, suggestion chips, and preview header chrome should
  wrap or simplify before they force horizontal overflow on 360px to 430px
  mobile widths.

## Create Trip Guidance

- Create Trip presentation should consume `useCreateTripController()` instead
  of embedding AI, quota, save, abort, or navigation orchestration in layout
  components.
- The Create Trip page should read as an app workspace: on desktop use an
  approximately 40/60 conversation-to-context split, matched panel heights, and
  the shared large panel radius with restrained borders and shadows.
- Keep the conversation surface stable as messages grow by using a flex panel
  with internal scrolling on desktop; allow natural stacked document flow on
  mobile.
- Keep the Create Trip split layout at the `xl` breakpoint and above. Below
  `xl`, stacked panels are preferred over a cramped side-by-side workspace.
- Desktop Create Trip panel heights must remain viewport bounded and usable on
  short desktop windows such as 1280x650; avoid large fixed minimum heights that
  create a second-page workspace before content requires it.
- Before saved-trip provider enrichment supplies canonical place coordinates,
  Create Trip context visuals may be map-inspired only. They must not fabricate
  coordinates, initialize Leaflet, or imply verified geography.
- Assistant chat bubbles should stay left-aligned on a very light neutral
  surface; user reply bubbles should stay right-aligned on the shared primary
  orange with white text.
- Generative option controls may use friendly presentation labels, but submitted
  values must remain the canonical domain values from `create-trip-flow.ts`.
- Shared selection cards should use native buttons, `aria-pressed`, pale
  borders, soft icon surfaces, and orange-tinted selected states rather than
  inventing new interaction semantics.
- Final generation states should be derived from the controller state only:
  ready, generating, quota/access blocked, generation error, generated awaiting
  save, saving, save error, and saved/navigation.
- Loading UI must stay truthful. Do not display fake percentages, countdowns,
  provider names, map progress, hotel counts, or place coordinates before real
  state provides them.
- Quota/access states should use compact product notices with a real pricing
  link when offered; avoid oversized destructive error treatment.
- Generation errors and save errors should remain visually and semantically
  distinct where state supports it, so a valid generated itinerary is not
  implied to be lost after a save failure.
- Preserve automatic post-save navigation to `/view-trip/${tripId}`. Do not add
  artificial delays or replace it with a required manual View Trip action.
- Trip content cards should use an image-first hierarchy: media, title,
  generated description, estimate/detail pills, place capability, then the map
  action.
- Hotel and activity prices from AI output must remain labeled as estimates.
  Do not present them as live rates, bookable availability, or provider-verified
  pricing.
- Ratings should be omitted unless a real verified rating field exists in the
  current data contract.
- `View on Map` belongs on an explicit button and should be enabled only after
  existing enrichment provides a canonical mappable place.
- Image fallbacks should keep card dimensions stable, stay neutral/light, and
  never fabricate place photography.
- Destination, hotel, and activity imagery must pass through the shared
  external-image validator, and Next image host configuration must stay aligned
  with that exact trusted-host list.
- Place-specific imagery and mappable coordinates remain independently gated:
  a strict image match never authorizes a map point, and a Geoapify coordinate
  match never guarantees a photo.

## Map Guidance

- Saved-trip maps use canonical Geoapify-enriched coordinates only; AI output
  must not be used as latitude/longitude.
- Keep Leaflet with the application-controlled OpenStreetMap tile URL. Do not
  substitute Mapbox, Google Maps, screenshots, or another map runtime for visual
  parity.
- OSM attribution must remain visible and unobstructed.
- Default map markers should follow the brand-orange direction, with compact
  labels and clear selected-marker treatment.
- Cards and markers must share the same stable map-point identity so selected
  card and selected marker states stay synchronized.
- Desktop map panels may be sticky-compatible below the global header; mobile
  maps must remain in normal document flow.

## Saved Trip Layout Guidance

- Saved trip detail pages should render one `TripPresentation` tree and one
  `TripMapSection` tree; do not duplicate desktop/mobile copies.
- On wide desktop screens, saved trips use a normal-document-scroll itinerary
  column beside a sticky map column, with the itinerary around 60% and the map
  around 40% of the content width.
- Below the wide desktop breakpoint, the saved trip page stacks in one column
  with the map in normal document flow after the trip header and before the
  itinerary cards.
- `View on Map` should avoid disruptive page scrolling when the sticky desktop
  map is already visible, while still scrolling to the normal-flow map on
  stacked layouts.
- The saved-trip CSS split breakpoint and `View on Map` interaction breakpoint
  must stay aligned at 1280px / `xl`.
- Sticky saved-trip maps should use viewport-bounded heights and compact stop
  summaries so the map remains readable below the sticky app header on shorter
  desktop viewports.
- Saved-trip pages should tolerate long source, destination, hotel, and
  activity names by using `min-w-0` containers and word wrapping where content
  is user- or AI-provided.

## My Trips Guidance

- My Trips uses image-forward saved-trip cards with a compact route title and
  duration/budget summary.
- The dashboard grid should progress from 3 columns on desktop to 2 columns on
  tablet and 1 column on mobile when card readability requires it.
- Dashboard cards must navigate with the persisted trip id at
  `/view-trip/[tripId]`.
- Budget display may use only the established presentation formatter; stored
  canonical budget values must remain unchanged.
- Empty My Trips states may link to the real `/create-trip` route, but the
  populated dashboard should avoid duplicating the authenticated header's
  primary create action.

## Auth, Pricing, and State Guidance

- Clerk remains authoritative for authentication and billing UI. Do not replace
  `SignIn`, `SignUp`, or `PricingTable` with custom forms or fake pricing cards.
- Customize Clerk surfaces only through supported appearance props and stable
  surrounding layout; do not target generated Clerk DOM or hide required Clerk
  controls.
- Pricing copy may describe existing app billing boundaries, but must not
  invent prices, discounts, guarantees, usage amounts, testimonials, or local
  plan feature lists.
- Secondary loading, empty, error, not-found, and account-sync states should use
  product typography, app radius tokens, restrained icons, safe explanations,
  and real-route recovery actions only.
- Route-level loading, empty, unavailable, and not-found states should expose
  their state title as the page `h1`; nested state panels inside pages that
  already have a heading should use a lower-level heading.
- When the mobile navigation menu closes after route selection, focus should
  return to the menu trigger instead of remaining on removed menu content.
- Default and large shared buttons should remain close to 44px touch targets.
  Smaller sizes are reserved for compact, deliberate UI contexts where the
  surrounding control group already provides clear affordance.
