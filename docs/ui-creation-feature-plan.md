# UI Creation & File-Based Persistence - Implementation Plan

## Overview

This plan outlines the implementation of creation/editing capabilities in the Web UI with file-based persistence and automatic reloading.

**Core Concept:** Files remain the source of truth. The API saves to both database and filesystem, while a file watcher automatically re-imports when files change externally.

---

## Phase 1: Importer Enhancement (Core Infrastructure)

### 1.1 Add Slug-to-Path Mapping

- Add `private slugToPath: Map<string, string>` to `Importer` class
- Populate during `resolveFile()` - after slugifying, store `slug -> absolutePath`
- Add public getter: `getPathForSlug(slug: string): string | undefined`
- Add public getter: `getAllMappings(): Record<string, string>`

### 1.2 Add Import-Only Mode

- Add `importOnly?: boolean` to `ImporterOptions`
- When `importOnly: true`:
  - Skip all database operations in processors
  - Return resolved/validated data structures instead
  - Still resolve dependencies and validate schemas
- Modify processor pattern to support dual modes:

  ```typescript
  type ProcessorResult = 'created' | 'upserted' | 'ignored'
  type ResolvedData<T> = { slug: string; data: T; path: string }

  // Processors return different types based on mode
  // importOnly: false -> ProcessorResult
  // importOnly: true -> ResolvedData<T>
  ```

### 1.3 Return Parsed Data

- Modify `import()` method to return additional data when `importOnly: true`:
  ```typescript
  interface ImportResult {
    stats: ImportStats
    resolved?: Map<string, ResolvedData<any>> // Only when importOnly: true
  }
  ```

---

## Phase 2: File Persistence Service

### 2.1 Create FileWriter Service

**Location:** `src/lib/file-writer.ts`

**Methods:**

- `async write(type: <type>, slug: string, data: <Type>ImportData, workingDir: string)`
- `async deleteFile(path: string)`

**Implementation:**

- Uses YAML.stringify to write files
- Determines file path from slug and entity type
- Creates directories if they don't exist
- Preserves existing file location on updates (via slug->path map)

### 2.2 File Location Strategy

- **New entities:** `data/{suppliers|ingredients|recipes}/{slug}.yaml`
- **Updated entities:** Use existing path from `slugToPath` map
- **Deleted entities:** Remove file at mapped path

**File Format:**

```yaml
object: supplier # or 'ingredient', 'recipe'
data:
  name: Supplier Name
  # ... entity-specific fields
```

---

## Phase 3: File Hash System

### 3.1 Create HashService

**Location:** `src/lib/hash-service.ts`

**Features:**

- Use `crypto.createHash('sha256')` for file hashing
- Store hashes in memory: `Map<string, string>` (path -> hash)
- Optional: Persist to SQLite for restart resilience

> ✅ Implemented via `src/lib/hash-service.ts` with accompanying tests in
> `src/lib/__tests__/hash-service.test.ts`.

**Methods:**

- `async computeHash(path: string): Promise<string>`
- `async hasChanged(path: string, oldHash: string): Promise<boolean>`
- `updateHash(path: string, hash: string): void`

### 3.2 Hash Storage Table (Optional Migration)

```sql
CREATE TABLE FileHash (
  path TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  lastChecked INTEGER NOT NULL  -- timestamp
)
```

---

## Phase 4: File Watcher System

### 4.1 Create FileWatcher Service

**Location:** `src/lib/file-watcher.ts`

**Features:**

- Use `chokidar` package for reliable cross-platform watching
- Watch `data/**/*.yaml` directories and files

> ✅ Implemented via `src/lib/file-watcher.ts`, with unit coverage in
> `src/lib/__tests__/file-watcher.test.ts` and end-to-end validation in
> `src/lib/__tests__/file-watcher.integration.test.ts`.

**On File Change:**

1. Compute new hash
2. Compare with stored hash
3. If different, trigger re-import of that file
4. Update hash cache

**Configuration:**

- Debounce rapid changes (300ms) to avoid multiple imports
- Ignore temporary files (`.swp`, `.tmp`, etc.)

### 4.2 Integration with Server

- Initialize watcher when server starts
- Pass database instance to watcher for re-imports
- Optionally emit events for UI notifications (WebSocket/SSE)

> ✅ UI server now boots the watcher by default (toggle with `--no-watch`), and
> the CLI `import` command offers a `--watch` mode for continuous ingest.

---

## Phase 5: API Endpoints for CRUD

### 5.1 Create Endpoints

> ✅ Implemented in `src/server/routes/api.ts` with reusable logic housed in
> `src/server/services/entity-persistence.ts`, alongside unit coverage in
> `src/server/services/__tests__/entity-persistence.test.ts`.

**Location:** `src/server/routes/api.ts`

**Suppliers:**

```
POST   /api/suppliers          - Create supplier + file
PUT    /api/suppliers/:slug    - Update supplier + file
DELETE /api/suppliers/:slug    - Delete supplier + file
```

**Ingredients:**

```
POST   /api/ingredients        - Create ingredient + file
PUT    /api/ingredients/:slug  - Update ingredient + file
DELETE /api/ingredients/:slug  - Delete ingredient + file
```

**Recipes:**

```
POST   /api/recipes            - Create recipe + file
PUT    /api/recipes/:slug      - Update recipe + file
DELETE /api/recipes/:slug      - Delete recipe + file
```

### 5.2 Endpoint Implementation Pattern

```typescript
// Example: POST /api/recipes
router.post('/recipes', async (req, res) => {
  try {
    // 1. Validate with Zod schema
    const validData = RecipeImportDataSchema.parse(req.body)

    // 2. Generate slug if not provided
    const slug = validData.slug || (await slugify(validData.name))

    // 3. Check if already exists
    const existing = await findById.call(db, slug)
    if (existing) {
      return res.status(409).json({ error: 'Recipe already exists' })
    }

    // 4. Save to database
    await upsert.call(db, slug, validData)

    // 5. Write to file
    await fileWriter.writeRecipe(slug, validData, workingDir)

    // 6. Return created entity
    const created = await findById.call(db, slug)
    res.status(201).json(created)
  } catch (error) {
    if (error instanceof z.ZodError) {
      res
        .status(400)
        .json({ error: 'Validation failed', details: error.errors })
    } else {
      res.status(500).json({ error: error.message })
    }
  }
})
```

---

## Phase 6: Frontend UI Forms

> ✅ Management forms and lists are implemented in
> `src/server/public/index.html`, supporting create, edit, and delete flows via
> the API.

### 6.1 Create Entity Forms

**Location:** `src/server/public/forms.html` or inline modals in `index.html`

**Forms Needed:**

- Form for creating/editing suppliers
- Form for creating/editing ingredients (with supplier dropdown)
- Form for creating/editing recipes (with ingredient picker)

**Features:**

- Validation matching Zod schemas (client-side + server-side)
- Cancel/Save buttons
- Modal dialogs or dedicated pages

### 6.2 Update Recipe List View

**Enhancements:**

- Add "Create New" button for each entity type
- Add "Edit" button on each card
- Add "Delete" button with confirmation dialog

### 6.3 Form Submission

- Use Fetch API to POST/PUT to endpoints
- Show success/error messages (toast notifications)
- Refresh list after successful creation/update
- Handle validation errors gracefully

---

## Phase 7: Real-time Updates (Optional)

> ✅ `/api/events` streams watcher activity to the browser (see
> `src/server/routes/api.ts` and `src/server/index.ts`). The UI listens with an
> `EventSource`, refreshing data automatically.

### 7.1 Server-Sent Events (SSE)

**Endpoint:** `/api/events`

**Events:**

```typescript
{
  type: 'supplier' | 'ingredient' | 'recipe',
  action: 'created' | 'updated' | 'deleted',
  slug: string
}
```

**Implementation:**

- FileWatcher emits events on file changes
- SSE endpoint broadcasts to all connected clients

### 7.2 Frontend Event Listener

- Connect to SSE endpoint on page load
- Update UI when events received
- Show notification: "Pizza recipe updated by external change"
- Optional: Highlight changed items

---

## Technical Dependencies

### New Packages

```json
{
  "chokidar": "^3.5.3", // File watching
  "yaml": "^2.3.4" // YAML serialization (may already have)
}
```

### Dev Dependencies

```json
{
  "@types/chokidar": "^2.1.3"
}
```

---

## Implementation Order

1. **Phase 1** (Importer) - Foundation for everything else
2. **Phase 2** (FileWriter) - File persistence layer
3. **Phase 5** (API CRUD) - Backend functionality
4. **Phase 6** (Frontend Forms) - User-facing features
5. **Phase 3** (Hash System) - Optimization
6. **Phase 4** (File Watcher) - Automatic reloading
7. **Phase 7** (Real-time) - Polish

---

## Testing Strategy

### Unit Tests

**FileWriter:**

- Test YAML serialization matches import format
- Test file creation in correct directories
- Test file updates preserve location

**HashService:**

- Test hash computation is consistent
- Test change detection works correctly
- Test hash cache management

**Importer:**

- Test `importOnly` mode returns correct data structures
- Test slug-to-path mapping is accurate
- Test existing functionality still works

### Integration Tests

**API Endpoints:**

- Test full create/update/delete cycles
- Test validation errors are handled correctly
- Test file is created/updated/deleted alongside DB

**FileWatcher:**

- Test file change detection triggers re-import
- Test hash-based filtering prevents unnecessary imports
- Test debouncing works correctly

**End-to-End:**

1. Create entity via UI
2. Verify file exists on filesystem
3. Modify file manually
4. Verify UI updates automatically

---

## Migration Path

### For Existing Installations

1. On first run with file watching:
   - Compute hashes for all existing files
   - Store initial hashes in cache/database
2. Start watching immediately after initialization
3. Existing manual workflows (CLI import) continue to work unchanged
4. No breaking changes to existing data or commands

---

## Edge Cases to Handle

### 1. Concurrent Edits

**Scenario:** User edits in UI while file changes externally

**Solution:**

- Last write wins (file watcher will re-import the file version)
- Optional: Show conflict notification in UI
- Future: Implement conflict resolution UI

### 2. Invalid Manual Edits

**Scenario:** User creates invalid YAML manually

**Solution:**

- FileWatcher catches error during re-import
- Log error but don't crash server
- Optional: Show error in UI via SSE
- Keep last known good state in database

### 3. Slug Changes

**Scenario:** User renames entity (slug changes)

**Solution:**

- Create new file with new slug
- Delete old file
- Update slugToPath mapping
- Update references in dependent entities

### 4. Dependency Changes

**Scenario:** Recipe references new ingredient

**Solution:**

- FileWatcher detects recipe file change
- Re-import validates dependency exists
- If missing, import fails with helpful error
- UI shows validation error

### 5. Circular Dependencies

**Scenario:** Recipe A uses Recipe B which uses Recipe A

**Solution:**

- Existing circular detection in Importer applies
- Prevent via validation in UI forms (disable self-reference)
- Show error message if detected during import

### 6. File Deletions

**Scenario:** User deletes file manually

**Solution:**

- FileWatcher detects deletion
- Mark entity as deleted in UI (or remove from DB)
- Warn if other entities depend on it

### 7. Bulk Changes

**Scenario:** User does git pull with many file changes

**Solution:**

- Debouncing prevents import storm
- Process changes in batches
- Show progress notification in UI

---

## Future Enhancements (Post-Implementation)

1. **Conflict Resolution UI**
   - Show diff when file and DB diverge
   - Allow user to choose which version to keep

2. **Batch Operations**
   - Import/export multiple entities at once via UI
   - Bulk edit capabilities

3. **Undo/Redo**
   - Store edit history for rollback
   - Time-travel debugging

4. **Version Control Integration**
   - Git commit on each change via UI
   - Automatic commit messages

5. **Multi-user**
   - Lock files during editing to prevent conflicts
   - Real-time collaboration features

6. **Audit Trail**
   - Track who changed what and when
   - Integration with FileHash table

7. **Import Validation UI**
   - Real-time validation as user types in forms
   - Preview calculated costs before saving

8. **Template System**
   - Save entity templates for quick creation
   - Duplicate existing entities

---

## Success Criteria

**Phase 1-2 Complete When:**

- ✅ Importer has `importOnly` mode working
- ✅ Slug-to-path mapping is accurate
- ✅ FileWriter can create valid YAML files
- ✅ Unit tests pass for all new functionality

**Phase 5-6 Complete When:**

- ✅ All CRUD endpoints work correctly
- ✅ UI forms can create/edit/delete entities
- ✅ Changes persist to both DB and files
- ✅ Validation works on both client and server

**Phase 3-4 Complete When:**

- ✅ File watcher detects changes
- ✅ Hash system prevents unnecessary imports
- ✅ Manual file edits update UI automatically

**Full Feature Complete When:**

- ✅ All phases implemented
- ✅ All tests passing
- ✅ Documentation updated
- ✅ Edge cases handled gracefully
- ✅ User can create/edit/delete entities via UI
- ✅ Manual file edits are respected
- ✅ No data loss scenarios

---

## Risk Assessment

### High Risk

- **Data Loss:** Concurrent edits could overwrite changes
  - Mitigation: Last-write-wins + notifications

### Medium Risk

- **Performance:** File watching on large datasets
  - Mitigation: Debouncing + hash-based filtering
- **Circular Imports:** Recursive dependency resolution
  - Mitigation: Existing Importer safeguards apply

### Low Risk

- **File Format Changes:** Breaking changes to YAML structure
  - Mitigation: Version field in YAML files
- **Cross-platform:** File watching differences
  - Mitigation: Use battle-tested `chokidar` library

---

## Rollout Plan

### v0.2.0-alpha

- Phase 1-2 only
- Internal testing of importer changes
- No UI changes yet

### v0.2.0-beta

- Phases 1-5 complete
- API endpoints functional
- UI forms in beta

### v0.2.0

- All phases complete
- Full documentation
- Stable release
