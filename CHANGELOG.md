# [0.2.0](https://github.com/harrytwright/margin-calculator/compare/v0.1.0...v0.2.0) (2025-10-17)

### Bug Fixes

- **persistence:** retry importer on transient parse errors ([1d6ff45](https://github.com/harrytwright/margin-calculator/commit/1d6ff45))
- **ui:** Adjust `ingredient-row` overflow ([050282c](https://github.com/harrytwright/margin-calculator/commit/050282c))
- **ui:** enable proper scrolling in recipe modal ([1feb639](https://github.com/harrytwright/margin-calculator/commit/1feb639))

### Features

- **api:** add create endpoints backed by file persistence ([9a427e1](https://github.com/harrytwright/margin-calculator/commit/9a427e1))
- **api:** add update endpoints ([83f6842](https://github.com/harrytwright/margin-calculator/commit/83f6842))
- **api:** add delete endpoints ([9d17f0b](https://github.com/harrytwright/margin-calculator/commit/9d17f0b))
- **cli:** add --workspace flag for user data separation ([a961d30](https://github.com/harrytwright/margin-calculator/commit/a961d30))
- **file-writer:** add auto-generation warning header to YAML files ([6c67478](https://github.com/harrytwright/margin-calculator/commit/6c67478))
- **server:** stream watcher events over SSE ([f331342](https://github.com/harrytwright/margin-calculator/commit/f331342))
- **server:** Add custom logging ([fdb612b](https://github.com/harrytwright/margin-calculator/commit/fdb612b))
- **src:** Add slug to path map ([8d47e94](https://github.com/harrytwright/margin-calculator/commit/8d47e94))
- **src:** Adjust importer ([fd5de9d](https://github.com/harrytwright/margin-calculator/commit/fd5de9d))
- **ui:** scaffold management forms ([986fd0d](https://github.com/harrytwright/margin-calculator/commit/986fd0d))
- **ui:** enable editing workflows ([fb92a0b](https://github.com/harrytwright/margin-calculator/commit/fb92a0b))
- **ui:** wire management forms to API ([6c9dde9](https://github.com/harrytwright/margin-calculator/commit/6c9dde9))
- **ui:** implement modal-based forms for create/edit operations ([1328be1](https://github.com/harrytwright/margin-calculator/commit/1328be1))
- **ui:** add floating labels and real-time validation ([776d856](https://github.com/harrytwright/margin-calculator/commit/776d856))
- **ui:** add toast notifications and loading states (Phase 3A) ([bd3a22e](https://github.com/harrytwright/margin-calculator/commit/bd3a22e))
- **ui:** add custom delete confirmation modal (Phase 3B) ([fa9c5b1](https://github.com/harrytwright/margin-calculator/commit/fa9c5b1))
- **watcher:** add hash service and file watching support ([a145d0f](https://github.com/harrytwright/margin-calculator/commit/a145d0f))
- add file persistence infrastructure ([d0d30e7](https://github.com/harrytwright/margin-calculator/commit/d0d30e7))

### Code Refactoring

- **commands:** migrate to location/workspace directory structure ([98e2962](https://github.com/harrytwright/margin-calculator/commit/98e2962))
- **init:** separate location and workspace directory creation ([6ce8ac3](https://github.com/harrytwright/margin-calculator/commit/6ce8ac3))
- **ui:** convert forms from floating labels to Tailwind-style inputs ([110dafd](https://github.com/harrytwright/margin-calculator/commit/110dafd))

## Summary

This release introduces comprehensive CRUD functionality for the web UI, live file watching with SSE integration, and a cleaner separation between system data and user workspace. The UI now supports modal-based forms for creating, editing, and deleting entities, with toast notifications and real-time validation. The new `--workspace` flag enables git-friendly recipe management separate from the system database.

**Key improvements:**
- Full entity management through web UI
- Live file watching with automatic database sync
- Location/workspace directory separation
- Server-sent events for real-time UI updates
- Entity persistence with YAML file writing
- Custom HTTP request logging

# [0.1.0](https://github.com/harrytwright/margin-calculator/compare/f403155dfc201cbfd3a985d7255c6fb393cf5794...v0.1.0) (2025-10-13)

### Bug Fixes

- **ci:** Fix ignore file ([d4efbf5](https://github.com/harrytwright/margin-calculator/commit/d4efbf58ef92d34928773c74788b2b38152129c2))
- **ci:** Fix ignore file ([f403155](https://github.com/harrytwright/margin-calculator/commit/f403155dfc201cbfd3a985d7255c6fb393cf5794))

### Features

- **cli:** Add global import ([924bd86](https://github.com/harrytwright/margin-calculator/commit/924bd86f22e2a32ddb97c275f9287c9e58f2e3f8))
- **src:** Added Importer ([c43d0dc](https://github.com/harrytwright/margin-calculator/commit/c43d0dc970e1d904ea4ea6c7426d540460aa9b60))
- **src:** Created basic calculator ([d8838ca](https://github.com/harrytwright/margin-calculator/commit/d8838ca17f52b5a50bfdcf7e7bd310d5a638f4db))
- **tests:** Add service tests ([c254bbc](https://github.com/harrytwright/margin-calculator/commit/c254bbcb1a609a490567f43b6615a749f58eaa1a))
- **ui:** Add web UI for viewing recipes and margins ([9226ea0](https://github.com/harrytwright/margin-calculator/commit/9226ea0365069ef819ca65326ec44ad568d18065))
