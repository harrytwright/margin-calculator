## `@menubook/core`

Core database service layer for Menubook. It wraps the generated database types and exposes minimal, DB-first
operations with relationship expansion. CLI/TUI and UI/API wrap these services with their own validation,
file system sync, and event handling.

### Scope

- Typed database access for suppliers, ingredients, and recipes.
- SQLite/Postgres normalization via `DatabaseContext` helpers and `context.type`.
- Lightweight DB-shape validation before writes (Zod, narrow and coercive).
- Pricing history management for ingredients and recipes.
- Cache invalidation hooks for margin and dashboard stats.

### Out of scope

- API or YAML validation (handled by callers and import schemas).
- File system sync between DB and workspace.
- Domain-level rules and user-facing errors.
- Events, analytics, or UI shaping.

### Docs

- `packages/core/docs/service-layer.md`
- `packages/core/docs/services.md`
