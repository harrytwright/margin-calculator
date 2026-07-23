# Core Service Layer

The core service layer is the canonical DB access boundary for Menubook. It wraps the generated database types
and exposes minimal operations with relationship expansion. UI/API and CLI/TUI wrap these services and add their
own validation, file system syncing, and event handling.

## Responsibilities

- Provide typed access to the database via Kysely.
- Normalize SQLite vs Postgres differences using `DatabaseContext` (`helpers` + `type`).
- Validate DB-shape inputs before writes (lightweight Zod).
- Manage pricing history tables (`IngredientCost`, `RecipePrice`) and current pricing lookups.
- Invalidate cache entries for margin/dashboard calculations on relevant mutations.

## Non-goals

- No API schema validation or YAML validation (callers handle these).
- No file system sync (workspace YAML is handled by CLI/TUI or other callers).
- No user-facing events or analytics.
- No domain rule enforcement beyond DB-shape validation.

## DatabaseContext

`DatabaseContext` provides the database instance and helpers for JSON aggregation. It also identifies the
adapter type so we can normalize DB-specific behaviors.

```ts
export interface DatabaseContext {
  db: Kysely<DB>
  helpers: {
    jsonArrayFrom: typeof import('kysely/helpers/postgres').jsonArrayFrom
    jsonObjectFrom: typeof import('kysely/helpers/postgres').jsonObjectFrom
  }
  type: 'sqlite' | 'postgres'
}
```

## Validation and Normalization

Core validation lives in `packages/core/src/validation`. It is intentionally narrow:

- Validates only DB-shape fields (types, required keys, nullability).
- Coerces numeric-like input (e.g. `"400"` or `400`) into the DB-safe format.
- Rejects major mismatches (e.g. boolean for a date, non-numeric for numeric fields).
- Drops unknown keys.

Normalization between SQLite and Postgres happens at insert/update time using `context.type`:

- Boolean values become `0/1` for SQLite.
- BigInt values are cast for SQLite where needed.
- Date values are serialized to ISO strings for SQLite.

## Transactions

Public service methods accept an optional `trx`. If provided, the method runs inside that transaction; otherwise
the method executes inside a new transaction.

## Cache Invalidation

`IngredientService` and `RecipeService` accept an optional `CacheAdapter`. When mutations occur, they invalidate
`margin:*` and `dashboard:*` cache patterns to keep derived stats consistent.

## CLI/TUI Mode Restrictions

When running in CLI/TUI mode (`globalThis[Symbol.for('isCLI')] === true`), some mutations are restricted to
prevent breaking file system references:

- Ingredient supplier changes are blocked.
- Supplier identity changes are blocked.
- Slugs remain immutable.
