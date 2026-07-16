# Agents.md (sqlite)

Guidance for AI working with Prisma.

**Read [`../../AGENTS.md`](../../AGENTS.md) first.** It covers the conventions that apply across the whole monorepo — 
GitHub PR workflow, signing agent-authored content, conventional commit messages, code-reuse philosophy, 
"never ignore test failures," and the PR-conflict resolution script. This file specializes those rules for 
our sqlite adaptor

## What this project is?

This is our wrapper for the Kysely query-builder, allowing a shared plate for all our database adaptors. Wrapping 
them and helper functions under a single interface, `DatabaseContext` from `../shared/src/database/context.ts` 
allowing us to use the same code for all adaptors.

## Relation to `@menubook/prisma`

Our prisma package is the source of truth for the database schema, this is where we define the tables and anything 
within the database, the adaptors are entrypoints to build our queries on top of. Any schema work must be done in 
`@menubook/prisma` before you even touch or create any migrations within this package

## Layout

```text
AGENTS.md
src/
  migrations/   -> Store of our migrations,
  dialect.ts    -> The core kysely wapper
  helpers.ts    -> Exports `jsonArrayFrom, jsonObjectFrom` from the kysely helpers
  migrate.ts    -> Entrypoint for migrations.
```

You should *never* manually create a migration file, instead using the `../../scripts/migration.mjs` script. This will 
generate a new migration file for you, for all adaptors. If this script fails, stop. DO NOT CREATE YOUR OWN FILES

## Migrations

Migrations are stored in the `./src/migrations` folder. They should have both an up and down migration. Allowing for 
us to easily revert changes.
