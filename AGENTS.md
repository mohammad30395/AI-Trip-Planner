# Agent Rules

Read these source-of-truth docs before changing code:
- `docs/PROJECT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/ENVIRONMENT.md`
- `docs/PROGRESS.md`

Work one milestone at a time and stop when that milestone is complete.
Keep TypeScript strict; do not hide real issues with `@ts-ignore` or broad `any`.
Never print, copy, commit, or expose secret environment variable values.
Run the relevant checks before marking a milestone complete.
Use `npm test` for the automated pure/unit test suite when tests are relevant.
Do not add dependencies unless the current milestone explicitly allows them or approval is given.

This project uses the current stable Next.js App Router. For Next.js 16+, request interception belongs in `proxy.ts`.
