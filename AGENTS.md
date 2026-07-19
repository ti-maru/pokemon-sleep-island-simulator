# AGENTS.md

## Primary specification

Implementation must conform to:

- docs/design.md

If code and the specification conflict, stop and report the conflict.
Do not silently change product requirements.

## Commands

- Install: pnpm install
- Type check: pnpm typecheck
- Lint: pnpm lint
- Unit tests: pnpm test
- Build: pnpm build

Run all relevant checks before completing a task.

## Architecture

- Keep calculation logic independent from React.
- Domain functions must be pure whenever possible.
- Do not access IndexedDB from React components directly.
- Validate external and persisted data with Zod.
- Do not use external runtime APIs for game data.

## Product constraints

- Do not implement research-rank restrictions.
- Do not implement the EXP bonus gauge.
- Relax Set input supports only:
  - none
  - ticket count
  - active duration
- Treat Relax Set duration as continuous from deposit start.
- Do not implement remaining-time carryover, inventory, or usage history.
- The initial level cap is 70 and can be overridden.
- The initial calculation rules are provisional but may be released.

## Copyright

- Do not add official Pokémon images, logos, game screenshots, or copied UI assets.
- Do not copy code from third-party repositories.
- Confirm dependency licenses before adding packages.

## Scope control

Implement only the requested phase.
Do not implement later phases unless explicitly requested.
Do not replace selected libraries without approval.
