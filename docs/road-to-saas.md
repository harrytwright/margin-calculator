# Margin Calculator

## Overview

- **Goal:** Know exact margins on all F&B
- **Owner:** You
- **Status:** Phase 2 In Progress

---

## Success Criteria

- [ ]  Every F&B item has cost, price, margin % calculated
- [ ]  Can identify top 5 most/least profitable items
- [ ]  Shared with business partner for review

---

## Phases

These are the build phases we are running to. So we have a complete, working system to be able to analyise or most important revenue stream, Food and Beverage

### Phase 1

> **Deadline:** October 13 2025

This is the main component of the system. Allowing us to work with a simple CLI, importing yaml files into a database which can then be queried.

- Basic CLI built with `commander.js`. Utilising the subcommand concept to flush the system out.
- Complex import with basic dependency resolution, allowing for complex recipes and structures
- Inheritance of recipes, allowing for base recipes.
- Recipes as ingredients. Allow for the creation of our own supplies
- Calculation engine. Handling VAT/VAT excl. ingredients and recipes. Along with custom conversion rules for weird ingedients.

### Phase 2

> **Deadline:** October 19 2025

This is where the system gets flushed out a bit. UI tooling for non-technically minded users

- Creation of simple UI. Allowing users to create their recipes on the fly without knowleged of YAML and the underlying file structure
- FileWatcher system. Allowing for `margin import --watch` so that the user could leave the system running whilst they worked on multple files. All to be imported upon saving.
- HashService. Speeding up the phase 1 concepts, linking with addtional tools built for phase 2 to allow for a seamless UI, and CLI.
- FileWriter. Allow the API server to create files upon POST requests.
- (Optional) Complete UI to a polished level. This is more for vanity, meaning it can ignored later on.
    - Basic Modal Forms. 
    - Toasts: Let the user know what is happening
    - Searchbar, allowing for looking up items
    - Filtering. When we have 100+ recipes, 200+ ingredients, we will need filtering
    - Validation, both server level and front end level.
    - Dashboard style page.
        - Sidebar Navigation.
            - **Dashboard**: Simple charts for viewing.
            - **Mangement**: Expandable, allow the user to manage their data.
            - **Margin Viewer**: Display the recipes w/ their relevant calculated data.
        - Content

### Phase 3

> **Deadline:** October 30 2025

A complete and portable system.

- `--standalone` mode for the UI. This would remove the dependency of the file system. Allowing the tool to be run inside a docker container, self-contained from the outside world.
- `--api-only` to the `margin ui` command. This would allow the user to spin up a container without UI. So they could use their own dashbaord for linking the system together.
- `margin.exe` progam. Allowing for portability to windows for use locally w/o the need for internet providers
- `--storage <fs|s3|database-only>` Link with the standalone flag, allowing standalone to still save the files to the FS, could be used via a volume flag to access, or allow for linkage to a S3 style bucket, and a database only mode which would be `--standalone`'s default option

### Phase 4

> **Deadline:** TBC

Package as a mini SaaS. Simple tool but works vibes. Offer maximum about of recipes as the cutoff to paid version

- Change naming of `ingredients` and `recipes` to something more generic for use in different industries
- Multi-Tenant system. Adjust database to to add `tennantId`. Adjust CLI to also work like this. Global Sqlite database, project level configuration. CLI is context aware based on `cwd`?
- Offer different database types `--database-type <sqlite|postgres>`. So the CLI is still the main worker for the system. Customised via an env var `REALM=cloud|local`
- Migrate from single html file to templated pages via `ejs` . Allowing for cleaner separation of UI elements, and things like external javascript files loaded from the server itself.
