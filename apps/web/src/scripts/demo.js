/**
 * Interactive Demo Calculator
 * Simple recipe cost calculator for landing page demo
 */

// Demo data
const demoData = {
  ingredients: {
    bread: {
      name: 'Bread',
      purchasePrice: 1.5, // £2.50
      purchaseAmount: 1,
      purchaseUnit: ' loaf',
      displayUnit: 'slices',
      conversionFactor: 0.06, // 1 slice = 30g
    },
    cheese: {
      name: 'Cheddar Cheese',
      purchasePrice: 4.0, // £4.00
      purchaseAmount: 500,
      purchaseUnit: 'g',
    },
    butter: {
      name: 'Butter',
      purchasePrice: 1.5, // £1.50
      purchaseAmount: 250,
      purchaseUnit: 'g',
    },
  },
  recipe: {
    name: 'Cheese Sandwich',
    sellPrice: 3.5, // £3.50
    ingredients: [
      { id: 'bread', amount: 2, unit: 'slices' },
      { id: 'cheese', amount: 30, unit: 'g' },
      { id: 'butter', amount: 10, unit: 'g' },
    ],
  },
}

/**
 * Convert units to base unit (grams or milliliters)
 */
function convertToBaseUnit(amount, unit, ingredient) {
  // Handle display units (like "slices")
  if (unit === ingredient.displayUnit && ingredient.conversionFactor) {
    return amount * ingredient.conversionFactor
  }

  // Standard conversions
  const conversions = {
    kg: 1000,
    g: 1,
    l: 1000,
    ml: 1,
  }

  return amount * (conversions[unit.toLowerCase()] || 1)
}

/**
 * Calculate cost for a single ingredient
 */
function calculateIngredientCost(ingredientId, amount, unit) {
  const ingredient = demoData.ingredients[ingredientId]
  if (!ingredient) return 0

  // Convert recipe amount to base unit
  const baseAmount = convertToBaseUnit(amount, unit, ingredient)

  // Convert purchase amount to base unit
  const purchaseBaseAmount = convertToBaseUnit(
    ingredient.purchaseAmount,
    ingredient.purchaseUnit,
    ingredient
  )

  // Cost per base unit
  const costPerUnit = ingredient.purchasePrice / purchaseBaseAmount

  // Total cost for this ingredient
  return baseAmount * costPerUnit
}

/**
 * Get default amount for an ingredient
 */
function getDefaultAmount(ingredientId) {
  const defaults = {
    bread: { amount: 2, unit: 'slices' },
    cheese: { amount: 30, unit: 'g' },
    butter: { amount: 10, unit: 'g' },
  }
  return defaults[ingredientId] || { amount: 1, unit: 'g' }
}

/**
 * Get available ingredients (not in recipe)
 */
function getAvailableIngredients() {
  const usedIds = new Set(demoData.recipe.ingredients.map((i) => i.id))
  return Object.keys(demoData.ingredients).filter((id) => !usedIds.has(id))
}

/**
 * Calculate total recipe cost and margin
 */
function calculateRecipe() {
  let totalCost = 0

  for (const recipeIngredient of demoData.recipe.ingredients) {
    const cost = calculateIngredientCost(
      recipeIngredient.id,
      recipeIngredient.amount,
      recipeIngredient.unit
    )
    totalCost += cost
  }

  const sellPrice = demoData.recipe.sellPrice
  const profit = sellPrice - totalCost
  const margin = sellPrice > 0 ? (profit / sellPrice) * 100 : 0

  return {
    totalCost,
    sellPrice,
    profit,
    margin,
    breakdown: demoData.recipe.ingredients.map((ri) => ({
      ...ri,
      name: demoData.ingredients[ri.id]?.name || ri.id,
      cost: calculateIngredientCost(ri.id, ri.amount, ri.unit),
    })),
  }
}

/**
 * Track demo event in PostHog (if available)
 */
function trackDemoEvent(eventName, properties = {}) {
  if (window.posthog) {
    window.posthog.capture(`demo_${eventName}`, {
      ...properties,
      source: 'landing_page_demo',
    })
  }
}

/**
 * Format currency
 */
function formatCurrency(amount) {
  return `£${amount.toFixed(2)}`
}

/**
 * Format percentage
 */
function formatPercent(percent) {
  return `${percent.toFixed(1)}%`
}

/**
 * Render ingredients panel
 */
function renderIngredients() {
  const container = document.getElementById('demo-ingredients')
  if (!container) return

  container.innerHTML = Object.entries(demoData.ingredients)
    .map(
      ([id, ingredient]) => `
    <div class="card card-padding">
      <label class="form-label">
        ${ingredient.name}
      </label>
      <div class="flex items-center gap-2">
        <span class="text-neutral-500 text-sm">£</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value="${ingredient.purchasePrice.toFixed(2)}"
          data-ingredient-id="${id}"
          class="demo-price-input input flex-1"
        />
        <span class="text-neutral-500 text-sm whitespace-nowrap">/ ${ingredient.purchaseAmount}${ingredient.purchaseUnit}</span>
      </div>
    </div>
  `
    )
    .join('')

  // Add event listeners
  container.querySelectorAll('.demo-price-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const ingredientId = e.target.dataset.ingredientId
      const newPrice = parseFloat(e.target.value) || 0
      demoData.ingredients[ingredientId].purchasePrice = newPrice
      trackDemoEvent('ingredient_price_changed', {
        ingredient: demoData.ingredients[ingredientId].name,
        new_price: newPrice,
      })
      renderRecipe()
    })
  })
}

/**
 * Render recipe panel
 */
function renderRecipe() {
  const container = document.getElementById('demo-recipe')
  if (!container) return

  const result = calculateRecipe()
  const marginColor =
    result.margin >= 65 ? 'text-success-500' : 'text-error-500'
  const marginBgColor = result.margin >= 65 ? 'bg-success-50' : 'bg-error-50'

  container.innerHTML = `
    <div class="space-y-4">
      <!-- Recipe header -->
      <div class="border-b border-neutral-100 pb-4">
        <h3 class="text-xl font-semibold text-neutral-900">${demoData.recipe.name}</h3>
        <div class="mt-2 flex items-center gap-2">
          <label class="text-sm text-neutral-500">Sell Price:</label>
          <div class="flex items-center gap-1">
            <span class="text-neutral-500">£</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value="${demoData.recipe.sellPrice.toFixed(2)}"
              id="demo-sell-price"
              class="input w-24 py-1.5"
            />
          </div>
        </div>
      </div>

      <!-- Ingredients list -->
      <div class="space-y-2">
        <h4 class="label">Ingredients:</h4>
        ${result.breakdown
          .map(
            (item, index) => `
          <div class="flex items-center justify-between bg-neutral-50 p-3 rounded-lg">
            <div class="flex items-center gap-3 flex-1">
              <input
                type="number"
                step="0.1"
                min="0"
                value="${item.amount}"
                data-index="${index}"
                class="demo-amount-input input w-20 py-1.5"
              />
              <span class="text-neutral-500 text-sm">${item.unit}</span>
              <span class="text-neutral-900">${item.name}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-neutral-700 font-medium">${formatCurrency(item.cost)}</span>
              <button
                data-index="${index}"
                class="demo-remove-btn text-error-500 hover:text-error-600 p-1 transition-colors"
                title="Remove ingredient"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>

      <!-- Totals -->
      <div class="border-t border-neutral-100 pt-4 space-y-2">
        <div class="flex justify-between text-lg">
          <span class="font-semibold text-neutral-900">Total Cost:</span>
          <span class="font-bold text-neutral-900">${formatCurrency(result.totalCost)}</span>
        </div>
        <div class="flex justify-between text-lg">
          <span class="font-semibold text-neutral-900">Profit:</span>
          <span class="font-bold ${result.profit >= 0 ? 'text-success-500' : 'text-error-500'}">${formatCurrency(result.profit)}</span>
        </div>
        <div class="flex justify-between items-center ${marginBgColor} p-4 rounded-xl mt-4">
          <span class="font-semibold text-neutral-900 text-xl">Margin:</span>
          <span class="font-bold ${marginColor} text-2xl">${formatPercent(result.margin)}</span>
        </div>
      </div>

      ${
        getAvailableIngredients().length > 0
          ? `
      <!-- Available Ingredients -->
      <div class="border-t border-neutral-100 pt-4 mt-4">
        <h4 class="label mb-2">Available Ingredients:</h4>
        <div class="space-y-2">
          ${getAvailableIngredients()
            .map(
              (id) => `
            <button
              data-ingredient-id="${id}"
              class="demo-add-btn w-full flex items-center justify-between bg-primary-50 hover:bg-primary-100 p-3 rounded-lg transition-colors"
            >
              <span class="text-neutral-900">${demoData.ingredients[id].name}</span>
              <span class="text-primary-600 font-medium flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Add
              </span>
            </button>
          `
            )
            .join('')}
        </div>
      </div>
      `
          : ''
      }
    </div>
  `

  // Add event listeners for sell price
  const sellPriceInput = document.getElementById('demo-sell-price')
  if (sellPriceInput) {
    sellPriceInput.addEventListener('input', (e) => {
      const newSellPrice = parseFloat(e.target.value) || 0
      demoData.recipe.sellPrice = newSellPrice
      trackDemoEvent('sell_price_changed', {
        new_sell_price: newSellPrice,
      })
      renderRecipe()
    })
  }

  // Add event listeners for amounts
  container.querySelectorAll('.demo-amount-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const index = parseInt(e.target.dataset.index)
      const newAmount = parseFloat(e.target.value) || 0
      const ingredient = demoData.recipe.ingredients[index]
      demoData.recipe.ingredients[index].amount = newAmount
      trackDemoEvent('ingredient_amount_changed', {
        ingredient: demoData.ingredients[ingredient.id]?.name,
        new_amount: newAmount,
        unit: ingredient.unit,
      })
      renderRecipe()
    })
  })

  // Add event listeners for remove buttons
  container.querySelectorAll('.demo-remove-btn').forEach((button) => {
    button.addEventListener('click', (e) => {
      const index = parseInt(e.currentTarget.dataset.index)
      const ingredient = demoData.recipe.ingredients[index]
      trackDemoEvent('ingredient_removed', {
        ingredient: demoData.ingredients[ingredient.id]?.name,
        ingredients_remaining: demoData.recipe.ingredients.length - 1,
      })
      demoData.recipe.ingredients.splice(index, 1)
      renderRecipe()
    })
  })

  // Add event listeners for add buttons
  container.querySelectorAll('.demo-add-btn').forEach((button) => {
    button.addEventListener('click', (e) => {
      const ingredientId = e.currentTarget.dataset.ingredientId
      const defaultAmount = getDefaultAmount(ingredientId)
      trackDemoEvent('ingredient_added', {
        ingredient: demoData.ingredients[ingredientId]?.name,
        amount: defaultAmount.amount,
        unit: defaultAmount.unit,
        ingredients_total: demoData.recipe.ingredients.length + 1,
      })
      demoData.recipe.ingredients.push({
        id: ingredientId,
        ...defaultAmount,
      })
      renderRecipe()
    })
  })
}

/**
 * Initialize demo
 */
export function initDemo() {
  trackDemoEvent('demo_loaded')
  renderIngredients()
  renderRecipe()
}
