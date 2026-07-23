# Agent Guide to Menubook

This document provides context and instructions for AI agents working on the menubook codebase.

This is a monorepo, powered by pnpm and turbo, to handle all the elements of the codebase. Menubook is a easy to use,
open source, and extensible restaurant and bar margin and menu system. Allowing users to self-host the system, as well
as cloud-hosted solutions.

> In the `packages/core/rebuild` branch, the codebase is being rebuilt from scratch. If you are working in core, 
> do not make changes to `@packages/app` or `@packages/cli`. These are only to be worked on once the core has been 
> rebuilt. They will break, this is intentional. Make sure you create tests for your changes and validate the tests 
> are working, this is the only way to ensure the codebase is working as expected. As the upstream packages are broken

## Repository Structure

The margin codebase is a monorepo with the following structure:

### Core

* `packages/core`: The job of the core is to provide a common interface to the database and the adaptors. It also 
  provides the business logic for the system, including the calculation engine.

### Data Layer

* `packages/prisma`: Stores the database schema. The database schema is set for postgres.
* `packages/postgres`: Our postgres database adapter.
* `packages/sqlite`: Our sqlite database adapter.

### CLI

* `packages/cli`: CLI command implementations and infrastructure.

### App

* `packages/app`: The main webapp entrypoint. It uses the core and the database adapters to provide the API and UI.

> Each package potentially has its own AGENTS.md file, for use by the AI agent. Read those before proceeding.

## Setup & Build

To set up the environment and build the project:

```bash
pnpm install --frozen-lockfile
```

## Testing

Be wary when running all tests in the repository as it takes a lot of time.

Preferred to run tests for a specific project instead:

```bash
# From the project directory
pnpm test

# From the root, filtering by package name
pnpm --filter <package_name> test
```

Or better yet, run tests for a specific file:

```bash
pnpm --filter <package_name> test <file_path>
```

Or a specific test case in a specific file:

```bash
pnpm --filter <package_name> test <file_path> -t <test_name_pattern>
```

## Linting

To run all linting checks:

```bash
npm run lint
```

## Never ignore test failures

Do not dismiss a failing test as a "pre-existing" failure that is unrelated to your changes. Every test failure must be investigated and fixed. If a test was already broken before your changes, fix it as part of your work — do not silently skip it or treat it as acceptable.

## Code Reuse and Avoiding Duplication

**Before writing new code, always analyse the existing codebase for similar functionality.** This is a large monorepo with many shared utilities — duplication is a real risk.

-   **Search before you write.** Before implementing any non-trivial logic, search the codebase for existing functions, utilities, or patterns that do the same or similar thing. Check `lib/utils/` and other shared directories first.
-   **Extract shared code.** If you find that the logic you need already exists in another package but is not exported or reusable, refactor it into a shared package rather than duplicating it. If you are adding new code that is similar to code that already exists elsewhere in the repo, move the common parts into a shared package that both locations can use.
-   **Prefer open source packages over custom implementations.** Do not reimplement functionality that is already available as a well-maintained open source package. Use established libraries for common tasks (e.g., path manipulation, string utilities, data structures, schema validation). Only write custom code when no suitable package exists or when the existing packages are too heavy or unmaintained.
-   **Keep the dependency on the right level.** When adding a new open source dependency, add it to the most specific package that needs it, not to the root or to a shared package unless multiple packages depend on it.

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

-   `feat`: a new feature
-   `fix`: a bug fix
-   `docs`: documentation-only changes
-   `style`: formatting, missing semi-colons, etc.
-   `refactor`: code change that neither fixes a bug nor adds a feature
-   `perf`: a code change that improves performance
-   `test`: adding missing tests
-   `chore`: changes to build process or auxiliary tools

You should use each individual package as the scope (`feat(prisma): ..., fix(core): ...`), or the package that is 
affected the most by the change (`feat(core): ...`) even if you have touched multiple packages like CLI or webapp.

The exception to the above rule is when a change affects multiple adaptors, in that case split each change in each 
package as their own commit such as (`feat(postgres): ..., feat(sqlite): ...`)

## Code Style

This repository uses [Standard Style](https://github.com/standard/standard) with a few modifications:
-   **Trailing commas** are used.
-   **Classes** are used, they are the main way to define elemetents due to DI being used.
-   **Functions are declared after they are used** (hoisting is relied upon).
-   **Functions should have no more than two or three arguments.** If a function needs more parameters, use a single options object instead.
-   **Import Order**:
    1.  Standard libraries (e.g., `fs`, `path`).
    2.  External dependencies (sorted alphabetically).
    3.  Relative imports.

To ensure your code adheres to the style guide, run:

```bash
pnpm lint
```

### Comments

Write code that explains itself. A reader should understand what a function does from its name, parameters, and types — not from prose above the call site.

Defaults:

-   **Do not write a comment** that restates what the code already says. If renaming a variable, splitting a helper, or moving a check to a more obvious place would carry the information, do that instead.
-   **Do not repeat documentation** at call sites that already lives on the callee. If the function has a JSDoc, the call site shouldn't re-explain what calling it does. Update the JSDoc once; let every call site benefit.
-   **JSDoc is for the function's contract** — preconditions, postconditions, edge cases, why the function exists. Not for re-narrating the body.
-   **Do not record past implementation shape, refactor history, or "the previous code did X" framing.** That's what `git log` and `git blame` are for. Describe the current contract — what the code is and what it guarantees — not what it replaced. Phrasings like "used to", "previously", "the original X", or a parenthetical naming a removed type belong in the commit message, not in the source.

Write a comment only when:

-   The reason for the code is non-obvious from reading it (a hidden invariant, a workaround for a known bug, a deliberate exception to the surrounding pattern).
-   The right name doesn't fit — e.g., a temporary technical constraint that's worth flagging but doesn't justify a new symbol.

Before adding a comment, ask: "Could I rename, restructure, or extract instead?" If yes, do that. The bar for prose-in-code is high; the bar for prose-that-restates-code is "don't."
