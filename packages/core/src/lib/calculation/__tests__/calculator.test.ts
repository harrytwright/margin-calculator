jest.mock('../../../services/config', () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    getVatRate: jest.fn().mockResolvedValue(0.2),
    getMarginTarget: jest.fn().mockResolvedValue(20),
    getDefaultPriceIncludesVat: jest.fn().mockResolvedValue(true),
  })),
}))

import type { DatabaseContext } from '@menubook/shared'

import { ConfigService } from '../../../services/config'
import { IngredientService } from '../../../services/ingredient'
import { RecipeService } from '../../../services/recipe'
import { createTestContext } from '../../../services/__tests__/helpers/test-adapter'
import { Calculator } from '../calculator'

// Helper: seed a supplier-backed ingredient via IngredientService
async function seedIngredient(
  ctx: DatabaseContext,
  data: { slug: string; name: string; category: string },
  pricing: { cost: string; currency: string; unit: string; vat: boolean }
): Promise<number> {
  const svc = new IngredientService(ctx)
  return (await svc.create(data, 'generic', pricing)).id
}

describe('Calculator', () => {
  let context: DatabaseContext
  let ingredientService: IngredientService
  let recipeService: RecipeService
  let configService: ConfigService
  let calculator: Calculator

  beforeEach(async () => {
    context = await createTestContext()
    configService = new ConfigService('')
    ingredientService = new IngredientService(context)
    recipeService = new RecipeService(context, configService)
    calculator = new Calculator(recipeService, ingredientService, configService)
  })

  afterEach(async () => {
    await context.db.destroy()
  })

  describe('cost()', () => {
    test('Test 1: basic cost calculation for 100g of 1kg ingredient at 599 pence', async () => {
      // Seed ingredient: 1 kg of flour at 599 pence, no VAT
      await seedIngredient(
        context,
        { slug: 'flour', name: 'Flour', category: 'dry-goods' },
        { cost: '599', currency: 'GBP', unit: '1 kg', vat: false }
      )

      // Create recipe using 100g of flour
      await recipeService.create(
        { slug: 'basic-bread', name: 'Basic Bread' },
        undefined,
        [
          {
            type: 'ingredient',
            slug: 'flour',
            quantity: '100',
            unit: 'g',
            notes: null,
          },
        ]
      )

      const result = await calculator.cost('basic-bread')

      // 599 pence / 1000g * 100g = 59.9 pence, ceil = 60
      expect(result.totalCost).toBe(60)
    })

    test('Test 2: VAT is stripped from ingredient cost before calculating', async () => {
      // Seed ingredient: 1 kg of butter at 599 pence, VAT inclusive
      await seedIngredient(
        context,
        { slug: 'butter', name: 'Butter', category: 'dairy' },
        { cost: '599', currency: 'GBP', unit: '1 kg', vat: true }
      )

      await recipeService.create(
        { slug: 'buttered-toast', name: 'Buttered Toast' },
        undefined,
        [
          {
            type: 'ingredient',
            slug: 'butter',
            quantity: '100',
            unit: 'g',
            notes: null,
          },
        ]
      )

      const result = await calculator.cost('buttered-toast')

      // ex-VAT cost = 599 / 1.2 ≈ 499.17 pence per kg
      // 100g cost = 499.17 / 1000 * 100 ≈ 49.9, ceil = 50
      // The VAT-stripped totalCost must be less than the non-VAT test (60)
      expect(result.totalCost).toBeLessThan(60)
      expect(result.totalCost).toBe(50)
    })

    test('Test 3: unit conversion between ml and cl', async () => {
      // Seed ingredient: 1000 ml of oil at 100 pence
      await seedIngredient(
        context,
        { slug: 'oil', name: 'Oil', category: 'liquids' },
        { cost: '100', currency: 'GBP', unit: '1000 ml', vat: false }
      )

      // Recipe uses 10 cl of oil (= 100 ml)
      await recipeService.create(
        { slug: 'fried-egg', name: 'Fried Egg' },
        undefined,
        [
          {
            type: 'ingredient',
            slug: 'oil',
            quantity: '10',
            unit: 'cl',
            notes: null,
          },
        ]
      )

      const result = await calculator.cost('fried-egg')

      // 10 cl = 100 ml; 100 pence / 1000ml * 100ml = 10 pence
      expect(result.totalCost).toBe(10)
    })

    test('Test 4: sub-recipe cost is included and tree contains recipe type entry', async () => {
      // Seed base ingredient for the sub-recipe
      await seedIngredient(
        context,
        { slug: 'tomato', name: 'Tomato', category: 'veg' },
        { cost: '200', currency: 'GBP', unit: '1 kg', vat: false }
      )

      // Create base sub-recipe (sauce), yields 200g
      await recipeService.create(
        {
          slug: 'tomato-sauce',
          name: 'Tomato Sauce',
          class: 'sub_recipe',
          yieldAmount: '200',
          yieldUnit: 'g',
        },
        undefined,
        [
          {
            type: 'ingredient',
            slug: 'tomato',
            quantity: '500',
            unit: 'g',
            notes: null,
          },
        ]
      )

      // Create parent recipe that uses 100g of the sauce
      await recipeService.create(
        { slug: 'pasta-with-sauce', name: 'Pasta with Sauce' },
        undefined,
        [
          {
            type: 'recipe',
            slug: 'tomato-sauce',
            quantity: '100',
            unit: 'g',
            notes: null,
          },
        ]
      )

      const result = await calculator.cost('pasta-with-sauce')

      expect(result.totalCost).toBeGreaterThan(0)

      // The tree should contain an entry of type 'recipe'
      const recipeEntry = result.tree.find((node) => node.type === 'recipe')
      expect(recipeEntry).toBeDefined()
    })
  })

  describe('margin()', () => {
    test('Test 5: basic margin calculation returns reasonable values', async () => {
      // Seed ingredient and create recipe with a sell price
      await seedIngredient(
        context,
        { slug: 'margin-flour', name: 'Flour', category: 'dry-goods' },
        { cost: '100', currency: 'GBP', unit: '1 kg', vat: false }
      )

      await recipeService.create(
        {
          slug: 'margin-bread',
          name: 'Margin Bread',
          targetMargin: 30,
        },
        // Sell price 200 pence, no VAT
        { cost: '200', currency: 'GBP', vat: false },
        [
          {
            type: 'ingredient',
            slug: 'margin-flour',
            quantity: '100',
            unit: 'g',
            notes: null,
          },
        ]
      )

      const costResult = await calculator.cost('margin-bread')
      const marginResult = await calculator.margin(costResult)

      expect(typeof marginResult.actualMargin).toBe('number')
      expect(typeof marginResult.profit).toBe('number')
      expect(typeof marginResult.meetsTarget).toBe('boolean')
    })

    test('Test 6: VAT-inclusive sell price is stripped before margin calculation', async () => {
      await seedIngredient(
        context,
        { slug: 'vat-flour', name: 'Flour', category: 'dry-goods' },
        { cost: '100', currency: 'GBP', unit: '1 kg', vat: false }
      )

      await recipeService.create(
        { slug: 'vat-bread', name: 'VAT Bread' },
        // Sell price 120 pence, VAT inclusive (ex-VAT = 120/1.2 = 100)
        { cost: '120', currency: 'GBP', vat: true },
        [
          {
            type: 'ingredient',
            slug: 'vat-flour',
            quantity: '100',
            unit: 'g',
            notes: null,
          },
        ]
      )

      const costResult = await calculator.cost('vat-bread')
      const marginResult = await calculator.margin(costResult)

      // Ex-VAT sell price = 120 / 1.2 = 100 pence
      expect(marginResult.sellPrice).toBe(100)
    })

    test('Test 7: meetsTarget reflects whether actual margin meets recipe target margin', async () => {
      await seedIngredient(
        context,
        { slug: 'target-flour', name: 'Flour', category: 'dry-goods' },
        { cost: '500', currency: 'GBP', unit: '1 kg', vat: false }
      )

      // Recipe with high target margin (70%) — should NOT be met with low sell price
      await recipeService.create(
        {
          slug: 'high-target-bread',
          name: 'High Target Bread',
          targetMargin: 70,
        },
        // Sell price 60 pence on a 50 pence cost — actual margin is small, won't meet 70%
        { cost: '60', currency: 'GBP', vat: false },
        [
          {
            type: 'ingredient',
            slug: 'target-flour',
            quantity: '100',
            unit: 'g',
            notes: null,
          },
        ]
      )

      const highCostResult = await calculator.cost('high-target-bread')
      const highMarginResult = await calculator.margin(highCostResult)

      expect(highMarginResult.meetsTarget).toBe(false)

      // Recipe with low target margin (5%) — should be met easily
      await recipeService.create(
        {
          slug: 'low-target-bread',
          name: 'Low Target Bread',
          targetMargin: 5,
        },
        // Sell price 600 pence on a 50 pence cost — easily meets 5% target
        { cost: '600', currency: 'GBP', vat: false },
        [
          {
            type: 'ingredient',
            slug: 'target-flour',
            quantity: '100',
            unit: 'g',
            notes: null,
          },
        ]
      )

      const lowCostResult = await calculator.cost('low-target-bread')
      const lowMarginResult = await calculator.margin(lowCostResult)

      expect(lowMarginResult.meetsTarget).toBe(true)
    })
  })
})
