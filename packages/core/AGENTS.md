# Agents.md (core)

Guidance for AI working with Prisma.

**Read [`../../AGENTS.md`](../../AGENTS.md) first.** It covers the conventions that apply across the whole monorepo — 
GitHub PR workflow, signing agent-authored content, conventional commit messages, code-reuse philosophy, 
"never ignore test failures," and the PR-conflict resolution script. This file specializes those rules the core of 
menubook

## What this project is?

Core database service layer for Menubook. It wraps the generated database types and exposes minimal, DB-first
operations with relationship expansion. CLI/TUI and UI/API wrap these services with their own validation,
file system sync, and event handling.

## Architecture Direction

Originally the code was set up for a filesystem-first model; however, this is being reworked to be a database-first model 
with a filesystem-only layer built on top of the database allowing the user to still work with files, but not the primary 
persistence model.

The database is the source of truth, even when running with the filesystem layer enabled. In local workflowd, this is 
usually SQLite, unless the user has a Postgres database set up. Even when filesystem sync is enabled,
the database remains the primary persistence layer; files are a secondary interface for users who prefer editing 
YAML or working from the CLI. 

`@menubook/core` owns the database service layer and core business logic. Services should read from and write to the 
database through `DatabaseContext`, without assuming a filesystem is present.

Filesystem/YAML import and export can live in core where it depends on business rules, but ongoing file/database 
consistency should be handled by an explicit sync layer rather than leaking filesystem concerns into core services.

## Rebuild Scope

During the core rebuild, keep changes inside the scope of the current plan or prompt. Do not fix upstream, adjacent,
or not-yet-rebuilt services just because broader tests expose failures there. Validate the tests that cover the current
change, and report unrelated failures clearly instead of expanding the patch.

## Layout

```text
AGENTS.md
src/
  cache/        -> Cache adaptors
  datastore/    -> Easy to use datastore adaptor map. Allows for easy switching between adaptors.
  utils/        -> Helper functions. These are specific to core. Any helper that could be useful to other packages should be moved to `@menubook/shared`
  services/     -> Our database service layer
  lib/          -> The core business logic of the app.
  validation/   -> Validation logic for our database models and the interface with the app/cli layering
```

All main files within src/services and src/lib should export a class, these classes will be handled by DI, allowing for easy mocking.
