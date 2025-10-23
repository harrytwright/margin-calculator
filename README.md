# 📖 Menu Book

A powerful tool for managing recipes, ingredients, and calculating profit margins for food service operations. Tracks ingredient costs from suppliers, calculates recipe costs including sub-recipes, and helps maintain target profit margins. Features both a beautiful web UI and powerful CLI.

**Created by GoBowling Shipley Lanes**

## Features

- 📊 **Recursive Cost Calculation** - Accurately calculates costs including sub-recipes (e.g., pizza sauce in a pizza)
- 💰 **Margin Analysis** - Compare actual vs. target margins with color-coded indicators
- 🧾 **VAT Handling** - Automatically strips VAT from ingredient costs and adds it to customer prices
- 📦 **Yield Scaling** - Scale recipe costs based on yield (e.g., 1L sauce yields 20 portions)
- 📱 **Web UI** - Beautiful web interface for non-technical users
- 📥 **YAML Import** - Easy data management with YAML files
- 🔗 **Sub-recipes** - Use recipes as ingredients in other recipes
- 📈 **Multiple Reporters** - Pretty CLI output, JSON for automation, or summary statistics

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/margin.git
cd margin

# Install dependencies
npm install

# Build the project
npm run build

# Initialize the working directory
node dist/index.js initialise
```

## Quick Start

### 1. Initialize Your Project

```bash
node dist/index.js initialise --working ./my-restaurant
```

This creates:

- `./my-restaurant/data/` - Database and data files
- `./my-restaurant/conf/` - Configuration files

### 2. Import Your Data

```bash
# Import suppliers
node dist/index.js import data/suppliers/*.yaml

# Import ingredients (automatically imports referenced suppliers)
node dist/index.js import data/ingredients/*.yaml

# Import recipes (automatically imports all dependencies)
node dist/index.js import data/recipes/*.yaml
```

### 3. Calculate Costs & Margins

```bash
# Calculate specific recipes
node dist/index.js recipe calculate cheese-sandwich ham-sandwich

# Generate a report for all recipes
node dist/index.js recipe report

# Get JSON output for automation
node dist/index.js recipe calculate cheese-sandwich --json
```

### 4. Launch the Web UI

```bash
# Start the web interface (auto-opens browser)
node dist/index.js ui

# Run on a custom port
node dist/index.js ui --port 8080

# Disable auto-open
node dist/index.js ui --no-open
```

## Data Format

### Supplier (YAML)

```yaml
object: supplier
data:
  name: ASDA
  contact:
    email: orders@asda.com
    phone: '0800 123 4567'
```

### Ingredient (YAML)

```yaml
object: ingredient
data:
  name: Cheddar Cheese
  category: dairy
  supplier:
    uses: '@/suppliers/asda.yaml'
  purchase:
    unit: 1kg
    cost: 5.99
    vat: false # true if purchase price includes VAT
```

### Recipe (YAML)

```yaml
object: recipe
data:
  name: Cheese Sandwich
  class: menu_item # or base_template, sub_recipe
  stage: active
  costing:
    price: 350 # £3.50 in pence
    margin: 25 # Target 25% margin
    vat: false # true if VAT-eligible (e.g., hot food)
  ingredients:
    - uses: '@/ingredients/cheddar-cheese.yaml'
      with:
        unit: 50g
    - uses: '@/ingredients/white-bread.yaml'
      with:
        unit: 2 slices
```

### Sub-Recipe Example

```yaml
object: recipe
data:
  name: Pizza Sauce
  class: sub_recipe
  yield:
    amount: 1
    unit: L
  ingredients:
    - uses: '@/ingredients/tomatoes.yaml'
      with:
        unit: 500g
    # ... more ingredients

---
# Using the sub-recipe
object: recipe
data:
  name: Margherita Pizza
  class: menu_item
  costing:
    price: 1200 # £12.00
    margin: 30
  ingredients:
    - uses: '@/recipes/pizza-sauce.yaml'
      with:
        unit: 50ml # Automatically scales from 1L yield
```

## CLI Commands

### Global Options

```bash
--working <dir>     # Working directory (default: ./.margin)
--database <name>   # Database filename (default: margin.sqlite3)
--verbose          # Verbose logging
--quiet            # Only show warnings
```

### Available Commands

#### `initialise`

Initialize a new margin project

```bash
margin initialise [--force]
```

#### `import <files...>`

Import suppliers, ingredients, or recipes from YAML files

```bash
margin import data/**/*.yaml [--root <dir>] [--fail-fast]
```

#### `recipe calculate <slugs...>`

Calculate cost and margin for specific recipes

```bash
margin recipe calculate cheese-sandwich ham-sandwich [--json]
```

#### `recipe report`

Generate a summary report for all recipes

```bash
margin recipe report [--json]
```

#### `ui`

Launch the web UI

```bash
margin ui [-p <port>] [--no-open]
```

## Web UI

The web UI provides a visual interface for viewing recipes and their margins:

- **Recipe List**: Grid view showing all recipes with cost, price, and margin
- **Detail View**: Click any recipe to see full cost breakdown including sub-recipes
- **Color Coding**: Green for recipes meeting target margin, red for below target
- **Nested Display**: Sub-recipes shown as expandable trees
- **Mobile Responsive**: Works on desktop and mobile devices

![Web UI Screenshot](docs/screenshot.png)

## Configuration

Edit `conf/margin.toml` in your working directory:

```toml
# VAT rate (decimal, e.g., 0.2 for 20%)
vat = 0.2

# Default target margin (percentage)
marginTarget = 25
```

## Development

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Generate database types after schema changes
npm run generate:database
```

## Architecture

- **Database**: SQLite with Kysely query builder
- **Schema**: Prisma schema → Kysely types
- **Migrations**: Custom Kysely-based migration system
- **Import System**: Centralized `Importer` class with dependency resolution
- **Reporter Pattern**: Pluggable reporters for different output formats
- **Calculator**: Recursive cost calculation with VAT handling and yield scaling

## License

MIT

## Contributing

Contributions welcome! Please follow Conventional Commits for commit messages.
