# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GoBowling Margin Calculator - A CLI tool for managing recipes, ingredients, and calculating profit margins for food service operations. Tracks ingredient costs from suppliers, calculates recipe costs including sub-recipes, and helps maintain target profit margins.

**Current Version:** 0.1.0

**Key Features:**

- Recursive recipe cost calculation with sub-recipe support
- VAT handling for ingredients and customer pricing
- Unit conversion system (standard + custom units)
- Yield-based scaling for sub-recipes
- Multiple output formats (pretty CLI, summary, JSON)
- Web UI for non-technical users
- YAML/JSON import with dependency resolution

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

# Generate changelog from conventional commits
npx conventional-changelog -p angular -i CHANGELOG.md -s
```

## Git Conventions

This project uses **Conventional Commits 1.0.0** for all git messages (commits, merges, tags).

**Format:** `<type>(<scope>): <message>`

**Common types:**

- `feat`: New feature
- `fix`: Bug fix
- `chore`: Maintenance tasks (e.g., dependencies, releases, merges)
- `docs`: Documentation changes
- `test`: Test additions or updates
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `ci`: CI/CD changes

**Examples:**

```bash
git commit -m "feat(calculator): Add yield scaling for sub-recipes"
git commit -m "fix(vat): Strip VAT from ingredient purchase costs"
git commit -m "chore(git): Merge branch 'feature/web-ui'"
git commit -m "chore(release): v0.1.0"
```

**Versioning:**

- Use `npm version <version>` to bump version and create git tag
- This automatically updates package.json and creates a tag
- Use `git push --tags` to publish tags to remote

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

const { stats } = await importer.import(['file1.yaml', 'file2.yaml'])
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

### Calculator & Margin Calculation

The `Calculator` class (`src/lib/calculation/calculator.ts`) is the core engine for cost and margin calculations:

**Key Features:**

- **Recursive Calculation**: Traverses recipe tree, calculating costs for ingredients and sub-recipes
- **Yield Scaling**: Converts requested amounts based on recipe yields (e.g., 50ml from 1L yield = 0.05x cost)
- **Unit Conversion**: Three-tier approach:
  1. Try standard unit conversion (ml→L, g→kg) using `convert-units`
  2. Try case-insensitive custom unit match (Sandwich→sandwich)
  3. Fallback to 1:1 with warning log
- **VAT Handling**: All calculations ex-VAT (see VAT Handling section)
- **Depth Limiting**: Maximum recursion depth of 10 to prevent infinite loops

**Main Methods:**

```typescript
class Calculator {
  // Calculate recipe cost with full breakdown tree
  async cost(recipe: string, depth?: number): Promise<RecipeResult>

  // Calculate ingredient cost (called internally)
  private async ingredientCost(
    ingredient: RecipeIngredientsLookup,
    depth: number
  )

  // Scale sub-recipe cost based on yield
  private scaleSubRecipe(
    result: RecipeResult,
    ingredient: RecipeIngredientsLookup,
    depth: number
  ): number

  // Calculate margin, profit, and VAT
  async margin(recipe: RecipeResult): Promise<MarginResult>
}
```

**Cost Tree Structure:**

The `cost()` method returns a tree structure for visualization:

```typescript
interface RecipeResult {
  recipe: Recipe
  totalCost: number
  tree: CostNode[]
}

interface CostNode {
  type: 'ingredient' | 'recipe'
  name: string
  amount: number
  unit: string
  cost: number
  children?: CostNode[] // For sub-recipes
}
```

### VAT Handling

VAT is handled at multiple levels in the system:

**Ingredient Purchase Costs:**

- If `Ingredient.includesVat = 1`, VAT is stripped: `purchaseCost / (1 + vatRate)`
- All recipe calculations use ex-VAT ingredient costs

**Recipe Pricing:**

- Recipes store `sellPrice` in pence (ex-VAT)
- `Recipe.includesVat` indicates VAT eligibility (not "price includes VAT")
- Customer price calculated as: `sellPrice + (sellPrice * vatRate)` for eligible items

**Configuration:**

- VAT rate stored in `data/conf/margin.toml`
- Default: 20% (0.2)
- Accessed via `ConfigService.getVatRate()`

**Margin Calculation:**

- All margins calculated ex-VAT: `(sellPrice - cost) / sellPrice * 100`
- Profit calculated ex-VAT: `sellPrice - cost`

### Reporter Pattern

The project uses a **Jest-style reporter pattern** for flexible output formatting:

**Key Concepts:**

- **Stateless Reporters**: Reporters receive aggregated data at each callback
- **Centralized State**: Runner manages state (`numComplete`, `numPending`, etc.)
- **Lifecycle Hooks**: `onStart`, `onCalculation`, `onFinish`

**Base Reporter Interface:**

```typescript
interface Reporter {
  onStart(recipes: Recipe[]): Promise<void>
  onCalculation(
    recipe: Recipe,
    result: CalculationResult,
    aggregated: AggregatedResults
  ): Promise<void>
  onFinish(aggregated: AggregatedResults): Promise<void>
}
```

**Available Reporters:**

1. **DefaultReporter** (`src/lib/calculation/reporters/DefaultReporter.ts`)
   - Pretty CLI output with tree visualization
   - Color-coded margins (green = meets target, red = below)
   - Shows full cost breakdown with indentation
   - Use for: Single recipe calculations, detailed analysis

2. **SummaryReporter** (`src/lib/calculation/reporters/SummaryReporter.ts`)
   - Aggregated statistics for bulk operations
   - Shows success/failure counts, average/min/max margins
   - Compact output for large datasets
   - Use for: Bulk calculations, reports across all recipes

3. **JSONReporter** (`src/lib/calculation/reporters/JSONReporter.ts`)
   - Structured JSON output for programmatic access
   - Includes summary and full results array
   - Use for: Automation, integration with other tools, API responses

**Example Usage:**

```typescript
const calculator = new Calculator(recipeService, ingredient, config)
const reporter = new DefaultReporter()

await runCalculations(calculator, recipeService, ['pizza', 'burger'], reporter)
```

### Configuration Management

Configuration is managed via TOML files in `data/conf/` using `ConfigService`:

**ConfigService** (`src/services/config.ts`):

```typescript
class ConfigService {
  constructor(workingDir: string) // Points to project root

  async getVatRate(): Promise<number> // Default: 0.2 (20%)
  async getDefaultMargin(): Promise<number> // Default target margin
}
```

**Configuration File** (`data/conf/margin.toml`):

```toml
vat = 0.2              # 20% VAT rate
default_margin = 65    # Default target margin percentage
```

**Features:**

- File-based configuration (not database)
- Caching for performance
- Default values if file missing or fields undefined

### Web UI Architecture

The Web UI provides a browser-based interface for non-technical users:

**Backend** (`src/server/`):

- **Express Server**: RESTful API with JSON endpoints
- **Static Assets**: Serves frontend from `src/server/public/`
- **Auto-open**: Opens browser automatically on startup (configurable)

**API Endpoints** (`src/server/routes/api.ts`):

```
GET /api/recipes              - List all recipes
GET /api/recipes/:slug        - Get recipe details
GET /api/recipes/:slug/calculate - Calculate cost and margin
GET /api/report               - Calculate all recipes
```

**Frontend** (`src/server/public/index.html`):

- Single-page application with vanilla JavaScript
- Tailwind CSS (CDN) for styling
- Two views:
  1. **Recipe List**: Grid of recipe cards with cost, price, margin
  2. **Recipe Detail**: Full cost breakdown tree, margin analysis
- Color-coded margins (green/red)
- Responsive design

**Starting the UI:**

```bash
margin ui                 # Default port 3000, auto-opens browser
margin ui -p 8080        # Custom port
margin ui --no-open      # Don't auto-open browser
```

**Build Process:**

The `postbuild` script copies static assets to dist:

```json
"scripts": {
  "build": "tsc -p tsconfig.build.json",
  "postbuild": "cp -r src/server/public dist/server/"
}
```

### Data Model Structure

**Core Entities:**

- **Supplier**: Ingredient suppliers (e.g., wholesalers)
- **Ingredient**: Raw ingredients with purchase details (cost, unit, supplier)
  - `includesVat`: Whether purchase cost includes VAT (1 = yes, 0 = no)
- **Recipe**: Menu items, base templates, or sub-recipes
  - `includesVat`: Whether item is VAT-eligible for customer pricing (1 = yes, 0 = no)
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
- Case-insensitive matching for custom units

**Pricing & Margins:**

- Recipes store `sellPrice` (in pence, ex-VAT), `includesVat`, and `targetMargin`
- Sub-recipes define `yieldAmount` and `yieldUnit` for proper cost calculation
- System calculates cost from ingredients recursively through sub-recipes
- Margins always calculated ex-VAT

**Identifiers:**

- All entities use auto-incrementing integer IDs
- Slugified names (`slug` field) are used for human-readable references during imports
- Slugs are generated using `@sindresorhus/slugify`

## CLI Structure

The CLI uses Commander.js with a subcommand structure:

```
margin [global-options] <command>

Global Options:
  --verbose                 Set log level to verbose
  --quiet                   Set log level to warnings only
  --working [dir]           Set working directory (default: ./data)
  -d, --database [name]     Set database name (default: margin.sqlite3)
  -v, --version             Display version number

Commands:
  initialise                Initialize working directory structure
  import <files...>         Import any entity type (auto-detects from YAML/JSON)
    --root [dir]              Custom root for @/ references
    --fail-fast               Stop on first error

  recipe
    calculate <slugs...>      Calculate cost and margin for recipes
      --json                    Output as JSON
    report                    Generate report for all recipes
      --json                    Output as JSON
    import <file>             DEPRECATED: Use `margin import` instead
    list                      List all recipes

  ingredient
    import <file>             DEPRECATED: Use `margin import` instead

  supplier
    import <file>             DEPRECATED: Use `margin import` instead

  ui                        Launch web UI
    -p, --port <port>         Port to run on (default: 3000)
    --no-open                 Don't auto-open browser

  config
    set                       Update configuration (VAT rate, margins)
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

## Calculating Costs & Margins

### Single Recipe Calculation

```bash
# Pretty CLI output with tree visualization
margin recipe calculate pizza

# Multiple recipes
margin recipe calculate pizza burger sandwich

# JSON output for automation
margin recipe calculate pizza --json
```

### Bulk Report Generation

```bash
# Summary statistics for all recipes
margin recipe report

# JSON output
margin recipe report --json
```

### Web UI

```bash
# Launch web interface (auto-opens browser)
margin ui

# Custom port
margin ui -p 8080

# Don't auto-open browser
margin ui --no-open
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

After creating any code, the `npx prettier --write` command should be run. Making sure to lint your created files to make sure they are aligned with the code standard.

## Future Enhancement Ideas

This section contains ideas for future development beyond v0.1.0:

### High Priority

1. **Batch Import Performance**
   - Add progress bars for large imports
   - Parallelize independent imports
   - Transaction batching for better performance

2. **Recipe Inheritance**
   - Implement `parentId` inheritance logic
   - Allow recipes to inherit ingredients from base templates
   - Support overriding specific ingredients in child recipes

3. **Cost Analysis Features**
   - Historical cost tracking (price changes over time)
   - Cost trend analysis
   - Supplier comparison reports

4. **Export Functionality**
   - Export recipes/ingredients back to YAML/JSON
   - CSV export for spreadsheet analysis
   - PDF report generation

### Medium Priority

5. **Interactive Recipe Builder**
   - CLI prompts for creating recipes without YAML
   - Ingredient picker with autocomplete
   - Yield calculator helper

6. **Validation & Warnings**
   - Warn about recipes with missing ingredients
   - Flag ingredients with stale pricing
   - Suggest margin improvements

7. **Multi-Currency Support**
   - Support multiple currencies
   - Currency conversion rates
   - Currency-specific formatting

8. **Web UI Enhancements**
   - Edit recipes in browser
   - Inline cost calculations
   - Filtering and sorting
   - Recipe search

### Low Priority

9. **API Mode**
   - Standalone API server
   - Authentication/authorization
   - Rate limiting

10. **Reporting Dashboard**
    - Charts and graphs
    - Margin distribution visualization
    - Cost breakdown pie charts

11. **Multi-tenant Support**
    - Multiple databases
    - User management
    - Role-based access control

12. **Integration Plugins**
    - Import from POS systems
    - Export to accounting software
    - Supplier API integration

### Implementation Notes

When implementing new features:

- Follow existing patterns (Service layer, Reporter pattern, etc.)
- Add tests for all new functionality
- Update CLAUDE.md with new conventions
- Use Conventional Commits for all changes
- Consider backward compatibility with existing data
