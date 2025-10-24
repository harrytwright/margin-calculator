/**
 * Interactive Demo Calculator
 * Simple recipe cost calculator for landing page demo
 */

// Demo data
const demoData = {
  ingredients: {
    bread: {
      name: 'Bread',
      purchasePrice: 2.5, // £2.50
      purchaseAmount: 800,
      purchaseUnit: 'g',
      displayUnit: 'slices',
      conversionFactor: 30, // 1 slice = 30g
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
    <div class="bg-white p-4 rounded-lg border border-gray-200">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        ${ingredient.name}
      </label>
      <div class="flex items-center gap-2">
        <span class="text-gray-600 text-sm">£</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value="${ingredient.purchasePrice.toFixed(2)}"
          data-ingredient-id="${id}"
          class="demo-price-input flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <span class="text-gray-600 text-sm">/ ${ingredient.purchaseAmount}${ingredient.purchaseUnit}</span>
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
  const marginColor = result.margin >= 65 ? 'text-green-600' : 'text-red-600'
  const marginBgColor = result.margin >= 65 ? 'bg-green-50' : 'bg-red-50'

  container.innerHTML = `
    <div class="space-y-4">
      <!-- Recipe header -->
      <div class="border-b border-gray-200 pb-4">
        <h3 class="text-xl font-semibold text-gray-900">${demoData.recipe.name}</h3>
        <div class="mt-2 flex items-center gap-2">
          <label class="text-sm text-gray-600">Sell Price:</label>
          <div class="flex items-center gap-1">
            <span class="text-gray-600">£</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value="${demoData.recipe.sellPrice.toFixed(2)}"
              id="demo-sell-price"
              class="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <!-- Ingredients list -->
      <div class="space-y-2">
        <h4 class="text-sm font-semibold text-gray-700">Ingredients:</h4>
        ${result.breakdown
          .map(
            (item, index) => `
          <div class="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
            <div class="flex items-center gap-3 flex-1">
              <input
                type="number"
                step="0.1"
                min="0"
                value="${item.amount}"
                data-index="${index}"
                class="demo-amount-input w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span class="text-gray-600 text-sm">${item.unit}</span>
              <span class="text-gray-900">${item.name}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-gray-700 font-medium">${formatCurrency(item.cost)}</span>
              <button
                data-index="${index}"
                class="demo-remove-btn text-red-500 hover:text-red-700 p-1"
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
      <div class="border-t border-gray-200 pt-4 space-y-2">
        <div class="flex justify-between text-lg">
          <span class="font-semibold text-gray-900">Total Cost:</span>
          <span class="font-bold text-gray-900">${formatCurrency(result.totalCost)}</span>
        </div>
        <div class="flex justify-between text-lg">
          <span class="font-semibold text-gray-900">Profit:</span>
          <span class="font-bold ${result.profit >= 0 ? 'text-green-600' : 'text-red-600'}">${formatCurrency(result.profit)}</span>
        </div>
        <div class="flex justify-between items-center ${marginBgColor} p-4 rounded-lg mt-4">
          <span class="font-semibold text-gray-900 text-xl">Margin:</span>
          <span class="font-bold ${marginColor} text-2xl">${formatPercent(result.margin)}</span>
        </div>
      </div>
    </div>
  `

  // Add event listeners for sell price
  const sellPriceInput = document.getElementById('demo-sell-price')
  if (sellPriceInput) {
    sellPriceInput.addEventListener('input', (e) => {
      demoData.recipe.sellPrice = parseFloat(e.target.value) || 0
      renderRecipe()
    })
  }

  // Add event listeners for amounts
  container.querySelectorAll('.demo-amount-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const index = parseInt(e.target.dataset.index)
      const newAmount = parseFloat(e.target.value) || 0
      demoData.recipe.ingredients[index].amount = newAmount
      renderRecipe()
    })
  })

  // Add event listeners for remove buttons
  container.querySelectorAll('.demo-remove-btn').forEach((button) => {
    button.addEventListener('click', (e) => {
      const index = parseInt(e.currentTarget.dataset.index)
      demoData.recipe.ingredients.splice(index, 1)
      renderRecipe()
    })
  })
}

/**
 * Initialize demo
 */
export function initDemo() {
  renderIngredients()
  renderRecipe()
}
