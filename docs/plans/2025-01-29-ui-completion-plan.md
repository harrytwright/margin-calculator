# UI Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire up create/edit flows and prepare the island-based UI for demo release.

**Architecture:** The UI uses HTMX for partial page updates, with forms posting to routes that return HTML partials. Create flows use `HX-Redirect` to navigate to newly created entities. Edit flows use inline editing for simple fields and modals for complex operations.

**Tech Stack:** Express + EJS, HTMX, Tailwind CSS, `@harrytwright/api` decorators for routing.

---

## Context

### Current State
- Views reference routes like `/recipes/new`, `/recipes/:slug/edit` that don't exist
- Old management routes (`/management/recipes`) exist but target wrong HTMX elements (`#entity-list`)
- Form components (`recipe-form.ejs`, etc.) post to `/management/*` routes
- Inline editing not implemented

### Target State
- New clean routes at `/recipes/new`, `/recipes/:slug/edit`, etc.
- Forms post to `/recipes`, `/recipes/:slug` (PUT), etc.
- Forms target correct island elements (`#recipes-editor`)
- After create, redirect to new entity URL

### Key Files
- `packages/app/src/controllers/app.controller.ts` - Main controller (all routes)
- `packages/app/views/components/recipe-form.ejs` - Recipe create/edit form
- `packages/app/views/components/ingredient-form.ejs` - Ingredient create/edit form
- `packages/app/views/components/supplier-form.ejs` - Supplier create/edit form
- `packages/app/views/islands/browser.ejs` - Browser component with create button

---

## Task 1: Add Recipe Form Routes

**Files:**
- Modify: `packages/app/src/controllers/app.controller.ts:287-331`

**Step 1: Add GET /recipes/new route**

Add this method after the `getRecipe` method (around line 150):

```typescript
  /**
   * GET /recipes/new - New recipe form
   */
  @path('/recipes/new')
  async getNewRecipeForm(req: express.Request, res: express.Response) {
    return res.render('components/recipe-form', {
      recipe: null,
    })
  }
```

**Step 2: Add GET /recipes/:slug/edit route**

Add this method after the new route above:

```typescript
  /**
   * GET /recipes/:slug/edit - Edit recipe form
   */
  @path('/recipes/:slug/edit')
  async getEditRecipeForm(req: express.Request, res: express.Response) {
    const { slug } = req.params
    const recipe = await this.recipes.findById(slug, true)

    if (!recipe) {
      return res.status(404).send('Recipe not found')
    }

    return res.render('components/recipe-form', {
      recipe,
    })
  }
```

**Step 3: Add POST /recipes route**

Add this method after the edit route:

```typescript
  /**
   * POST /recipes - Create recipe
   */
  @path('/recipes')
  async postRecipe(
    req: ServerRequest<never, unknown, Record<string, any>>,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const parsed = recipeApiSchema.parse(req.body)
      const slug = parsed.slug || (await slugify(parsed.name))
      await this.recipes.create(slug, parsed)

      // Use HX-Redirect to navigate to the new recipe
      res.setHeader('HX-Redirect', `/recipes/${slug}`)
      return res.status(201).send('')
    } catch (error) {
      return next(error)
    }
  }
```

**Step 4: Add PUT /recipes/:slug route**

Add this method after the POST route:

```typescript
  /**
   * PUT /recipes/:slug - Update recipe
   */
  @path('/recipes/:slug')
  async putRecipe(
    req: ServerRequest<{ slug: string }, unknown, Record<string, any>>,
    res: express.Response,
    next: express.NextFunction
  ) {
    const { slug } = req.params

    try {
      const parsed = recipeApiSchema.parse(req.body)
      await this.recipes.update(slug, parsed)

      // Re-fetch and return updated editor
      const recipes = await this.recipes.find()
      const recipe = await this.recipes.findById(slug, true)

      let cost = null
      try {
        const costResult = await this.calculator.cost(slug)
        const marginResult = await this.calculator.margin(costResult)
        cost = {
          total: costResult.totalCost,
          breakdown: costResult.tree,
          margin: marginResult,
        }
      } catch (error) {
        // Cost calculation failed
      }

      // Close modal via header
      res.setHeader('HX-Trigger', 'closeModal')
      return res.render('islands/recipe-editor', { recipes, recipe, cost })
    } catch (error) {
      return next(error)
    }
  }
```

**Step 5: Add DELETE /recipes/:slug route**

Add this method after the PUT route:

```typescript
  /**
   * DELETE /recipes/:slug - Delete recipe
   */
  @path('/recipes/:slug')
  async deleteRecipe(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const { slug } = req.params

    try {
      await this.recipes.delete(slug)

      // Return updated browser list
      const recipes = await this.recipes.find()

      // Group by category for the browser
      const groupedItems: Record<string, any[]> = {}
      recipes.forEach((recipe) => {
        const groupKey = recipe.category || 'Uncategorized'
        if (!groupedItems[groupKey]) {
          groupedItems[groupKey] = []
        }
        groupedItems[groupKey].push(recipe)
      })

      return res.render('islands/browser', {
        type: 'recipes',
        items: recipes,
        selectedSlug: null,
        groupBy: 'category',
      })
    } catch (error) {
      return next(error)
    }
  }
```

**Step 6: Verify routes work**

Run: `pnpm --filter @menubook/app dev`

1. Navigate to http://localhost:3000/recipes
2. Click "+ Add new" in browser island header
3. Verify modal opens with empty form
4. Fill in form and submit
5. Verify redirect to new recipe page

**Step 7: Commit**

```bash
git add packages/app/src/controllers/app.controller.ts
git commit -m "feat(app): add recipe CRUD routes for island UI"
```

---

## Task 2: Add Ingredient Form Routes

**Files:**
- Modify: `packages/app/src/controllers/app.controller.ts`

**Step 1: Add GET /ingredients/new route**

Add after `getIngredient` method:

```typescript
  /**
   * GET /ingredients/new - New ingredient form
   */
  @path('/ingredients/new')
  async getNewIngredientForm(req: express.Request, res: express.Response) {
    const suppliers = await this.suppliers.find()
    return res.render('components/ingredient-form', {
      ingredient: null,
      suppliers,
    })
  }
```

**Step 2: Add GET /ingredients/:slug/edit route**

```typescript
  /**
   * GET /ingredients/:slug/edit - Edit ingredient form
   */
  @path('/ingredients/:slug/edit')
  async getEditIngredientForm(req: express.Request, res: express.Response) {
    const { slug } = req.params
    const ingredient = await this.ingredients.findById(slug)
    const suppliers = await this.suppliers.find()

    if (!ingredient) {
      return res.status(404).send('Ingredient not found')
    }

    return res.render('components/ingredient-form', {
      ingredient,
      suppliers,
    })
  }
```

**Step 3: Add POST /ingredients route**

```typescript
  /**
   * POST /ingredients - Create ingredient
   */
  @path('/ingredients')
  async postIngredient(
    req: ServerRequest<never, unknown, Record<string, any>>,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const parsed = ingredientApiSchema.parse(req.body)
      const slug = parsed.slug || (await slugify(parsed.name))
      const supplierSlug = req.body.supplierId || 'generic'
      await this.ingredients.create(slug, parsed, supplierSlug)

      res.setHeader('HX-Redirect', `/ingredients/${slug}`)
      return res.status(201).send('')
    } catch (error) {
      return next(error)
    }
  }
```

**Step 4: Add PUT /ingredients/:slug route**

```typescript
  /**
   * PUT /ingredients/:slug - Update ingredient
   */
  @path('/ingredients/:slug')
  async putIngredient(
    req: ServerRequest<{ slug: string }, unknown, Record<string, any>>,
    res: express.Response,
    next: express.NextFunction
  ) {
    const { slug } = req.params

    try {
      const parsed = ingredientApiSchema.parse(req.body)
      const supplierSlug = req.body.supplierId || 'generic'
      await this.ingredients.update(slug, parsed, supplierSlug)

      const ingredients = await this.ingredients.find()
      const ingredient = await this.ingredients.findById(slug)
      const suppliers = await this.suppliers.find()

      res.setHeader('HX-Trigger', 'closeModal')
      return res.render('islands/ingredient-editor', {
        ingredients,
        ingredient,
        suppliers,
      })
    } catch (error) {
      return next(error)
    }
  }
```

**Step 5: Add DELETE /ingredients/:slug route**

```typescript
  /**
   * DELETE /ingredients/:slug - Delete ingredient
   */
  @path('/ingredients/:slug')
  async deleteIngredient(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const { slug } = req.params

    try {
      await this.ingredients.delete(slug)
      const ingredients = await this.ingredients.find()

      return res.render('islands/browser', {
        type: 'ingredients',
        items: ingredients,
        selectedSlug: null,
        groupBy: 'category',
      })
    } catch (error) {
      return next(error)
    }
  }
```

**Step 6: Verify routes work**

1. Navigate to http://localhost:3000/ingredients
2. Click "+ Add new" in browser
3. Verify form loads with supplier dropdown
4. Create ingredient and verify redirect

**Step 7: Commit**

```bash
git add packages/app/src/controllers/app.controller.ts
git commit -m "feat(app): add ingredient CRUD routes for island UI"
```

---

## Task 3: Add Supplier Form Routes

**Files:**
- Modify: `packages/app/src/controllers/app.controller.ts`

**Step 1: Add GET /suppliers/new route**

Add after `getSupplier` method:

```typescript
  /**
   * GET /suppliers/new - New supplier form
   */
  @path('/suppliers/new')
  async getNewSupplierForm(req: express.Request, res: express.Response) {
    return res.render('components/supplier-form', {
      supplier: null,
    })
  }
```

**Step 2: Add GET /suppliers/:slug/edit route**

```typescript
  /**
   * GET /suppliers/:slug/edit - Edit supplier form
   */
  @path('/suppliers/:slug/edit')
  async getEditSupplierForm(req: express.Request, res: express.Response) {
    const { slug } = req.params
    const supplier = await this.suppliers.findById(slug)

    if (!supplier) {
      return res.status(404).send('Supplier not found')
    }

    return res.render('components/supplier-form', {
      supplier,
    })
  }
```

**Step 3: Add POST /suppliers route**

```typescript
  /**
   * POST /suppliers - Create supplier
   */
  @path('/suppliers')
  async postSupplier(
    req: ServerRequest<never, unknown, Record<string, any>>,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const parsed = supplierApiSchema.parse(req.body)
      const slug = parsed.slug || (await slugify(parsed.name))
      await this.suppliers.create(slug, parsed)

      res.setHeader('HX-Redirect', `/suppliers/${slug}`)
      return res.status(201).send('')
    } catch (error) {
      return next(error)
    }
  }
```

**Step 4: Add PUT /suppliers/:slug route**

```typescript
  /**
   * PUT /suppliers/:slug - Update supplier
   */
  @path('/suppliers/:slug')
  async putSupplier(
    req: ServerRequest<{ slug: string }, unknown, Record<string, any>>,
    res: express.Response,
    next: express.NextFunction
  ) {
    const { slug } = req.params

    try {
      const parsed = supplierApiSchema.parse(req.body)
      await this.suppliers.update(slug, parsed)

      const allSuppliers = await this.suppliers.find()
      const supplier = await this.suppliers.findById(slug)
      const allIngredients = await this.ingredients.find()
      const ingredients = allIngredients.filter((i) => i.supplierSlug === slug)

      const suppliers = allSuppliers.map((s) => ({
        ...s,
        ingredientCount: allIngredients.filter((i) => i.supplierSlug === s.slug)
          .length,
      }))

      res.setHeader('HX-Trigger', 'closeModal')
      return res.render('pages/suppliers', {
        suppliers,
        supplier,
        ingredients,
      })
    } catch (error) {
      return next(error)
    }
  }
```

**Step 5: Add DELETE /suppliers/:slug route**

```typescript
  /**
   * DELETE /suppliers/:slug - Delete supplier
   */
  @path('/suppliers/:slug')
  async deleteSupplier(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const { slug } = req.params

    try {
      await this.suppliers.delete(slug)
      const suppliers = await this.suppliers.find()
      const ingredients = await this.ingredients.find()

      const suppliersWithCounts = suppliers.map((s) => ({
        ...s,
        ingredientCount: ingredients.filter((i) => i.supplierSlug === s.slug)
          .length,
      }))

      return res.render('islands/browser', {
        type: 'suppliers',
        items: suppliersWithCounts,
        selectedSlug: null,
        groupBy: null,
      })
    } catch (error) {
      return next(error)
    }
  }
```

**Step 6: Verify routes work**

1. Navigate to http://localhost:3000/suppliers
2. Click "+ Add new" in browser
3. Create supplier and verify redirect

**Step 7: Commit**

```bash
git add packages/app/src/controllers/app.controller.ts
git commit -m "feat(app): add supplier CRUD routes for island UI"
```

---

## Task 4: Update Recipe Form Component

**Files:**
- Modify: `packages/app/views/components/recipe-form.ejs:18-22`

**Step 1: Update form action and target**

Replace line 18-22:

```ejs
<form
  hx-<%= recipe ? 'put' : 'post' %>="/management/recipes<%= recipe ? '/' + recipe.slug : '' %>"
  hx-target="#entity-list"
  hx-swap="innerHTML"
  class="flex-1 overflow-y-auto"
>
```

With:

```ejs
<form
  hx-<%= recipe ? 'put' : 'post' %>="/recipes<%= recipe ? '/' + recipe.slug : '' %>"
  hx-target="#recipes-editor"
  hx-swap="innerHTML"
  class="flex-1 overflow-y-auto"
>
```

**Step 2: Verify the form works**

1. Navigate to http://localhost:3000/recipes
2. Click "Create New Recipe" button
3. Fill in form
4. Submit and verify redirect works

**Step 3: Commit**

```bash
git add packages/app/views/components/recipe-form.ejs
git commit -m "fix(views): update recipe form to use new routes"
```

---

## Task 5: Update Ingredient Form Component

**Files:**
- Modify: `packages/app/views/components/ingredient-form.ejs:18-22`

**Step 1: Update form action and target**

Replace line 18-22:

```ejs
<form
  hx-<%= ingredient ? 'put' : 'post' %>="/management/ingredients<%= ingredient ? '/' + ingredient.slug : '' %>"
  hx-target="#entity-list"
  hx-swap="innerHTML"
  class="flex-1 overflow-y-auto"
>
```

With:

```ejs
<form
  hx-<%= ingredient ? 'put' : 'post' %>="/ingredients<%= ingredient ? '/' + ingredient.slug : '' %>"
  hx-target="#ingredients-editor"
  hx-swap="innerHTML"
  class="flex-1 overflow-y-auto"
>
```

**Step 2: Verify the form works**

1. Navigate to http://localhost:3000/ingredients
2. Click "Create New Ingredient" button
3. Fill in form with supplier
4. Submit and verify redirect works

**Step 3: Commit**

```bash
git add packages/app/views/components/ingredient-form.ejs
git commit -m "fix(views): update ingredient form to use new routes"
```

---

## Task 6: Update Supplier Form Component

**Files:**
- Modify: `packages/app/views/components/supplier-form.ejs`

**Step 1: Read the current supplier form**

First, check the current state of the file.

**Step 2: Update form action and target**

Find the form element and update:
- Change `hx-post="/management/suppliers..."` to `hx-post="/suppliers..."`
- Change `hx-target="#entity-list"` to `hx-target="#suppliers-list"` or appropriate target

**Step 3: Verify the form works**

1. Navigate to http://localhost:3000/suppliers
2. Click "Create New Supplier"
3. Fill in form
4. Submit and verify redirect

**Step 4: Commit**

```bash
git add packages/app/views/components/supplier-form.ejs
git commit -m "fix(views): update supplier form to use new routes"
```

---

## Task 7: Add closeModal Event Handler

**Files:**
- Modify: `packages/app/views/layouts/app.ejs:214-222`

**Step 1: Add HTMX event listener for closeModal trigger**

Find the HTMX configuration section (around line 214) and add:

```javascript
// Handle closeModal trigger from server
document.body.addEventListener('htmx:trigger', (event) => {
  if (event.detail.name === 'closeModal') {
    closeModal();
    showToast('Saved successfully', 'success');
  }
});
```

Add this after the `htmx:responseError` handler.

**Step 2: Verify modal closes after PUT**

1. Navigate to http://localhost:3000/recipes
2. Select a recipe
3. Click "Edit" button
4. Make a change and submit
5. Verify modal closes and editor updates

**Step 3: Commit**

```bash
git add packages/app/views/layouts/app.ejs
git commit -m "feat(views): add closeModal event handler"
```

---

## Task 8: Add Ingredient Picker Modal Route

**Files:**
- Modify: `packages/app/src/controllers/app.controller.ts`
- Create: `packages/app/views/modals/ingredient-picker.ejs`

**Step 1: Add GET /recipes/:slug/ingredients/add route**

Add in app.controller.ts after the recipe routes:

```typescript
  /**
   * GET /recipes/:slug/ingredients/add - Ingredient picker modal
   */
  @path('/recipes/:slug/ingredients/add')
  async getIngredientPicker(req: express.Request, res: express.Response) {
    const { slug } = req.params
    const recipe = await this.recipes.findById(slug, true)
    const ingredients = await this.ingredients.find()

    if (!recipe) {
      return res.status(404).send('Recipe not found')
    }

    return res.render('modals/ingredient-picker', {
      recipe,
      ingredients,
    })
  }
```

**Step 2: Create ingredient picker modal view**

Create `packages/app/views/modals/ingredient-picker.ejs`:

```ejs
<!-- Ingredient Picker Modal -->
<div class="modal-header bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
  <div class="flex items-center justify-between">
    <h3 class="text-lg font-semibold text-gray-900">
      Add Ingredient to <%= recipe.name %>
    </h3>
    <button
      onclick="closeModal()"
      class="text-gray-400 hover:text-gray-600 transition-colors"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</div>

<form
  hx-post="/api/recipes/<%= recipe.slug %>/ingredients"
  hx-target="#recipes-editor"
  hx-swap="innerHTML"
  class="flex-1 overflow-y-auto"
>
  <div class="px-6 py-4 space-y-4">
    <!-- Ingredient Selection -->
    <div>
      <label for="ingredientSlug" class="block text-sm font-medium text-gray-700 mb-1">
        Select Ingredient <span class="text-red-500">*</span>
      </label>
      <select
        id="ingredientSlug"
        name="ingredientSlug"
        required
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Choose an ingredient...</option>
        <% ingredients.forEach(ing => { %>
        <option value="<%= ing.slug %>"><%= ing.name %> (<%= ing.purchaseUnit %>)</option>
        <% }) %>
      </select>
    </div>

    <!-- Quantity -->
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="quantity" class="block text-sm font-medium text-gray-700 mb-1">
          Quantity <span class="text-red-500">*</span>
        </label>
        <input
          type="number"
          id="quantity"
          name="quantity"
          required
          min="0"
          step="0.01"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., 100"
        />
      </div>

      <div>
        <label for="unit" class="block text-sm font-medium text-gray-700 mb-1">
          Unit <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="unit"
          name="unit"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., g, ml, each"
        />
      </div>
    </div>

    <!-- Create New Link -->
    <div class="text-center pt-2 border-t border-gray-200">
      <p class="text-sm text-gray-500 mb-2">Can't find what you're looking for?</p>
      <button
        type="button"
        hx-get="/ingredients/new"
        hx-target=".modal-content"
        class="text-sm text-blue-600 hover:underline"
      >
        + Create New Ingredient
      </button>
    </div>
  </div>

  <!-- Modal Footer -->
  <div class="modal-footer bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-lg flex justify-end gap-3">
    <button
      type="button"
      onclick="closeModal()"
      class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
    >
      Cancel
    </button>
    <button
      type="submit"
      class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
    >
      Add to Recipe
    </button>
  </div>
</form>
```

**Step 3: Verify modal opens**

1. Navigate to http://localhost:3000/recipes/[any-recipe]
2. Click "+ Add Ingredient"
3. Verify modal opens with ingredient dropdown

**Step 4: Commit**

```bash
git add packages/app/src/controllers/app.controller.ts packages/app/views/modals/ingredient-picker.ejs
git commit -m "feat(app): add ingredient picker modal for recipes"
```

---

## Task 9: Run Tests and Verify

**Files:**
- None (verification only)

**Step 1: Run the test suite**

```bash
pnpm test
```

Expected: All tests should pass.

**Step 2: Manual verification checklist**

Run: `pnpm --filter @menubook/app dev`

- [ ] Create new recipe via modal
- [ ] Edit existing recipe via modal
- [ ] Delete recipe via dropdown menu
- [ ] Create new ingredient via modal
- [ ] Edit existing ingredient via modal
- [ ] Delete ingredient
- [ ] Create new supplier via modal
- [ ] Edit existing supplier via modal
- [ ] Delete supplier
- [ ] Add ingredient to recipe via picker modal
- [ ] Modal closes after successful operations
- [ ] Toast notifications appear

**Step 3: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix(app): address issues found during verification"
```

---

## Summary

After completing all tasks:

1. **New routes added:**
   - `GET /recipes/new` - New recipe form
   - `GET /recipes/:slug/edit` - Edit recipe form
   - `POST /recipes` - Create recipe
   - `PUT /recipes/:slug` - Update recipe
   - `DELETE /recipes/:slug` - Delete recipe
   - Same pattern for `/ingredients/*` and `/suppliers/*`
   - `GET /recipes/:slug/ingredients/add` - Ingredient picker modal

2. **Forms updated:**
   - Recipe form posts to `/recipes` (was `/management/recipes`)
   - Ingredient form posts to `/ingredients`
   - Supplier form posts to `/suppliers`
   - All forms target correct island elements

3. **UI behavior:**
   - Create operations redirect to new entity
   - Edit operations close modal and refresh editor
   - Delete operations refresh browser and clear editor
   - Toast notifications for all operations
