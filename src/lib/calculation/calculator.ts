import path from 'path'

import log from '@harrytwright/logger'

import { ConfigService } from '../../services/config'
import { IngredientService } from '../../services/ingredient'
import { RecipeIngredientsLookup, RecipeService } from '../../services/recipe'
import { RecipeCostNode, RecipeResult } from './types'
import { convertUnits, parseConversionRule, parseUnit } from './units'

export class Calculator {
  private readonly maxDepth = 10

  constructor(
    private readonly recipe: RecipeService,
    private readonly ingredient: IngredientService,
    private readonly config: ConfigService = new ConfigService(
      path.join(process.cwd(), 'app')
    )
  ) {}

  private async ingredientCost(
    ingredient: RecipeIngredientsLookup,
    depth: number = 0
  ) {
    if (depth > this.maxDepth)
      throw new RangeError('Maximum recursion depth exceeded')

    const lookup = await this.ingredient.findById(ingredient.slug)

    // In theory should not hit this
    if (!lookup) throw new Error(`Ingredient ${ingredient.slug} not found`)

    const unit = parseUnit(ingredient.unit)
    const purchase = parseUnit(lookup.purchaseUnit)

    if (!unit || !purchase)
      throw new Error(
        `Invalid unit or purchase unit for ingredient ${ingredient.slug}`
      )

    const rule =
      (lookup.conversionRule && parseConversionRule(lookup.conversionRule)) ||
      undefined
    const convertedAmount = convertUnits(
      unit,
      purchase.unit,
      lookup.conversionRule || undefined
    )

    if (!convertedAmount) {
      return null
    }

    // If ingredient purchase cost includes VAT, strip it out
    const vatRate = await this.config.getVatRate()
    const purchaseCostExVat = lookup.includesVat
      ? lookup.purchaseCost / (1 + vatRate)
      : lookup.purchaseCost

    const totalCost = (convertedAmount / purchase.amount) * purchaseCostExVat

    const baseAmount = rule?.to.amount || purchase.amount
    const costPerUnit = purchaseCostExVat / baseAmount

    return {
      unit,
      costPerUnit,
      name: lookup.name,
      totalCost: Math.ceil(totalCost * 100) / 100,
    }
  }

  async cost(recipe: string, depth: number = 0) {
    if (depth > this.maxDepth)
      throw new RangeError('Maximum recursion depth exceeded')

    const data = await this.recipe.findById(recipe)

    if (!data) throw new Error(`Recipe ${recipe} not found`)

    let parsed: Map<string, RecipeCostNode> = new Map()
    for (const ingredient of data.ingredients) {
      const result = await (ingredient.type === 'ingredient'
        ? this.ingredientCost(ingredient, depth)
        : this.cost(ingredient.slug, depth + 1))

      if (!result) continue

      if ('tree' in result) {
        parsed.set(ingredient.slug, {
          ...parseUnit(ingredient.unit)!,
          type: ingredient.type,
          name: ingredient.name!,
          cost:
            Math.ceil(this.scaleSubRecipe(result, ingredient, depth) * 100) /
            100,
          children: result.tree,
        })
      } else {
        parsed.set(ingredient.slug, {
          type: ingredient.type,
          name: result.name,
          cost: result.totalCost,
          amount: result.unit.amount,
          unit: result.unit.unit,
        })
      }
    }

    const cost = Array.from(parsed.values()).reduce(
      (acc, val) => acc + val.cost,
      0
    )

    return {
      recipe: data,
      tree: Array.from(parsed.values()),
      totalCost: cost,
    }
  }

  async margin(recipe: RecipeResult) {
    const { totalCost, recipe: recipeData } = recipe

    // Sell price is always stored ex-VAT (in pence)
    const sellPriceExVat = recipeData.sellPrice / 100

    // Margin calculated ex-VAT
    const profit = sellPriceExVat - totalCost
    const actualMargin = (profit / sellPriceExVat) * 100
    const targetMargin = recipeData.targetMargin || 0
    const marginDelta = actualMargin - targetMargin

    // Customer pays VAT on top if eligible
    const vatApplicable = recipeData.includesVat === 1
    const vatRate = await this.config.getVatRate()
    const vatAmount = vatApplicable ? sellPriceExVat * vatRate : 0
    const customerPrice = sellPriceExVat + vatAmount

    return {
      cost: Math.ceil(totalCost * 100) / 100,
      sellPrice: Math.ceil(sellPriceExVat * 100) / 100,
      customerPrice: Math.ceil(customerPrice * 100) / 100,
      vatAmount: Math.ceil(vatAmount * 100) / 100,
      profit: Math.ceil(profit * 100) / 100,
      actualMargin: Math.ceil(actualMargin * 100) / 100,
      targetMargin,
      marginDelta: Math.ceil(marginDelta * 100) / 100,
      meetsTarget: actualMargin >= targetMargin,
      vatApplicable,
    }
  }

  private scaleSubRecipe(
    result: RecipeResult,
    ingredient: RecipeIngredientsLookup,
    depth: number
  ) {
    if (ingredient.type !== 'recipe')
      throw TypeError('Ingredient is not a recipe')

    const { recipe, totalCost } = result

    const reqUnit = parseUnit(ingredient.unit)

    if (reqUnit && recipe.yieldAmount && recipe.yieldUnit) {
      const yieldUnit = parseUnit(
        `${result.recipe.yieldAmount} ${result.recipe.yieldUnit}`
      )

      if (!yieldUnit) return totalCost

      const converted = convertUnits(reqUnit, yieldUnit.unit)

      if (converted) {
        return totalCost * (converted / yieldUnit.amount)
      } else if (reqUnit.unit.toLowerCase() === yieldUnit.unit.toLowerCase()) {
        return totalCost * (reqUnit.amount / yieldUnit.amount)
      } else {
        log.warn(
          'calculator',
          'Cannot convert %s to %s for recipe "%s". Using full cost (1:1 ratio). ' +
            'Consider using standard units or matching custom units.',
          ingredient.unit,
          `${yieldUnit.amount} ${yieldUnit.unit}`,
          ingredient.slug
        )
      }
    }

    return totalCost
  }
}
