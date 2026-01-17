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

### v0.4.0

> May have made a mini mistake, 0.3.0 was already released, so any works for 0.4.0 will be tagged with the items 
> above too.

#### Core

> @menubook/core

Core will not be touched here.

#### Webapp

> @menubook/app

Time to finish off the migration to the new dashboard. Very little to be added, just making sure we get the 
migration sorted and linked

- Remove old dashboard
- Modernise the stack to be fully ESJ/HTMX. With DasiyUI and tailwind being the styling
- e2e testing. Not 100% but covers the basic
- Basic express prometheus metrics

**Open Alpha - Demo**

This will be a demo to display user work, to be close to fleshed out, but the idea would be an sqlite3 per session.
Each session works independently, where the user can do minimal work, but has a quick LRUCache used, so if the
sqlite3 database is not used after 30 mins the database will be removed?

`REALM=cloud` will be used with a secret `DEMO=true` to be used as a feature flag to handle the sqlite3 database
mapping and session handling.

**Implementation:**

- `:memory:` SQLite per session with LRU cache (max 100 sessions, 30min TTL)
  - Session ID stored in cookie
  - Fresh DB created on first access with migrations
  - Automatic cleanup via LRU disposal (garbage collected, no file cleanup needed)
- 410 Gone response for expired sessions
  - Client shows "Your demo session expired. Refresh to start a new one." popup
  - Seamless restart flow
- Basic Prometheus metrics exposed at `/metrics`
  - Session lifecycle: created, active, expired, duration
  - User engagement: actions (create/calculate/export), recipes/ingredients created
  - System health: 410 responses, LRU evictions, memory usage
- PostHog integration for demo funnels (only when `DEMO=true`)
  - Track feature adoption and conversion flows
  - Identify drop-off points in onboarding
  - Removed/disabled in production (`DEMO!=true`)
- Migrate from SPA to endpointed routes.
  - `/management/:type`
  - `/margin`
  - `/settings` - Disabled for demo
  - `/help` - Disabled for demo

#### CLI

> @menubook/cli

Changes to make sure the migration of the webapp go through correctly

#### Landing Page

> @menubook/web

This will just be a few minor changes. Whilst we are going the SaaS route, this app will still be a simple B2B 
application, we cannot forget out routes, offering an ease of use for a market that is often miss-understood. Where 
when you google this concept you get basic calculators in a website, or a spreadsheet you do not know if it is a 
virus, or if it will work for your specification

- Turn the UI from generic AI designed to be closer to human-made
  - Removing dependency on the purple that AI agents love
  - removing emojis for icons
  - Using https://saaslandingpage.com/tag/software/ as a good base for inspiration

This does not effect anything else, I do get that we will be missing screenshots, but if we finish the webapp 
migration first, we can use those for the website. Even if we understand we are in a beta stage. Could even offer 
some nice looking terminal views to show that it works as a CLI too/eventually a stripped TUI 

**Personal Preferences**

I do like the idea of using mono fonts? Something to feel softwary, but not 90's style? Limited colours, using grays 
in ways to make it feel fresh without being overpowered. Good use of spacing.

### 0.5.0

> TBC

####

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
