# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GoBowling Margin Calculator - A CLI tool for managing recipes, ingredients, and calculating profit margins for food service operations. Tracks ingredient costs from suppliers, calculates recipe costs including sub-recipes, and helps maintain target profit margins.

## Build & Development Commands

```bash
# Build TypeScript to dist/
npm run build

# Run the CLI (after building)
node dist/index.js [command]

# Create a new database migration
zx scripts/migration.mjs

# Regenerate Kysely types after modifying prisma/schema.prisma
npx prisma-kysely
```

## Architecture

### Database Stack

This project uses a **Prisma + Kysely hybrid approach**:

- **Prisma schema** (`prisma/schema.prisma`) defines the data model
- **prisma-kysely** generator creates TypeScript types in `src/datastore/types.ts`
- **Kysely** is used for all database operations (NOT Prisma Client)
- **Custom migration system** using Kysely's migration API (NOT Prisma Migrate)

When modifying the schema:

1. Edit `prisma/schema.prisma`
2. Run `npx prisma-kysely` to regenerate types
3. Run `zx scripts/migration.mjs` to create a new migration file
4. Implement the migration in the generated file using Kysely's schema builder

### Database Access Pattern

- Database instances are managed via a singleton Map in `src/datastore/database.ts`
- Use `database(path)` function to get/create database instances
- Default path is `:memory:` for ephemeral databases
- Migrations are run via `migrate()` method bound to Kysely instance

### Data Model Structure

**Core Entities:**

- **Supplier**: Ingredient suppliers (e.g., wholesalers)
- **Ingredient**: Raw ingredients with purchase details (cost, unit, supplier)
- **Recipe**: Menu items, base templates, or sub-recipes
- **RecipeIngredients**: Junction table linking recipes to ingredients or other recipes

**Recipe Hierarchy:**

- Recipes can inherit from a parent recipe (via `parentId`)
- Recipes can be used as sub-recipes in other recipes (e.g., "pizza sauce" used in "margherita pizza")
- Recipe classes:
  - `menu_item`: Customer-facing items (default)
  - `base_template`: Parent recipes for inheritance (e.g., "base pizza")
  - `sub_recipe`: Compound ingredients used in other recipes (e.g., "sauce", "dressing")

**Unit Conversion System:**

- Uses `convert-units` library for standard unit conversions
- Supports custom conversion rules (e.g., "1 box = 24 bags") stored in `Ingredient.conversionRule`
- Recipe ingredients use freeform unit strings (e.g., "50g", "2 bags", "1.5 pints")

**Pricing & Margins:**

- Recipes store `sellPrice`, `includesVat`, and `targetMargin`
- Sub-recipes define `yieldAmount` and `yieldUnit` for proper cost calculation
- System calculates cost from ingredients recursively through sub-recipes

**Identifiers:**

- All entities use auto-incrementing integer IDs
- Slugified names (`slug` field) are used for human-readable references during imports
- Slugs are generated using `@sindresorhus/slugify`

## CLI Structure

The CLI uses Commander.js with a subcommand structure:

```
margin
├── recipe
│   ├── import <file>     # Import recipe from YAML/JSON
│   ├── cost <slug>       # Calculate recipe cost breakdown
│   └── list              # List recipes with margins
├── ingredient
│   └── import <file>     # Import ingredient from YAML/JSON
├── explore               # Launch web UI for browsing
└── config
    └── set               # Update configuration (VAT rate, margins)
```

Command implementations should be placed in `src/commands/` and imported in `src/index.ts`.

## Migration Workflow

1. **Create migration**: `zx scripts/migration.mjs`
   - Prompts for migration name
   - Creates timestamped file in `src/datastore/migrations/`

2. **Implement migration**: Edit the generated file
   - Use Kysely schema builder in `up()` function
   - Optionally implement `down()` for rollback

3. **Run migrations**: Automatically runs on database initialization via `migrate()` method

## Linting

After creating any code, the `npx prettier --write` command should be ran. Making sure to lint your created files to
make sure they are aligned with the code standard.
