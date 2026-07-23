---
rfc: 0003
title: Core Rebuild Roadmap
status: in-progress
created: 2026-06-27
owner: Harry Wright
area: packages/core
type: roadmap
scope: core-and-below
---

# RFC 0003: Core Rebuild Roadmap

## 1. Introduction

### 1.1 Background

The original `menubook` concept was a simple file-based CLI that let me build YAML files containing recipes, ingredients, and suppliers to work out our margins, aptly named `margin`. This was a good POC, demonstrating the value of a simple CLI and the ability to estimate costs; however, it was not a great fit for a larger team. Since I was the only one with CLI knowledge and most systems at work were Windows-based, it meant it would never be scalable. The next step was to build a web-based app that used this FS-backed core, with a database layer built around it. This would work to help display the data in a more user-friendly way, but it failed to solve two problems: scale and usability. The user would still have to spin up the CLI and a local server to work with the data, not just a simple web app they could use anywhere; this was where the scale issue comes in. We could not create an easy-to-use cloud version this way, as the system was designed to be run locally, with the FS being the source of truth. The rebuild project aims to solve these issues.

### 1.2 Proposal

Migrate `menubook` from a filesystem-first shape to a database-first service. We need a ground-up approach to this, starting with a database-first approach, with a heavy focus on SQLite and Postgres, so that this application moves from a CLI-based web app for querying data to a database-backed system that can be used in any environment, either locally or in the cloud. This in itself fixes the issues of scale and usability.

The focus here is not on adding overly complex features to the core; the core should be expandable, with DI patterns baked in. The entry points `@menubook/cli` and `@menubook/app` should add their own flair to the core, working with the data in ways that suit them. See [0004](./0004-core-rebuild-cli-and-webapp.md) for the changes for each entry point

### 1.3 Abandoned Ideas

I had originally planned to work with how the system worked, offer a `--database-only` flag for the CLI where the webapp being spun up would ignore all the YAML files, working idenpendetly with the built-in SQLite database, this worked as a simple interface for the data, but still had the limitations above, the user had to have basic knowledge of Unix systems, and it would struggle to scale to multple users, a cloud-based approach was near on impossible, because of the bloat the system would bring with it, all the added FS code included

### 1.4 Things this fixes

Scale, being a database first, means we can create a cloud-based version of the application fixing the usability issue at the same time, but also with the scale itself allows us to not be limited by the file system, we’d be limited by the database instead, allowing the application to scale to any size of business, from a single person with a food truck, to a multinational company with thousands of restaurants.

Usability, being heavily focused on the CLI, meant we alienated users who were less technical; they would have 
needed a basic understanding of terminals and a computer that could run them, i.e., Linux or Unix-based platforms. Whilst the crux of the entry point will still be the CLI, the fact that our WebApp will be built from the ground up to run independently of the CLI, allowing us to build a cloud-based version of the application which still uses the `@menubook/core` as the root for everything

## 2. Implementation

### `@menubook/prisma`

We will create a new `@menubook/prisma` package; this will be the source of truth for all our database schema. 
Whilst we use `Kysely` as our query builder, taking advantage of `Prisma` and its generators to create our TS types, 
using `Kysely` to handle migrations based on our new database-adaptor pattern for each individual adaptor, 
`@menubook/sqlite` and `@menubook/postgres`.

The code will autogenerate, based on the `prisma-kysely` generator and a custom script with creates more 
TypeScript friendly helper interfaces for working within the structure defined bellow, exported by the `src/index.ts` 
file.

#### Schema changes

We will also be making some changes to the schema, adding a new `Pricing` table, which will be linked to both the 
`ingredient` and `recipe` tables, this will allow us to store the price temporaly, so we can have a pricing history 
of the ingredients and recipes, with that we are migrating to BigInt for the `cost` column, removing the deicmal, 
instead with a `currency` column, the value will be localised for calculations. taking inspiration from stripe

### `@menubook/sqlite` & `@menubook/postgres`

These are our adaptors for the database, previously we only had a SQLite connection, this worked for the FS idea 
with a database behind it, but wanting to support a more cloud-based approach, we needed a better long term approach,
working with postgres to make that work, but since we still wanted to support the FS idea, we need to keep the 
SQLite connection around for the CLI, and demo used on the website.

These adaptors are simple, they wrap the `Kysely` drivers, export the same helper functions, following the 
`DatabaseAdaptor` interface, which set the structure for the database adaptors, with the migrations and seeds being 
built in. Both adaptors handle their own migrations, should mirror each other, and define their own quirks where needed.

Each adaptor then exports a `DatabaseContext` object as `default`, this allows the adaptor to be used as a dependency 
for the core, swapped and changed without the core really knowing which is which, apart from where the those certain 
quirks appear, i.e. numbers and booleans

### `@menubook/core`

`@menubook/core` will rip out its file-system code; instead, this will be handled by a new `@menubook/sync`. The core will do as it says on the tin, be the shared core code for each entry point @menubook/{cli,app}

The core will have a simple structure like so:

```text
src/
    cache/        -> Adaptor pattern for caching, useful for Cloud mode
    datastore/    -> Wrapper for the database adaptors
    lib/          -> Handles the business logic
    services/     -> Our entry to the database, wrappers for Kysely queries
    utils/        -> Shared helpers
    validation/
        ajv/
        zod/
    index.ts
```

We would build in a cache layer at the core level, this would in `REALM=local & globalThis[Symbol.for('isCLI')] === true` works as an in-memory cache, as this setup is for local work running just as the CLI, whilst when running as a web-app, the cache can be either in-memory or redis backed. As these have the option of being multi-tenanted based on CLI options

#### `datastore/`

The `datastore/` folder would allow us to build an adaptor registration, where we can register which adaptors we want via optional peer dependencies, with the callee `@menubook/app` or `@menubook/cli` having the adaptors they support set as dependencies.

The register itself can return the correct adaptor, if loaded, based on the connection string.

#### `lib/`

The `lib/` is where all the business logic should be stored:

`calculator.ts` is the main core of the actual project; it is what makes the system work. Its job is to calculate 
how much your recipe costs to make and whether you're hitting your margins. In its current guise, it works as intended; 
it needs to be updated to work with the new typings and class functions where needed. Caching should be woven in 
where possible to speed up response times, but it is not as important for the rebuild; working 99% accurate, ± rounding 
errors is the goal.

`importer.ts` should be modified to work with raw buffers rather than just the file path. The goal for `importer.ts` is to be agnostic; it should allow the `@menubook/app` to parse uploaded files, not just YAML files from the file system. The changes here are that the uploaded files will not allow references via files, as linkages will break, but should allow for slug parsing. This means the dependency graph itself is still relevant, as we can allow for a bulk upload, and all files being handled via slug, think exported YAMLs being imported back in again. Adjustments to the Dep-Graph being built will need to be made.

All other file system-related classes should be commented out; they are no longer needed in `@menubook/core`. They need to be rebuilt in the new `@menubook/sync` package, which will store all filesystem code and, with the new `SyncEngine` class, handle and keep the filesystem up to date. Once the sync engine has been built we will remove those files.

#### `services/`

The `services/` directory is where we store our database layer; each major table has its own file, which is a class with public methods for accessing the data. Outside of these, the database should never be queried by the raw `DatabaseContext` object unless you are extending one of the classes inside the core within a callee package.

At a minimum, the service class should follow the same pattern as below, the functions bellow are mandetory, others can be added, but should follow simialar conventions

```typescript
export class <Table>Service {
    constructor(private readonly context: DatabaseContext) { }
    
    get database() {
      return this.context.db
    }
    
    get transaction() {
      return this.database.transaction()
    }
    
    // Check whether this is running as a CLI/TUI or not, see `RuntimeContext` below
    get isInCLIMode() {
        return this.context.runtime.isCLI
    }
    
    find(trx?: Transaction<DB>): Promise<> {}
    
    findById(slug: IDType, trx?: Transaction<DB>): Promise<> { }
    
    create(args: New<Table>, ..., trx?: Transaction<DB>): Promise<> { }
    
    update(slug: IDType, args: Update<Table>, ..., trx?: Transaction<DB>): Promise<> { }
    
    delete(slug: IDType, trx?: Transaction<DB>): Promise<boolean> { }
}
```

`IDType` is the type is `type IDType = string | number`, this allows either a slug or an ID to be used, comonly done 
as such: `.where(typeof slug === 'string' ? 'slug' : 'id', '=', slug)`.

For creations, updates, and deletes, they should wrap the `transaction` method:

```typescript
create(...) {
  const query = async (trx: Transaction<DB>) => {}
  return trx ? query(trx) : this.transaction.execute(query)
}
```

This transaction object is then passed to all future database calls, so that we can ensure that the database is 
always in a consistent state, hence why the `trx?: Transaction<DB>` parameter is defined for all methods, allowing 
non-transactional calls to be made, i.e. `GET /api/recipes` requests, but getting the results of a create or update 
request would require a transaction so you get the new/updated data.

#### `validation/`

The `validation/` directory is still up to debate, should it be here, or under a separate package? What should it 
store? Should it just validate the Raw YAML? Should it just handle API/Input data to database types etc? To be decided

#### `utils/`

The `utils/` directory is to store shared code and functions that are only used by this package. If we have any that could be shared between packages, they should be migrated to @menubook/shared instead

### `@menubook/sync`

The `@menubook/sync` package will be responsible for handling all filesystem-related code, it's job is to handle the 
syncing of the filesystem with the database, where when ran via the CLI, the user can still choose to work with raw YAML 
files, in this sense the SQLite database is still the source of truth when running, if the user makes a change to a 
YAMl file, the sync engine will then update the database, if the database is updated, the sync engine will then update 
the filesystem.

The only time the database is not the source of truth is when the CLI is not running, on first CLI start up, the job 
is to check for drift, and account for any changes that have been made to the YAML files, if any changes are found, 
the sync engine will upsert those changes into the database.

The main reason for keeping the database is for query speed and memory usage, the end goal of `@menubook/cli` is to 
eventually run a TUI, and be ported to a localised free to use electron app, lets say the client has 3 locations, 
and hundreds of recipes, with different suppliers per location, trying to calculate the cost of these with constant 
I/O and memory usage, would kill the app, the database is the answer.

The rough layout of the sync engine is as follows:

```text
src/
    sync/
        sync-engine.ts       -> Handles the syncing of the filesystem with the database
        sync-service.ts      -> Adds extra functionality to the database layer which is needed for syncing
    filesystem/
        file-watcher.ts     -> Watches for changes in the filesystem,
        file-writer.ts      -> A wrapper to handle writing to the filesystem adding headers for autogeneration
        file-hash.ts        -> Handles the hashing of the files, for faster writing/importing
    utils/                  -> Store helper code
    validation/
        zod/                -> Store zod validation schemas
    index.ts
    importer.ts             -> A wrapper around the core importer, linking the sync engine and filesystem helpers to the core importer
```

### `RuntimeContext`

Originally the run state of the core was determined by two overlapping signals: `globalThis[Symbol.for('isCLI')]` 
and `process.env.REALM`. Since the two could never be set at the same time, they were really one variable, so they 
have been collapsed into a single realm value:

```text
REALM=cli | local | cloud | demo
```

Where `cli` is the CLI/TUI, `local` and `cloud` are the webapp realms, and `demo` is a special realm used for the 
website demo, built on Asynchronous Local Storage and `:memory:` SQLite databases 
(see [001](./001-demo-asynclocalstorage.md)).

Rather than services reading globals, the realm is carried on an injected `RuntimeContext`, passed alongside the 
`DatabaseContext`, which will expose helpers such as `isCLI` and `isWebApp` so call sites do not need to compare 
`runtime.realm === 'cli'` by hand.

<!-- TODO: code section for `RuntimeContext` and its helpers -->

The `cli` realm still drives behavioural constraints, i.e. when in CLI/TUI mode, suppliers cannot be deleted, they 
can only be updated, this is done to prevent invalid/uncontrolled file reference errors.

The notes about the CLI constraints are something I need to flesh out, as the sync engine needs to handle the condition
where the CLI itself cannot delete a supplier, but the user could delete the file.

## 3. Notes

This is a pure rebuild, which means breaking changes. The CLI and webapp, as seen in
[0004](./0004-core-rebuild-cli-and-webapp.md), will either handle the migration, or cease to exist in a way seen in
previous code, i.e. the WebApp will be a completely new application, whilst the CLI will be an indetical to the previous
version just with the database-backed core, on first-run the CLI should migrate all files and the database to the new
schema and structure.

With that being said, upstream changes for packages like `@menubook/cli` and `@menubook/app` should be ignored, the 
build will fail, this is okay. The goal of the RFC is the core rebuild only, the CLI and webapp will be handled in 
separate RFCs but the same PR.

*DO NOT RABBIT HOLE DOWN FIXES TO THE CLI AND WEBAPP. THAT INCLUDES YOU HARRY TOO*

## 4. Progress

> This section should be updated as the RFC progresses.

### Work Completed

- [x] `@menubook/prisma` created; schemas migrated in as the source of truth
- [x] `Pricing` table added (BigInt cost + currency, `validFrom`/`validTo` history), replacing the old
      `purchaseCost`/`sellPrice` columns
- [x] Shared types stripped out of core into their own package
- [x] `@menubook/sqlite` & `@menubook/postgres` adapters, each owning their migrations (incl. settings)
- [x] Core services rebuilt on `DatabaseContext` + the Pricing relation chain (supplier, ingredient, recipe, config)
- [x] Config/settings now database-backed via `Settings(id = 1)`
- [x] Calculator rebuilt against the new Pricing relation chain
- [ ] `importer.ts` reworked to accept raw buffers, slug-only references for uploads
- [ ] `RuntimeContext` implemented and threaded through the services
- [ ] `cache/` layer (interface + in-memory implementation)
- [ ] `@menubook/sync` package: `SyncEngine`, file watcher/writer/hash migrated out of core
- [ ] Commented-out FS code removed from core once the sync engine lands

### Decision Log

> Any important decisions made during the implementation of this RFC, that are not obvious from the implementation plan, should be documented here.

| Date       | Decision                                                 | Notes                                                         |
|------------|----------------------------------------------------------|---------------------------------------------------------------|
| 2026-06-27 | Services are the completed baseline for the rebuild.     | Next pass should start with `src/lib`.                        |
| 2026-06-27 | Settings are database-backed through `Settings(id = 1)`. | Public config reads now use repository-style `find*` methods. |

## 5. Comments

> Open implementation questions raised in review. These are build/design issues, not editorial
> notes; each should end up either answered in the relevant section above or recorded in the decision log.

### 5.1

> (Claude, 2026-07-10)

**SyncEngine conflict policy.** The sync is bidirectional with two writers, and the conflict rule is never stated.
Two concrete cases: (a) on startup, file drift is upserted into the database — but the database may *also* have
drifted if a previous session crashed after a DB write but before the file writeback; (b) while running, a file
watcher event and a DB write to the same entity can race. The hashes from `file-hash.ts` can detect both, but
detection is not resolution — the RFC should commit to a rule (e.g. files win on startup, last-write-wins while
running) and log it as a decision.

> Race conditions are the main issue with sync engines of all types, in out implementation drifts should be handled 
> by a git diff style conflict resolution, the CLI should be able to handle this via a select which version is correct.
> This way the user gets to choose which version is correct, the CLI is meant to be used by developers, not less 
> technical users, which is why they would have a base for git, in theory, I would even go as far to say that the 
> folder location with the YAML files should be backed by git too. But in theory; User runs `margin calculate 
> <recipe>`, the CLI attemepts to build the graph, unable to due to drift, the user can then choose to either accept
> the drift or fix it, calculation will then continue. Alternatively, a readonly log, which stores all the DB 
> changes; if the CLI is behind, on restart the CLI will check what is missing and rebuild based on the log

### 5.2

> (Claude, 2026-07-10)

**The supplier-delete constraint is decorative as specified.** The CLI refuses to delete suppliers to protect file
references, but the user can delete the YAML file — and if the sync engine honours that deletion by removing the
row, the constraint protects nothing. Suggested resolution: file deletions go through the same
referential-integrity check as API deletes, and when a delete would dangle references the sync engine rewrites the
file from the database and surfaces a warning (the autogeneration headers from `file-writer.ts` make regeneration
defensible).

> This would be linked to the above, where if the drift is a deleted file, it would be autoregenerated, with a warning 
> in the CLI about file deletion. The only way to delete a supplier would be to rebuild the database from scratch, 
> which is simple `margin database reset && margin import <path-to-yaml-files>` which would allow the user to delete 
> the database and start over.

### 5.3

> (Claude, 2026-07-10)

**Currency exponent and mixed currencies.** "The value will be localised for calculations" needs pinning down. If
`cost` is Stripe-style minor units, say so explicitly, and note the exponent wrinkle: JPY has no minor unit, some
currencies use three decimals — the exponent has to live somewhere (currency lookup table vs. hardcoded map). And
what happens when an ingredient's pricing currency differs from the recipe's — reject, convert, or constrain a
workspace to a single currency? The calculator needs an answer before it can be correct.

> Mixed currencies are not supported, the user must choose a single currency for the workspace. This is just set 
> within the configuration, if the currency is updated, all prices for the workspace are updated to match. We will 
> work fully like stripe; £1.50 is { cost: 150, currency: 'GBP' }, whilst ¥150 is { cost: 150, currency: 'JPY' }. There
> should be a shared helper function to be able to handle pre-determinated currencies, which are supported by the
> calculator. The user can only select from those, we will add more as we go

### 5.4

> (Claude, 2026-07-10)

**Single-active-Pricing invariant.** "Current price" presumably means the row where `validTo IS NULL`. Nothing
enforces there being exactly one such row per ingredient/recipe. Postgres can enforce it with a partial unique
index; SQLite needs an equivalent (partial index works there too) — and the "close old row + insert new row" step
must happen inside one transaction or a crash leaves two active prices.

> This is a database constraint, which I overlooked, will goback, and add a task to look into it. Good spot

### 5.5

> (Claude, 2026-07-10)

**Adapter resolution via optional peer dependencies.** Resolving the adaptor from the connection string implies a
dynamic `import()` of a package that may not be installed. That is fine in plain Node, but bundlers and the
planned Electron packaging both handle optional dynamic imports badly — this should be prototyped early, before
the registry API calcifies.

> My thought here was just using try/catch with `require`, having neither has default, throw and fail to start w/o any 
> adaptor, allows for treeshaking, where the CLI/TUI can use both, but the webapp can only use the postgres adaptor.

### 5.6

> (Claude, 2026-07-10)

**Transaction threading across services.** The `trx?` parameter works within one service, but composed operations
(e.g. a recipe create that touches ingredients and pricing) span services. The convention that every public method
accepts and forwards `trx` needs to be stated as mandatory — one service opening its own transaction mid-way
through another's breaks the consistency guarantee the pattern exists for.

> In my head I know that this parameter is mandatory, and should be added for each database touching service layer. 
> This is to be enforced.

### 5.7

> (Claude, 2026-07-10)

**Cache scope is undefined.** The core layout reserves `cache/` but the RFC never says who consults it (services,
calculator, both), how invalidation works on writes, or how keys are tenant-scoped in the `cloud` realm. Since
caching is explicitly non-critical for the rebuild, the cheapest fix is to punt formally: interface + in-memory
implementation now, policy deferred to a follow-up RFC.

> I have not yet fully decided on this yet, the cache layer is more boilerplate, adding the rough concept here, so 
> it will be easy to add later. Where the layer is needed, i.e. calculating the cost of a recipe, loading data 
> faster, exports/imports etc


