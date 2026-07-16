# RFC 001: Demo Linking with AsyncLocalStorage

**Status:** Approved
**Created:** 2026-01-27
**Author:** Claude Code

## Overview

Integrate `AsyncLocalStorage` into `DemoPersistenceManager` to provide transparent, request-scoped database context resolution. This eliminates the need to pass `ctx?: DatabaseContext` parameters and bridges the gap where controllers don't pass `req.demoDatabase` to services.

## Current Problem

1. Demo middleware sets `req.demoDatabase` correctly
2. Services have `ctx?: DatabaseContext` parameter pattern ready
3. **Controllers don't pass the demo context** - they call `this.service.find()` without parameters
4. Result: Demo mode is broken for the DI-based controller architecture

## Solution: AsyncLocalStorage Pattern

```
Request → Demo Middleware → demoPersistenceManager.run(ctx, next)
                                    ↓
                           Controller calls service.find()
                                    ↓
                           Service calls #getService()
                                    ↓
                           #getService() checks demoPersistenceManager.getContext()
                                    ↓
                           Returns demo service instance or shared singleton
```

---

## Implementation

### Phase 1: Extend DemoPersistenceManager

**File:** `packages/app/src/datastore/sqlite.demo.ts`

Add AsyncLocalStorage to existing class:

```typescript
import { AsyncLocalStorage } from 'async_hooks'

@register('singleton')
export class DemoPersistenceManager {
  // Existing TTLCache...
  sessions = new TTLCache<string, Session>({...})

  // NEW: Request-scoped context storage
  #asyncStorage = new AsyncLocalStorage<DatabaseContext>()

  constructor(private readonly metrics: Prometheus) {}

  // Existing methods unchanged: get(), create(), destroy()

  // NEW: Execute callback with database context
  run<T>(ctx: DatabaseContext, callback: () => T | Promise<T>): T | Promise<T> {
    return this.#asyncStorage.run(ctx, callback)
  }

  // NEW: Get current request's database context
  getContext(): DatabaseContext | undefined {
    return this.#asyncStorage.getStore()
  }
}
```

### Phase 2: Create Demo Context Middleware

**File:** `packages/app/src/middleware/demo-context.middleware.ts` (NEW)

```typescript
import { middleware } from '@harrytwright/api/dist/core'
import type { NextFunction, Request, Response } from 'express'
import { DemoPersistenceManager } from '../datastore/sqlite.demo'

@middleware()
export class DemoContextMiddleware {
  constructor(private readonly demoManager: DemoPersistenceManager | null) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (!this.demoManager || !req.demoDatabase) {
      return next()
    }
    return this.demoManager.run(req.demoDatabase, () => next())
  }
}
```

### Phase 3: Register in DI Container

**File:** `packages/app/src/service.ts`

```typescript
const demoEnabled = process.env.DEMO === 'true'

const [applet] = await API.register(App)
  .register('globalConfig', new ConfigService(conf.location))
  .register('database', conf.database)
  .register('events', conf.event || new EventEmitter())
  .register(
    'demoManager',
    demoEnabled ? new DemoPersistenceManager(metrics) : null
  )
  .load(config)
  .listen()
```

### Phase 4: Refactor Services (in dependency order)

**Pattern for all services:**

```typescript
@register('singleton')
export default class SupplierServiceImpl {
  readonly supplier: SupplierService = new SupplierService(this.ctx)

  constructor(
    @Inject('database') private readonly ctx: DatabaseContext,
    @Inject('events') private readonly events: EventEmitter,
    @Inject('demoManager')
    private readonly demoManager: DemoPersistenceManager | null
  ) {}

  // Replace ctx? parameter pattern with internal getter
  #getService(): SupplierService {
    const demoCtx = this.demoManager?.getContext()
    return demoCtx ? new SupplierService(demoCtx) : this.supplier
  }

  // Updated methods - no more ctx parameter
  delete(slug: string): Promise<boolean> {
    return this.#getService().delete(slug)
  }

  exists(slug: string): Promise<boolean> {
    return this.#getService().exists(slug)
  }

  // ... all other methods
}
```

**Files to modify (in order):**

1. `packages/app/src/services/supplier.service.ts` - No dependencies
2. `packages/app/src/services/ingredient.service.ts` - Depends on Supplier
3. `packages/app/src/services/recipe.service.ts` - Depends on Ingredient
4. `packages/app/src/services/calculator.service.ts` - Depends on Recipe, Ingredient
5. `packages/app/src/services/analytics.service.ts` - Uses raw DB access

**Ingredient/Recipe/Calculator complexity:**

These need to recreate the full dependency chain for demo context:

```typescript
// IngredientServiceImpl
#getService(): IngredientService {
  const demoCtx = this.demoManager?.getContext()
  if (demoCtx) {
    return new IngredientService(demoCtx, new SupplierService(demoCtx))
  }
  return this.ingredient
}

// RecipeServiceImpl
#getService(): RecipeService {
  const demoCtx = this.demoManager?.getContext()
  if (demoCtx) {
    const supplier = new SupplierService(demoCtx)
    const ingredient = new IngredientService(demoCtx, supplier)
    return new RecipeService(demoCtx, ingredient, this.conf)
  }
  return this.recipe
}
```

### Phase 5: Wire Up Middleware

**File:** `packages/app/src/app.ts`

Add `DemoContextMiddleware` after existing demo middleware:

```typescript
@useMiddleware(cookieParser())
@useMiddleware(demoMiddleware)        // Sets req.demoDatabase
@useMiddleware(DemoContextMiddleware) // Wraps in AsyncLocalStorage.run()
@useControllers([...])
```

---

## Files Summary

| File                                                     | Action                                     |
| -------------------------------------------------------- | ------------------------------------------ |
| `packages/app/src/datastore/sqlite.demo.ts`              | Add AsyncLocalStorage, run(), getContext() |
| `packages/app/src/middleware/demo-context.middleware.ts` | NEW - Middleware to wrap requests          |
| `packages/app/src/service.ts`                            | Register 'demoManager' in DI               |
| `packages/app/src/app.ts`                                | Add DemoContextMiddleware                  |
| `packages/app/src/services/supplier.service.ts`          | Refactor to use #getService()              |
| `packages/app/src/services/ingredient.service.ts`        | Refactor to use #getService()              |
| `packages/app/src/services/recipe.service.ts`            | Refactor to use #getService()              |
| `packages/app/src/services/calculator.service.ts`        | Refactor to use #getService()              |
| `packages/app/src/services/analytics.service.ts`         | Refactor to use #getService()              |

---

## Verification

### Manual Testing

1. Start app with `DEMO=true`:

   ```bash
   DEMO=true pnpm --filter @menubook/app dev
   ```

2. Create supplier in demo session, verify it doesn't appear in main database

3. Open two browser sessions, verify data isolation between sessions

### Unit Tests

Create `packages/app/src/datastore/sqlite.demo.spec.ts`:

```typescript
describe('DemoPersistenceManager', () => {
  test('getContext() returns undefined outside run()', () => {
    expect(manager.getContext()).toBeUndefined()
  })

  test('getContext() returns context inside run()', async () => {
    const ctx = createMockDatabaseContext()
    await manager.run(ctx, () => {
      expect(manager.getContext()).toBe(ctx)
    })
  })

  test('nested run() uses innermost context', async () => {
    const ctx1 = createMockDatabaseContext()
    const ctx2 = createMockDatabaseContext()
    await manager.run(ctx1, async () => {
      expect(manager.getContext()).toBe(ctx1)
      await manager.run(ctx2, () => {
        expect(manager.getContext()).toBe(ctx2)
      })
      expect(manager.getContext()).toBe(ctx1)
    })
  })
})
```

### Integration Tests

Extend existing controller tests to verify demo isolation:

```bash
pnpm --filter @menubook/app test
```
