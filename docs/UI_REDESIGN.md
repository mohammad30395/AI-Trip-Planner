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
