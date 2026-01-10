# 📖 Menu Book

Monorepo for Menu Book — recipe costing, margin analysis, and data import/export with both CLI and web UI. Built with pnpm workspaces and turbo across `packages/` (core, CLI, app) and `apps/web` (marketing site).

## Features
- Recursive recipe costing with sub-recipe support, yield scaling, and unit conversion
- VAT/tax-aware pricing with configurable defaults
- Import from YAML/JSON with dependency resolution and change detection
- Multiple reporters (pretty/summary/JSON) and CSV/YAML export paths
- Web UI with live updates via file watching + SSE

## Requirements
- Node 18+
- pnpm 10+

## Install & Build
```bash
pnpm install
pnpm build          # turbo build across packages
```

## Monorepo Layout
- `packages/core`: business logic, importer, calculator, storage backends, Prisma schema (`prisma/schema.prisma`), Kysely migrations (`src/datastore/migrations`).
- `packages/cli`: Commander-based `margin` CLI (commands in `src/commands`, reporters in `src/reporters`).
- `packages/app`: Express + EJS UI/API (`src/server`), SSE at `/api/events`, supports filesystem or database-only storage.
- `apps/web`: Parcel + Tailwind marketing site/blog.

## Using the CLI (local workspace)
Commands run through pnpm exec so the local binary is used:
```bash
# Show help
pnpm --filter @menubook/cli exec margin -- --help

# Initialise (prompts for VAT pricing model)
pnpm --filter @menubook/cli exec margin initialise --location ~/.margin --workspace ./data

# Import YAML/JSON (auto-detects entity types)
pnpm --filter @menubook/cli exec margin import data/**/*.yaml
# Watch mode (imports on save)
pnpm --filter @menubook/cli exec margin import --watch --workspace ./data

# Calculate specific recipes
pnpm --filter @menubook/cli exec margin recipe calculate margherita pizza-sauce --json

# Report all recipes
pnpm --filter @menubook/cli exec margin recipe report
```

### Global Options
- `--location` system data (config + database), default `~/margin`
- `--workspace` YAML files root, default `./data`
- `--working` deprecated alias of `--location`
- `--storage <fs|database-only>` storage mode (fs writes YAML, database-only avoids filesystem)
- `-d, --database` database filename (default `margin.sqlite3`)
- `--verbose` / `--quiet` logging

### Web UI
```bash
pnpm --filter @menubook/cli exec margin ui -p 3000           # opens browser
pnpm --filter @menubook/cli exec margin ui --no-open         # skip auto-open
pnpm --filter @menubook/cli exec margin ui --standalone      # database-only, no file watching
pnpm --filter @menubook/cli exec margin ui --no-watch        # disable watch/SSE
```
UI watches `<workspace>` by default and streams file events over `/api/events`.

## Data Format (YAML)
References accept `@/`, relative paths, or `slug:` prefixes.

**Supplier**
```yaml
object: supplier
data:
  name: ASDA
```

**Ingredient**
```yaml
object: ingredient
data:
  name: Cheddar Cheese
  category: dairy
  supplier:
    uses: slug:asda
  purchase:
    unit: 1kg
    cost: 5.99
    vat: false
  conversionRate: 1kg = 10 portions
```

**Recipe**
```yaml
object: recipe
data:
  name: Margherita Pizza
  class: menu_item
  stage: active
  costing:
    price: 1200      # pence
    margin: 30
    vat: true
  yieldAmount: 1
  yieldUnit: pizza
  ingredients:
    - uses: slug:pizza-sauce
      with: { unit: 50g }
    - uses: slug:mozzarella
      with: { unit: 60g }
```

## Development
```bash
# Run tests (all packages)
pnpm test
pnpm test:watch
pnpm test:coverage

# Targeted builds / dev loops
pnpm --filter @menubook/cli build      # CLI
pnpm --filter @menubook/app dev        # UI (tailwind watch + tsc)
pnpm --filter @menubook/web dev        # marketing site (Parcel)

# After editing prisma/schema.prisma
pnpm --filter @menubook/core generate
```

## Configuration & Storage
- Config file: `<location>/conf/margin.toml` (VAT rate, default margin, defaultPriceIncludesVat).
- Database: `<location>/margin.sqlite3` by default.
- Workspace YAML lives under `<workspace>/suppliers|ingredients|recipes`.
- Storage modes: `fs` writes YAML via `FileSystemStorage`; `database-only` keeps data in the DB (used for standalone UI/API).

## Export Paths
- `ExportService` (core) supports YAML and CSV exports for suppliers, ingredients, recipes, and full dataset bundles (used by the API/UI).

## License
MIT — Created by GoBowling Shipley Lanes
