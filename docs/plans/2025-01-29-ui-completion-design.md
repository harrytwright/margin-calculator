# UI Completion Design

> Taking the island-based UI from 70% to 90% - wiring up create/edit flows and inline editing.

## Overview

The island-based UI structure exists but lacks functional create/edit flows. Routes referenced in views don't exist, and inline editing isn't implemented. This design covers wiring everything together for a shippable product.

## Route Structure

### Form Routes (GET - return modal content)

| Route | Returns |
|-------|---------|
| `GET /recipes/new` | `recipe-form.ejs` (empty) |
| `GET /recipes/:slug/edit` | `recipe-form.ejs` (with data) |
| `GET /recipes/:slug/ingredients/add` | ingredient picker modal |
| `GET /ingredients/new` | `ingredient-form.ejs` (empty) |
| `GET /ingredients/:slug/edit` | `ingredient-form.ejs` (with data) |
| `GET /suppliers/new` | `supplier-form.ejs` (empty) |
| `GET /suppliers/:slug/edit` | `supplier-form.ejs` (with data) |

### CRUD Routes (POST/PUT/DELETE - return HTML partials)

| Route | Action | Returns |
|-------|--------|---------|
| `POST /recipes` | Create | `HX-Redirect` to new recipe |
| `PUT /recipes/:slug` | Update | Updated `recipe-editor.ejs` |
| `DELETE /recipes/:slug` | Delete | Updated browser list |

Same pattern for `/ingredients/*` and `/suppliers/*`.

### Inline Updates (via existing API)

Use `PATCH /api/recipes/:slug` etc. for single-field inline updates. Pure JSON, no HTML response needed.

## Inline Editing

### Behavior

1. **Display state** - Field shows formatted value (e.g., `£4.50`)
2. **Click** - Text becomes input, focused, value selected
3. **Blur or Enter** - `PATCH /api/{entity}/{slug}` with changed field
4. **Success** - Input reverts to text, subtle confirmation flash
5. **Error** - Show inline error, revert to original value

### Editable Fields

| Entity | Inline-Editable Fields |
|--------|------------------------|
| Recipe | name, sellPrice, targetMargin, category |
| Ingredient | name, category, purchaseCost, purchaseUnit |
| Supplier | name, contactName, contactEmail, contactPhone |

### Not Inline (use modals)

- Recipe: stage, class, VAT toggle (dropdowns/toggles)
- Ingredient: supplier (immutable after creation)
- All creation flows
- Adding ingredients to recipes

## New Component: inline-edit.ejs

Reusable partial for inline-editable fields:

```ejs
<%- include('../components/inline-edit', {
  entity: 'recipes',
  slug: recipe.slug,
  field: 'sellPrice',
  value: recipe.sellPrice,
  type: 'currency',
  label: 'Sell Price'
}) %>
```

Handles:
- Display formatting (currency: `£`, `/100`)
- Input types (text, number, email)
- PATCH request on blur
- Loading/success/error states

## Modal Flows

### Create Flow

1. Click "Create New Recipe" in browser island
2. `hx-get="/recipes/new"` → `recipe-form.ejs` into `.modal-content`
3. Modal opens, user fills form
4. `hx-post="/recipes"` → creates recipe
5. Response: `HX-Redirect: /recipes/{new-slug}`
6. Page loads with new recipe selected

### Edit Flow (full form via modal)

1. Click "Edit" button
2. `hx-get="/recipes/:slug/edit"` → populated form
3. User edits, submits
4. `hx-put="/recipes/:slug"` → updated `recipe-editor.ejs`
5. Modal closes, editor swaps with fresh content

### Nested Creation (ingredient from recipe page)

1. Click "+ Add Ingredient" on recipe editor
2. Modal opens with ingredient picker
3. Click "+ Create New Ingredient"
4. Second modal stacks with `ingredient-form.ejs`
5. Create ingredient, submit
6. Inner modal closes
7. Outer modal refreshes dropdown, new ingredient pre-selected
8. Set quantity/unit, add to recipe

## Cleanup Required

### Remove old route references

Update views to use new routes instead of `/management/*`:
- `hx-post="/recipes"` not `/management/recipes`
- `hx-get="/ingredients/new"` not `/management/ingredients/new`

### Update HTMX targets

- Remove `hx-target="#entity-list"` (old management page pattern)
- Use island-specific targets: `#recipes-editor`, `#ingredients-editor`

## Implementation Checklist

### High Priority
- [ ] Add new routes in `app.controller.ts`
- [ ] Create `inline-edit.ejs` component
- [ ] Update form components to use new routes
- [ ] Update editor islands to use inline-edit component
- [ ] Wire up stacked modal support (JS helper)

### Medium Priority
- [ ] Browser island: auto-select after create
- [ ] Browser island: handle delete (clear/select next)
- [ ] Toast notifications for success/error

### Low Priority
- [ ] Dynamic breadcrumb in status bar
- [ ] Version display in status bar

## Future Considerations

This EJS + HTMX implementation will migrate to TanStack Router + React. The component model (inline-edit, stacked modals) translates directly to React components.
