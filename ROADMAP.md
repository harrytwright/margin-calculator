# GoBowling Margin Calculator - Roadmap

## Current Version: 0.2.0

This document tracks planned features and improvements for future releases.

---

## Future Enhancements

This is a build for the focus on core and CLI, having a working product is better than no product at all.

Changes of separation: CLI will be the root for everything, the webapp is independent, but to be launched by the CLI

This changes the way the webapp works, rather than being an extension of the CLI, it works as its own system. No
file storage, only database backed. `REALM=cloud|local` used as env vars, cloud will only work with a postgres
database, local can be either. Defaults to the sqlite for ease.

The CLI is to turn into a TUI, where it could be locally ran without the need for the internet, to be offered as a
fully free product throughout its life, with less builtin functionality of the webapp.

### 0.3.0

These changes are in the line for v1's release, but we need to get there first.

#### Core

These are the bulk changes for `>0.3.0 <1.0.0`.

> For just 0.3.0 the main here is getting the databases closer. Added a priority tag for each row

- ✅ ~~Add multi-database adapters, ready for future usage~~ `high` - **DONE**
  - `@menubook/types` - shared Kysely types (auto-generated from Prisma via `pnpm generate`)
  - `@menubook/sqlite` - SQLite adapter with migrations
  - `@menubook/postgres` - PostgreSQL adapter with squashed initial migration
  - `DatabaseContext` pattern in core for adapter injection
  - ✅ CLI wired to use adapter registry with `--database` connection string support
- Localisation extendability, offering VAT handling for multiple locations via a DSL? `low`
- ✅ ~~Caching~~ `medium` - **DONE**
  - ✅ `CacheAdapter` interface with `TTLCache` and `NoopCache` implementations
  - ✅ Injected into services via DI, same pattern as database adapters
  - ✅ Cache margin reports (TTL: 5 minutes) - DashboardService updated
  - ✅ Invalidate on ingredient/recipe updates - hooks added to services
- ✅ ~~Database Fixes~~ `high` - **DONE**
  - ✅ Added indices for `Recipe.parentId`, `Ingredient.supplierId`, `RecipeIngredients.subRecipeId`
  - ✅ Added indices for `Recipe.category`, `Recipe.class`
- Working in windows, linux, macos. This way when a TUI we can offer to be used anywhere `low`

#### CLI

Work with the new core changes.

**options changes**

- ✅ `--database` option which uses the protocol to detect adapter (`postgresql://` → postgres, otherwise → sqlite)
- ✅ `--file-system` / `--no-file-system` to enable/disable file system operations
  - Defaults to `true` for `REALM=local`, `false` for `REALM=cloud`
  - When `false`: uses `database-only` storage mode, disables file watching
  - ✅ `--storage` deprecated with warning (use `--file-system` instead)

**command changes**

- ✅ `$ margin ui`
  - Uses `resolveRealmConfig()` for consistent REALM handling
  - `--standalone` continues as-is (database-only, no file watching)
- ✅ `$ margin import --watch`
  - Blocked in `REALM=cloud` mode (exits with error)

#### Webapp

Migrate what's needed for `REALM` support, no new features for 0.3.0. Core is the priority.

- ✅ Support `REALM=cloud|local` environment variable (auto-detected at server startup)
- ✅ Database-only storage mode working (no `FileSystemStorage` dependency when `REALM=cloud`)
- Webapp can have its big moment in 0.4.0 with the full migration to `ejs` & `htmx`

Since this migration will set up a working MVP to be hosted online for a closed alpha, this is the big next step, and
needs to be fully thought out.

---

## Completed Features

### v0.2.0

- ✅ Empty states with call-to-action buttons
- ✅ Delete functionality with confirmation modals
- ✅ Loading spinners on all API operations
- ✅ Error toast notifications
- ✅ Immutability protection for ingredient suppliers (API + UI)
- ✅ Filtering and navigation bug fixes
- ✅ Inline editing in recipe detail modal
- ✅ Duplicate button to clone recipes
- ✅ Sorting options (name, cost, margin)
- ✅ Cascade delete warnings with usage counts

### v0.1.0

- ✅ Core recipe costing with sub-recipes
- ✅ VAT handling for ingredients and pricing
- ✅ Unit conversion system (standard + custom)
- ✅ Web UI for non-technical users
- ✅ YAML/JSON import with dependency resolution
- ✅ Docker deployment with auto-initialization

---

## Deprecation Notices

### v0.3.0

#### `--database <filename>` (filename-only usage)

- **Deprecated**: Passing just a filename to `--database` (e.g., `--database mydb.sqlite3`)
- **Replacement**: Use a full path (`--database /path/to/mydb.sqlite3`) or connection string (`--database postgresql://...`)
- **Removal**: v0.4.0
- **Migration**: Update scripts/commands to use absolute paths or connection strings

When a filename-only value is detected, the CLI will log a deprecation warning:

```
⚠️ Passing a filename to --database is deprecated. Use a full path or connection string. This will be removed in v0.4.0.
```

#### `--storage <mode>` option

- **Deprecated**: The `--storage fs|database-only` option
- **Replacement**: Use `--file-system` or `--no-file-system`
- **Removal**: v0.4.0
- **Migration**: Replace `--storage fs` with `--file-system`, replace `--storage database-only` with `--no-file-system`

When `--storage` is used, the CLI will log a deprecation warning:

```
⚠️ --storage is deprecated and will be removed in v0.4.0. Use --file-system or --no-file-system instead.
```

---

## Ideas & Proposals

### Multi-tenant Support

- User authentication & authorization
- Workspace/team management
- Role-based access control (admin, editor, viewer)

### Recipe Versioning

- Track changes to recipes over time
- Compare historical costs
- Rollback to previous versions

### Inventory Management

- Track stock levels for ingredients
- Low stock alerts
- Automatic reordering suggestions

### Supplier Integration

- Import pricing from supplier APIs/CSVs
- Automatic price updates
- Price comparison across suppliers

### Advanced Reporting

- Export reports to PDF/Excel
- Scheduled email reports
- Custom report builder

### Mobile App

- Native iOS/Android apps
- Offline-first architecture
- Barcode scanning for ingredients

---

## Contributing

Have ideas for the roadmap? Open an issue at the project repository with:

- Feature description
- Use case / problem it solves
- Proposed implementation approach (optional)
