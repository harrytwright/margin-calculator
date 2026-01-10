# CLAUDE.md

Guidance for Claude Code when working in this repo.

## Overview
- Menu Book monorepo (pnpm + turbo). Packages: `@menubook/core` (logic/importer/calculator/storage + Prisma/Kysely), `@menubook/cli` (Commander CLI), `@menubook/app` (Express + EJS UI/API), `@menubook/web` (Parcel marketing site).
- Version baseline: 0.3.x; Node 18+; pnpm 10+.

## Build & Dev Commands
```bash
pnpm install
pnpm build                     # turbo build all packages
pnpm test / pnpm test:watch / pnpm test:coverage
pnpm dev                       # turbo dev

# Package focused
pnpm --filter @menubook/cli build
pnpm --filter @menubook/app dev
pnpm --filter @menubook/web dev
pnpm --filter @menubook/core generate   # after prisma/schema.prisma changes
```

## Running the CLI
Use pnpm exec so the local binary is used:
```bash
pnpm --filter @menubook/cli exec margin -- --help
pnpm --filter @menubook/cli exec margin initialise --location ~/.margin --workspace ./data
pnpm --filter @menubook/cli exec margin import data/**/*.yaml [--watch]
pnpm --filter @menubook/cli exec margin recipe calculate <slugs...> [--json]
pnpm --filter @menubook/cli exec margin recipe report [--json]
pnpm --filter @menubook/cli exec margin ui [-p 3000] [--no-open] [--no-watch] [--standalone] [--storage fs|database-only]
```

### Global options
`--location` (system data, default `~/margin`), `--workspace` (YAML root, default `./data`), `--working` (deprecated alias of location), `--storage <fs|database-only>`, `-d/--database` (filename), `--verbose/--quiet`.

## Data Model & Storage
- Config lives at `<location>/conf/margin.toml` (VAT rate, default margin, defaultPriceIncludesVat). DB defaults to `<location>/margin.sqlite3`.
- Workspace YAML under `<workspace>/suppliers|ingredients|recipes`.
- Storage modes: `fs` writes YAML via `FileSystemStorage`; `database-only` keeps data in DB (used by standalone UI/API).
- Import schema accepts references as `@/`, relative paths, or `slug:...`.
- ExportService supports YAML/CSV exports and full bundles.

## Architecture Notes
- Core uses Prisma schema + prisma-kysely types; migrations live in `packages/core/src/datastore/migrations`.
- Services in `packages/core/src/services` (supplier/ingredient/recipe/config/export/dashboard).
- Calculator handles VAT stripping, yield scaling, depth limit 10, unit conversion standard + custom + fallback.
- FileWatcher + HashService drive `margin import --watch` and UI live updates via `/api/events` SSE.
- UI (`packages/app/src/server`) serves API + EJS app; respects `storageMode` and `watchFiles`.

## Testing
- Jest + ts-jest; tests colocated in `__tests__` next to sources.
- Use in-memory `better-sqlite3` + `migrate` from `packages/core/src/datastore/database` in tests; prefer deterministic fixtures over snapshots.

## Git / Docs
- Conventional Commits (`feat:`, `fix:`, `chore:`, etc.).
- Update README/AGENTS/CLAUDE when changing commands, storage defaults, or schema workflows.

## When editing
- Keep Prettier style (single quotes, no semicolons, import organize). ASCII unless file already uses other chars.
- Keep CLI handlers thin; push logic into services/lib in `@menubook/core`.
