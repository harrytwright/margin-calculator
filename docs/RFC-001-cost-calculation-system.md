# RFC-001: Cost Calculation System (Stage 2)

**Status:** Draft
**Author:** Claude Code
**Date:** 2025-10-10
**Related:** Stage 1 (CRUD, Import, Services)

## Overview

This RFC outlines the implementation plan for Stage 2 of the GoBowling Margin Calculator: the cost calculation and margin analysis system. This builds upon the foundation established in Stage 1 (database, services, import system).

## Goals

1. Calculate accurate recipe costs including recursive sub-recipe handling
2. Perform unit conversions using validated parsing logic
3. Calculate profit margins (actual vs target)
4. Provide detailed cost breakdowns for analysis
5. Generate margin reports for menu planning

## Architecture

### Phase 1: Core Calculation Engine

**File:** `src/lib/calculator.ts`

#### 1.1 `calculateIngredientCost()`

```typescript
interface IngredientCostResult {
  ingredient: Ingredient
  requiredAmount: number
  requiredUnit: string
  purchaseAmount: number
  purchaseUnit: string
  conversionRatio: number
  costPerUnit: number
  totalCost: number
}

function calculateIngredientCost(
  ingredient: Ingredient,
  requiredAmount: number,
  requiredUnit: string
): IngredientCostResult
```

**Logic:**

1. Parse required unit using `parseUnit()` from units library
2. Parse purchase unit from `ingredient.purchaseUnit`
3. Convert required unit to purchase unit using `convertUnits()`:
   - Try standard conversion (g→kg, ml→l, oz→lb, etc.)
   - Fall back to custom `ingredient.conversionRule` if provided
4. Calculate pro-rata cost: `(requiredAmount / purchaseAmount) * purchaseCost`
5. **Conservative costing:** Round up to nearest penny using `Math.ceil(cost * 100) / 100`

**Error Handling:**

- Throw error if no conversion path exists between units
- Throw error if custom conversion rule is malformed
- Validate that purchase cost is positive

#### 1.2 `calculateRecipeCost()`

```typescript
interface RecipeCostNode {
  type: 'ingredient' | 'recipe'
  name: string
  amount: number
  unit: string
  cost: number
  children?: RecipeCostNode[]
}

interface RecipeCostResult {
  recipe: Recipe
  totalCost: number
  tree: RecipeCostNode[]
  depth: number
}

function calculateRecipeCost(
  db: Kysely<DB>,
  recipe: Recipe,
  depth: number = 0
): RecipeCostResult
```

**Logic:**

1. **Recursion guard:** Max depth = 10 (prevent infinite loops)
2. Fetch `RecipeIngredients` for the recipe
3. For each ingredient/sub-recipe:
   - **If ingredient:**
     - Call `calculateIngredientCost()`
     - Add to cost tree
   - **If sub-recipe:**
     - Recursively call `calculateRecipeCost(subRecipe, depth + 1)`
     - Convert sub-recipe yield to required amount
     - Scale sub-recipe cost proportionally
     - Add sub-tree to cost tree
4. Sum all costs
5. Return total cost and hierarchical tree structure

**Sub-Recipe Yield Handling:**

- Sub-recipes define `yieldAmount` and `yieldUnit` (e.g., "500ml sauce")
- Recipe ingredient specifies required amount (e.g., "50ml")
- Scale cost: `(requiredAmount / yieldAmount) * subRecipeCost`

**Circular Dependency Detection:**

- Track visited recipe IDs during recursion
- Throw error if recipe references itself (directly or indirectly)

#### 1.3 `calculateMargin()`

```typescript
interface MarginResult {
  sellPrice: number // Price before/after VAT (as stored)
  sellPriceExVat: number // Always ex-VAT for comparison
  totalCost: number
  grossProfit: number // sellPriceExVat - totalCost
  margin: number // (grossProfit / sellPriceExVat) * 100
  costPercentage: number // (totalCost / sellPriceExVat) * 100
  meetsTarget: boolean // margin >= targetMargin
}

function calculateMargin(
  sellPrice: number,
  totalCost: number,
  includesVat: boolean,
  vatRate: number,
  targetMargin?: number
): MarginResult
```

**Logic:**

1. If `includesVat`, convert sell price to ex-VAT: `sellPrice / (1 + vatRate)`
2. Calculate gross profit: `sellPriceExVat - totalCost`
3. Calculate margin: `(grossProfit / sellPriceExVat) * 100`
4. Calculate cost percentage: `(totalCost / sellPriceExVat) * 100`
5. Check if margin meets target (if provided)

**Validation:**

- Sell price must be positive
- Total cost must be non-negative
- VAT rate must be between 0 and 1 (e.g., 0.20 for 20%)

---

### Phase 2: Unit Conversion Library

**File:** `src/lib/units.ts`

Migrate validated logic from `example.ts` into production code:

#### 2.1 Functions

```typescript
export function parseUnit(
  unitString: string
): { amount: number; unit: string } | null

export function normalizePlural(unit: string): string

export function parseConversionRule(rule: string): {
  fromAmount: number
  fromUnit: string
  toAmount: number
  toUnit: string
} | null

export function convertUnits(
  amount: number,
  fromUnit: string,
  toUnit: string,
  conversionRule?: string
): number | null
```

#### 2.2 Edge Cases (Already Validated)

- **Ranges:** `"2-3 cloves"` → use highest (3) for conservative costing
- **Mixed fractions:** `"1 1/2 cups"` → 1.5
- **Simple fractions:** `"1/2 cup"` → 0.5
- **Decimals:** `"0.25 tsp"` → 0.25
- **Descriptive amounts:** `"to taste"`, `"pinch"`, `"handful"`, `"dash"`, `"splash"` → return `null`
- **Pluralization:** `"slices"` ↔ `"slice"` using `pluralize` library
- **Spacing:** `"50g"`, `"50 g"` both valid

#### 2.3 Testing

**File:** `src/lib/__tests__/units.test.ts`

Port all test cases from `example.ts`:

- Parsing tests (12+ cases)
- Conversion tests (standard + custom rules)
- Plural normalization tests
- Edge case tests

---

### Phase 3: Service Layer Integration

**Extend:** `src/services/recipe.ts`

#### 3.1 `getCostBreakdown()`

```typescript
export async function getCostBreakdown(
  this: Kysely<DB>,
  slug: string
): Promise<RecipeCostResult>
```

**Logic:**

1. Find recipe by slug
2. Call `calculateRecipeCost(this, recipe)`
3. Return full cost tree with breakdown

**Use Case:** CLI command showing detailed cost analysis

#### 3.2 `validateMargin()`

```typescript
export async function validateMargin(
  this: Kysely<DB>,
  slug: string,
  vatRate: number
): Promise<MarginResult & { recipe: Recipe }>
```

**Logic:**

1. Get cost breakdown for recipe
2. Call `calculateMargin()` with recipe pricing
3. Return margin analysis with recipe details

**Use Case:** Check if recipe meets target margin

#### 3.3 `getMarginReport()`

```typescript
interface MarginReportEntry {
  recipe: Recipe
  margin: MarginResult
  status: 'above_target' | 'on_target' | 'below_target'
}

export async function getMarginReport(
  this: Kysely<DB>,
  filters?: {
    category?: string
    class?: RecipeClass
    belowTargetOnly?: boolean
  }
): Promise<MarginReportEntry[]>
```

**Logic:**

1. Fetch all recipes (or filtered subset)
2. For each recipe, calculate margin
3. Compare actual vs target margin
4. Sort by margin descending
5. Return report data

**Use Case:** Menu planning, pricing review

---

### Phase 4: CLI Commands

#### 4.1 `margin recipe cost <slug>`

**Purpose:** Show detailed cost breakdown

**Example Output:**

```
Ham & Cheese Sandwich
├─ Hovis White Bread (2 slices)     £0.12
│  └─ 2 slices @ £0.96/loaf (16 slices)
├─ Ham (25g)                        £0.15
│  └─ 25g @ £5.99/kg
└─ Cheese Slice (1 slice)           £0.18
   └─ 1 slice @ £2.50/200g (8 slices)

Total Cost: £0.45
Sell Price: £4.00 (excl VAT)
Margin: 88.75% (target: 65%) ✓
Gross Profit: £3.55
```

**Options:**

- `--verbose` - Show conversion calculations
- `--json` - Output as JSON for scripting

#### 4.2 `margin recipe margin <slug>`

**Purpose:** Analyze margin and suggest pricing

**Example Output:**

```
Ham & Cheese Sandwich
Current Pricing:
  Cost:        £0.45
  Sell Price:  £4.00 (excl VAT)
  Margin:      88.75%
  Target:      65%
  Status:      ✓ Above target (+23.75%)

Alternative Pricing for 65% target margin:
  Recommended Sell Price: £1.29 (excl VAT)
  Recommended Sell Price: £1.55 (incl VAT @ 20%)
```

**Options:**

- `--target <percent>` - Calculate required price for specific margin
- `--vat-inclusive` - Show VAT-inclusive pricing

#### 4.3 `margin report margins`

**Purpose:** List all menu items with margin analysis

**Example Output:**

```
Margin Report (Menu Items)

Below Target (2):
  Ham Sandwich          45.2%  (target: 65%)  ⚠️
  Cheese Toastie        58.3%  (target: 65%)  ⚠️

On Target (5):
  Club Sandwich         65.1%  (target: 65%)  ✓
  BLT                   67.8%  (target: 65%)  ✓
  ...

Above Target (8):
  Chicken Wrap          82.4%  (target: 65%)  ✓
  Caesar Salad          91.2%  (target: 65%)  ✓
  ...

Summary:
  Total Items: 15
  Average Margin: 72.3%
  Below Target: 2 (13.3%)
```

**Options:**

- `--below-target` - Show only items below target
- `--category <cat>` - Filter by category
- `--sort <field>` - Sort by margin, cost, price, name
- `--json` - Output as JSON

---

## Key Design Decisions

### 1. Conservative Costing

**Decision:** Always round costs UP to nearest penny using `Math.ceil(cost * 100) / 100`

**Rationale:**

- Ensures margins are realistic, not optimistic
- Accounts for wastage, portioning variance
- Better to overestimate cost than underestimate

### 2. Cost Caching Strategy

**Decision:** Do NOT cache costs in database initially

**Rationale:**

- Ingredient costs change frequently (supplier price updates)
- Recipe compositions may change
- Caching introduces staleness issues
- Calculate on-demand for now
- **Future enhancement:** Add optional `last_calculated_cost` and `last_calculated_at` fields for historical tracking

### 3. Validation Strategy

**Decision:** Fail loudly on missing conversion paths

**Rationale:**

- Better to alert user than silently ignore ingredients
- Forces data quality (proper units and conversion rules)
- Prevents hidden cost omissions

### 4. Recursion Limits

**Decision:** Max recursion depth = 10 levels

**Rationale:**

- Prevents infinite loops from circular dependencies
- Practical limit: most recipes have 1-3 levels
- If hit limit, indicates data modeling issue

### 5. VAT Handling

**Decision:** Store prices as entered (VAT-inclusive or exclusive), convert for calculations

**Rationale:**

- Matches real-world pricing (some items VAT-free, others VAT-inclusive)
- Always convert to ex-VAT for margin calculations (consistent comparison)
- Display both forms to user

---

## Implementation Plan

### Step 1: Units Library (1 hour)

- [ ] Create `src/lib/units.ts`
- [ ] Migrate functions from `example.ts`
- [ ] Create `src/lib/__tests__/units.test.ts`
- [ ] Port all test cases from `example.ts`
- [ ] Verify all tests pass

### Step 2: Calculator Engine (2 hours)

- [ ] Create `src/lib/calculator.ts`
- [ ] Implement `calculateIngredientCost()`
- [ ] Implement `calculateRecipeCost()`
- [ ] Implement `calculateMargin()`
- [ ] Create `src/lib/__tests__/calculator.test.ts`
- [ ] Test with fixtures from Stage 1

### Step 3: Service Integration (1 hour)

- [ ] Add `getCostBreakdown()` to `src/services/recipe.ts`
- [ ] Add `validateMargin()` to `src/services/recipe.ts`
- [ ] Add `getMarginReport()` to `src/services/recipe.ts`
- [ ] Add tests to `src/services/__tests__/recipe.test.ts`

### Step 4: CLI Commands (2 hours)

- [ ] Implement `margin recipe cost <slug>` command
- [ ] Implement `margin recipe margin <slug>` command
- [ ] Implement `margin report margins` command
- [ ] Add CLI tests to `src/commands/__tests__/`
- [ ] Update CLAUDE.md with new commands

### Step 5: Integration Testing (1 hour)

- [ ] Create end-to-end test with real recipe data
- [ ] Test sub-recipe recursion
- [ ] Test custom conversion rules
- [ ] Test margin calculations
- [ ] Verify conservative rounding

**Total Estimated Time:** 7 hours

---

## Open Questions

1. **Cost History Tracking:** Should we store calculated costs with timestamps for historical analysis?
   - Pro: Enables price trend analysis, audit trail
   - Con: Adds complexity, storage overhead
   - **Recommendation:** Defer to future phase

2. **Batch Calculation:** Should margin reports cache calculations temporarily for performance?
   - Pro: Faster when generating large reports
   - Con: Adds complexity
   - **Recommendation:** Implement if performance issues arise

3. **Yield Variance:** Should we support yield ranges for sub-recipes (e.g., "450-500ml sauce")?
   - Pro: More realistic modeling
   - Con: Adds complexity to calculations
   - **Recommendation:** Use conservative (lowest) yield for now

4. **Portion Control:** Should we track portion variance (e.g., ±10% tolerance)?
   - Pro: More accurate cost modeling
   - Con: Significant complexity
   - **Recommendation:** Defer to future phase

5. **Currency:** Should we support multiple currencies?
   - Pro: Useful for multi-region operations
   - Con: Adds complexity (exchange rates, formatting)
   - **Recommendation:** Assume GBP (£) for now

---

## Testing Strategy

### Unit Tests

- `units.test.ts` - All parsing and conversion logic
- `calculator.test.ts` - Cost calculation functions
- `recipe.test.ts` - Service layer functions

### Integration Tests

- End-to-end recipe cost calculation
- Multi-level sub-recipe scenarios
- Custom conversion rule handling
- Margin validation

### CLI Tests

- Command output formatting
- Error handling
- JSON output mode

### Test Data

- Use fixtures from Stage 1
- Create dedicated margin calculation fixtures
- Include edge cases (sub-recipes, custom units)

---

## Success Criteria

- [ ] All unit tests pass (100% coverage for calculator, units)
- [ ] CLI commands produce correct, readable output
- [ ] Margin calculations match manual verification
- [ ] Sub-recipe recursion works correctly
- [ ] Custom conversion rules apply correctly
- [ ] Conservative costing rounds up consistently
- [ ] Error messages are clear and actionable
- [ ] Documentation updated (CLAUDE.md)

---

## Future Enhancements

1. **Cost History:** Track cost changes over time
2. **Batch Pricing:** Bulk update sell prices to meet target margins
3. **Waste Tracking:** Factor in ingredient waste percentages
4. **Seasonal Pricing:** Support time-based pricing strategies
5. **Multi-Currency:** Support multiple currencies with exchange rates
6. **Export Reports:** PDF/Excel export for management
7. **Cost Alerts:** Notify when ingredient costs spike
8. **Recipe Comparison:** Compare similar recipes to optimize margins

---

## References

- [convert-units documentation](https://github.com/convert-units/convert-units)
- [pluralize documentation](https://www.npmjs.com/package/pluralize)
- Stage 1 implementation (CRUD, Import, Services)
- `example.ts` - Validated unit parsing logic
