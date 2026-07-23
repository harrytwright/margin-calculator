# Services Reference

This document describes the core DB service APIs. These services are the source of truth for database access.
Callers (UI/API and CLI/TUI) wrap them for input validation, file system sync, and domain rules.

## SupplierService

Purpose: CRUD access to suppliers and their contact record.

Key methods:

- `find(options?, trx?)`
  - `options.allowJoins` controls whether `SupplierContact` is joined.
  - `options.includeGeneric` controls inclusion of the seeded `generic` supplier.
- `findById(id, trx?)`
- `create(args, trx?)`
- `update(id, args, trx?)`
- `exists(slugOrId, trx?)`
- `delete(slug, trx?)`
- `upsert(slug, data, trx?)`

Notes:

- Slug is immutable after creation.
- In CLI/TUI mode, updates to supplier identity fields are blocked.
- Contact data is stored in `SupplierContact` and joined when requested.

## IngredientService

Purpose: CRUD access to ingredients with current and historical pricing.

Key methods:

- `find(trx?)` returns ingredients with current pricing.
- `findById(slugOrId, withSupplier?, trx?)` returns current pricing, optional supplier, and pricing history.
- `create(args, supplierRef, costing, trx?)`
- `update(slug, args, trx?)`
- `delete(slugOrId, trx?)`
- `updatePricingHistory(ingredientId, costing, trx?)`
- `exists(slug, trx?)`

Notes:

- `supplierRef` may be a numeric id or a slug.
- Pricing history is modeled via `Pricing` + `IngredientCost`.
- Cache invalidation occurs on mutations.
- In CLI/TUI mode, supplier changes are blocked.

## RecipeService

Purpose: CRUD access to recipes with pricing history and ingredient relationships.

Key methods:

- `find(trx?)` returns recipes with current pricing.
- `findById(id, options?, trx?)`
  - `options.withIngredients`
  - `options.withHistoricalPrices`
  - `options.withChildren`
- `create(args, pricing?, ingredients?, trx?)`
- `updatePricingHistory(recipeId, pricing, trx?)`
- `handleIngredient(recipe, 'put', input, trx?)`
- `handleIngredient(recipe, 'delete', slug, trx?)`
- `exists(slug, trx?)`

Ingredient input formats:

- By id:
  - `{ ingredientId, subRecipeId, quantity, unit, notes? }`
- By slug:
  - `{ type: 'ingredient' | 'recipe', slug, quantity, unit, notes? }`

Notes:

- Pricing history is modeled via `Pricing` + `RecipePrice`.
- Cache invalidation occurs on mutations.
