# Repository Guidelines

## Monorepo Layout

- Root uses pnpm workspaces + turbo; packages live under `packages/` and the marketing site under `apps/`.
- `packages/core`: business logic, importer, calculator, storage backends, Prisma schema (`prisma/schema.prisma`), and Kysely migrations in `src/datastore/migrations`; tests live beside code in `__tests__`.
- `packages/cli`: Commander-based `margin` CLI (commands in `src/commands`, reporters in `src/reporters`, shared helpers in `src/lib`/`src/utils`); builds to `packages/cli/dist`.
- `packages/app`: Express API + HTMX/EJS UI; controllers in `src/controllers`, services in `src/services`, schemas in `src/schemas`, views in `views/` (layouts/pages/components/islands/modals), static assets in `public/`, and SSE events at `/api/events/sse`.
- `apps/web`: Parcel + Tailwind marketing site/blog (scripts in `apps/web/scripts`, sources in `apps/web/src`, build output in `apps/web/dist`).
- Templates and helper scripts sit in `templates/` and `scripts/`; note the active schema/migrations live in `packages/core`, not the root `src/` path referenced by legacy scripts.

## Build, Test, and Development Commands

- Use pnpm (pnpm 10+, Node >=18). Root scripts run through turbo across packages; avoid mixing npm/yarn.
- `pnpm build` → turbo build (tsc for core/cli, tailwind + asset copy for app; outputs under each `packages/*/dist`).
- `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` → turbo-run Jest suites.
- `pnpm dev` runs all package dev tasks; targeted: `pnpm dev:cli` (tsc watch), `pnpm dev:app` (tailwind + tsc watch), `pnpm dev:web` (Parcel dev server).
- `pnpm format` runs Prettier across `packages/**` and `apps/**`; `pnpm clean` clears turbo caches and `node_modules`.
- Package-specific: `pnpm --filter @menubook/core generate` after editing `packages/core/prisma/schema.prisma` to regenerate Kysely types; `pnpm --filter @menubook/app build` to rebuild server assets; `pnpm --filter @menubook/web build` for the marketing site.

## Runtime & CLI Usage

- Global options: `--location` for system data/config/database (default `~/margin`), `--workspace` for YAML files (default `./data`), `--working` is a deprecated alias for `--location`, `--storage <fs|database-only>`, `-d/--database` for DB filename, plus `--verbose/--quiet`.
- `margin initialise` creates location + workspace folders, prompts for VAT pricing model, writes `conf/margin.toml`, and can force database recreation (`--force` asks for confirmation).
- `margin import [files] [--watch]` auto-detects entities, uses `FileWatcher` + `HashService`, and populates workspace folders (`suppliers/`, `ingredients/`, `recipes/`); `--root` is deprecated, `--fail-fast` stops on the first error.
- Deprecated per-entity imports remain under `margin recipe/ingredient/supplier import`; prefer the global `margin import`.
- Calculations: `margin recipe calculate <slugs...>` (DefaultReporter or JSON via `--json`) and `margin recipe report` (SummaryReporter or JSON); exit non-zero if any recipe fails to calculate.
- `margin ui [-p <port>] [--no-open] [--no-watch] [--standalone] [--storage <fs|database-only>]` runs the @menubook/app server; file watching feeds `/api/events` SSE for live UI updates. `standalone` forces database-only storage and disables watching/writes to disk.

## Coding Style & Naming

- Prettier config enforces single quotes, no semicolons, trailing commas, and organizes imports; stick to ASCII unless a file already uses other characters.
- Prefer camelCase for variables/functions, PascalCase for exported classes, and kebab-case for file names. Keep CLI commands small and layer adapters/helpers under `packages/core/src/lib` or `packages/core/src/services` rather than inside command handlers.

## Testing Guidelines

- Jest with ts-jest per package; tests are colocated in `__tests__` next to source files.
- Use in-memory `better-sqlite3` + `migrate` from `packages/core/src/datastore/database` to apply real migrations in tests; mirror existing patterns for importer/service tests and assert created/upserted/ignored/failed paths.
- Favor deterministic fixtures over snapshots; cover both happy paths and failure handling for import/validation flows.

## Data & Configuration Tips

- Config lives at `<location>/conf/margin.toml` (VAT rate, margin target, default VAT pricing model set during initialise); the database defaults to `<location>/margin.sqlite3`.
- Workspace YAML lives under `<workspace>/suppliers|ingredients|recipes`; storage mode `fs` writes via `FileSystemStorage`, while `database-only` avoids filesystem output (used for standalone UI/API).
- `ExportService` supports YAML/CSV exports for suppliers/ingredients/recipes and full dataset bundles; wired through the API/UI.
- Treat anything in `data/` as local fixtures and keep `.env` secrets out of git. UI/import flows rely on file watching/SSE—leave watch enabled unless constrained.

## Commit & PR Guidelines

- Use Conventional Commits (`feat:`, `fix:`, `chore:`, etc.) and keep PRs focused. Describe changes, list checks run (tests/format/build), and flag schema or data generation steps (e.g., `pnpm --filter @menubook/core generate`) when applicable.
