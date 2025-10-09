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

# Run tests
npm test
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
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

### Service Layer Pattern

Database operations are centralized in service files (`src/services/`). Each entity has its own service module:

**Key Functions (bound to `Kysely<DB>` via `.call(db, ...)`):**

- `findById(slug)` - Retrieve entity by slug
- `upsert(slug, data)` - Insert or update entity
- `exists(slug)` - Check if entity exists

**Example Usage:**

```typescript
import { findById, upsert } from '../services/supplier'

const existing = await findById.call(db, 'asda')
await upsert.call(db, 'asda', importData)
```

This pattern:

- Keeps database logic separate from command logic
- Ensures consistent queries across the codebase
- Makes testing easier (services can be tested independently)

### Import System

The project uses a centralized `Importer` class (`src/lib/importer.ts`) for handling YAML/JSON file imports:

**Key Features:**

- **Processor Registry**: Register handlers for each entity type (`supplier`, `ingredient`, `recipe`)
- **Shared Context**: All processors access `this.database`, `this.slugify()`, etc.
- **Statistics Tracking**: Automatically tracks `created`, `upserted`, `ignored`, `failed` counts
- **Dependency Resolution**: Supports importing referenced files to resolve dependencies
- **Circular Prevention**: Tracks imported files to prevent infinite loops
- **Error Handling**: Fail-fast mode or continue-on-error with detailed error reporting

**Example Processor:**

```typescript
const importer = new Importer(db, { verbose: true })

importer.addProcessor<SupplierImportData>('supplier', async function (data) {
  const slug = data.slug || (await this.slugify(data.name))
  const existing = await findById.call(this.database, slug)

  if (existing && !hasChanges(existing, data, { name: 'name' })) {
    return 'ignored'
  }

  await upsert.call(this.database, slug, data)
  return existing ? 'upserted' : 'created'
})

const stats = await importer.import(['file1.yaml', 'file2.yaml'])
```

**Processors must return:** `'created' | 'upserted' | 'ignored'`

### Import Validation

All imports are validated using Zod schemas (`src/schema.ts`):

- **Discriminated Union**: Uses `object` field to distinguish entity types
- **Type Safety**: Generated TypeScript types from schemas
- **Validation**: Automatic validation of required fields, types, and constraints

**Import Format:**

```yaml
object: supplier # or 'ingredient', 'recipe'
data:
  name: Supplier Name
  # ... entity-specific fields
```

**Immutable Fields After Creation:**

- `Ingredient.supplierId` - Cannot change supplier after creation
- `Recipe.parentId` - Cannot change parent recipe after creation

These constraints enforce data integrity and prevent accidental relationship changes.

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
├── import <files...>     # Import any entity type (auto-detects from YAML/JSON)
├── recipe
│   ├── import <file>     # DEPRECATED: Use `margin import` instead
│   ├── cost <slug>       # Calculate recipe cost breakdown
│   └── list              # List recipes with margins
├── ingredient
│   └── import <file>     # DEPRECATED: Use `margin import` instead
├── supplier
│   └── import <file>     # DEPRECATED: Use `margin import` instead
├── explore               # Launch web UI for browsing
└── config
    └── set               # Update configuration (VAT rate, margins)
```

Command implementations should be placed in `src/commands/` and imported in `src/index.ts`.

## Importing Data

Use the **global `margin import` command** to import suppliers, ingredients, and recipes. The importer automatically detects entity types from the `object` field in YAML/JSON files.

### Basic Usage

```bash
# Import a single file
margin import data/suppliers/asda.yaml

# Import multiple files (auto-detects types)
margin import data/suppliers/*.yaml data/ingredients/*.yaml

# Import with automatic dependency resolution
margin import data/recipes/pizza.yaml  # Auto-imports ingredients and suppliers
```

### Options

```bash
# Use custom project root for @/ references
margin import --root ~/my-data @/recipes/*.yaml

# Stop on first error instead of continuing
margin import --fail-fast data/*.yaml
```

### How It Works

1. **Auto-detection**: Reads the `object` field from each file to determine type
2. **Dependency resolution**: Automatically imports referenced files (via `uses:` fields)
3. **Change detection**: Only creates/updates records when data has changed
4. **Statistics**: Reports created, upserted, ignored, and failed imports

### Example Workflow

```bash
# 1. Initialize the working directory
margin initialise

# 2. Import suppliers first (optional - can auto-import)
margin import data/suppliers/*.yaml

# 3. Import ingredients (auto-imports suppliers if referenced)
margin import data/ingredients/*.yaml

# 4. Import recipes (auto-imports ingredients/suppliers if referenced)
margin import data/recipes/*.yaml

# Or import everything at once
margin import data/**/*.yaml
```

### Entity-Specific Import Commands (Deprecated)

The following commands still work but are deprecated in favor of `margin import`:

```bash
margin supplier import <file>     # Shows deprecation warning
margin ingredient import <file>   # Shows deprecation warning
margin recipe import <file>       # Shows deprecation warning
```

## Migration Workflow

1. **Create migration**: `zx scripts/migration.mjs`
   - Prompts for migration name
   - Creates timestamped file in `src/datastore/migrations/`

2. **Implement migration**: Edit the generated file
   - Use Kysely schema builder in `up()` function
   - Optionally implement `down()` for rollback

3. **Run migrations**: Automatically runs on database initialization via `migrate()` method

## Testing

The project uses **Jest** with **ts-jest** for testing.

### Test Structure

- Tests are colocated with source code in `__tests__/` directories
- Pattern: `src/lib/__tests__/importer.test.ts`
- Use in-memory SQLite databases for fast, isolated tests
- Migrations run automatically in tests using actual migration files

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode for development
npm run test:coverage # Generate coverage report
```

### Writing Tests

**Example test setup:**

```typescript
import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import { migrate } from '../../datastore/database'

let db: Kysely<DB>

beforeEach(async () => {
  db = new Kysely<DB>({
    dialect: new SqliteDialect({
      database: new Database(':memory:'),
    }),
  })

  // Run migrations to set up schema
  await migrate.call(
    db,
    'up',
    path.join(__dirname, '../../datastore/migrations')
  )
})

afterEach(async () => {
  await db.destroy()
})
```

**Key Testing Patterns:**

- Use actual migrations (not manual schema creation) to stay in sync with production schema
- Mock ESM modules (like `@sindresorhus/slugify`) to avoid import issues
- Create temporary directories for file-based tests
- Test all stats return values: `created`, `upserted`, `ignored`, `failed`
- Test error handling in both fail-fast and continue-on-error modes

## Linting

After creating any code, the `npx prettier --write` command should be ran. Making sure to lint your created files to
make sure they are aligned with the code standard.
