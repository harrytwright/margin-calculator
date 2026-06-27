import type { DatabaseContext } from '@menubook/shared'

import { ConfigService } from '../config'
import { RecipeService, RecipeWithPricing } from '../recipe'
import { createTestContext } from './helpers/test-adapter'
import {IngredientService} from "../ingredient";

jest.mock('../config', () => {
  return {
    ConfigService: jest.fn().mockImplementation(() => ({
      findVatRate: jest.fn().mockResolvedValue(0.2),
      findMarginTarget: jest.fn().mockResolvedValue(20),
      findDefaultPriceIncludesVat: jest.fn().mockResolvedValue(true),
    })),
  }
})

// /**
//  * Seed a recipe with pricing via raw inserts.
//  * Returns the recipe id.
//  */
// async function seedRecipe(
//   ctx: DatabaseContext,
//   recipe: {
//     slug: string
//     name: string
//     stage?: "development" | "active" | "discontinued"
//     class?: "menu_item" | "base_template" | "sub_recipe"
//     category?: string
//     targetMargin?: number
//     yieldAmount?: string
//     yieldUnit?: string
//     parentId?: number
//   },
//   pricing?: { cost: number; currency: string; vat: boolean }
// ): Promise<number> {
//   const result = await ctx.db
//     .insertInto('Recipe')
//     .values({
//       slug: recipe.slug,
//       name: recipe.name,
//       stage: recipe.stage ?? 'development',
//       class: recipe.class ?? 'menu_item',
//       category: recipe.category ?? null,
//       targetMargin: recipe.targetMargin ?? 20,
//       yieldAmount: recipe.yieldAmount ?? null,
//       yieldUnit: recipe.yieldUnit ?? null,
//       parentId: recipe.parentId ?? null,
//     })
//     .returning('id')
//     .executeTakeFirstOrThrow()
//
//   if (pricing) {
//     const pricingRecord = await ctx.db
//       .insertInto('Pricing')
//       .values({ cost: pricing.cost, currency: pricing.currency })
//       .returning('id')
//       .executeTakeFirstOrThrow()
//
//     await ctx.db
//       .insertInto('RecipePrice')
//       .values({
//         recipeId: result.id,
//         pricingId: pricingRecord.id,
//         vat: ctx.type === 'postgres' ? pricing.vat : pricing.vat ? 1 : 0,
//       })
//       .execute()
//   }
//
//   return result.id
// }

/**
 * Seed an ingredient with pricing. Returns the ingredient id.
 */
async function seedIngredient(
  ctx: DatabaseContext,
  data: { slug: string; name: string; category: string },
  pricing: { cost: string; currency: string; unit: string; vat: boolean }
): Promise<number> {
  const svc = new IngredientService(ctx)
  return (await svc.create(data, 'generic', pricing)).id
}

describe('RecipeService', () => {
  let context: DatabaseContext
  let service: RecipeService
  let configService: ConfigService

  beforeAll(async () => {
    context = await createTestContext()
    configService = new ConfigService(context)
    service = new RecipeService(context, configService)
  })

  afterAll(async () => {
    await context.db.destroy()
  })

  describe('exists', () => {
    let recipeId: number

    beforeEach(async () => {
      recipeId = (await service.create({
        slug: 'ham-sandwich',
        name: 'Ham Sandwich',
      })).id
    })

    afterEach(async () => {
      // Todo: Replace with `service.delete()` when created
      await context.db
        .deleteFrom('Recipe')
        .where('id', '=', recipeId)
        .execute()
    })

    test('should return false for non-existent recipe', async () => {
      expect(await service.exists('no-ham-sandwich')).toBe(false)
    })

    test('should return true for existing recipe', async () => {
      expect(await service.exists('ham-sandwich')).toBe(true)
    })
  })

  describe('find', () => {
    let recipeId: number

    beforeAll(async () => {
      recipeId = (await service.create(
        {
          slug: 'ham-sandwich',
          name: 'Ham Sandwich',
          stage: 'active',
          category: 'sandwiches',
        },
        { cost: '400', currency: 'GBP', vat: false }
      )).id
    })

    afterAll(async () => {
      // Todo: Replace with `service.delete()` when created
      await context.db.deleteFrom('Recipe').where('id', '=', recipeId).execute()
    })

    test('should return recipes with current pricing', async () => {
      const result = await service.find()
      expect(result.length).toEqual(1)

      const recipe = result[0]
      expect(recipe).toBeDefined()
      expect(recipe).toMatchObject({
        slug: 'ham-sandwich',
        name: 'Ham Sandwich',
        stage: 'active',
        category: 'sandwiches',
      })
      expect(recipe!.cost).toMatchObject({
        cost: 400,
        currency: 'GBP',
        vat: context.type === 'postgres' ? false : 0,
      })
    })

    test('should return null cost for recipe without pricing', async () => {
      const unpricedId = (await service.create({
        slug: 'draft-recipe',
        name: 'Draft Recipe',
      })).id

      const result = await service.find()
      const draft = result.find((r) => r.slug === 'draft-recipe')
      expect(draft).toBeDefined()
      expect(draft!.cost).toBeNull()

      await context.db
        .deleteFrom('Recipe')
        .where('id', '=', unpricedId)
        .execute()
    })

    test('should only return current pricing (validTo is null)', async () => {
      await service.updatePricingHistory(recipeId, {
        cost: '500', currency: 'GBP', vat: false
      })

      const result = await service.find()
      const recipe = result[0]
      expect(recipe!.cost!.cost).toBe(500)
    })
  })

  describe('findById', () => {
    let recipeId: number
    let hamId: number
    let cheeseId: number

    beforeAll(async () => {
      hamId = await seedIngredient(
        context,
        { slug: 'ham', name: 'Ham', category: 'meat' },
        { cost: '599', currency: 'GBP', unit: '1kg', vat: false }
      )

      cheeseId = await seedIngredient(
        context,
        { slug: 'cheese', name: 'Cheese', category: 'dairy' },
        { cost: '250', currency: 'GBP', unit: '200g', vat: false }
      )

      recipeId = (await service.create(
        {
          slug: 'ham-sandwich',
          name: 'Ham Sandwich',
          stage: 'active',
          category: 'sandwiches',
          targetMargin: 65,
        },
        { cost: '400', currency: 'GBP', vat: false },
        [
          { ingredientId: hamId, quantity: '25', unit: 'g', notes: 'Thinly sliced' },
          { ingredientId: cheeseId, quantity: '15', unit: 'g', notes: null },
        ]
      )).id
    })

    // Todo: Sort this, maybe create both services, for ingredient, and use recipe.delete
    afterAll(async () => {
      await context.db.deleteFrom('Recipe').where('id', '=', recipeId).execute()
      await context.db
        .deleteFrom('Ingredient')
        .where('id', 'in', [hamId, cheeseId])
        .execute()
    })

    test('should throw for non-existent recipe', async () => {
      await expect(service.findById('does-not-exist')).rejects.toThrow()
    })

    test('should return recipe with current pricing by default', async () => {
      const result = await service.findById('ham-sandwich')

      expect(result).toMatchObject({
        slug: 'ham-sandwich',
        name: 'Ham Sandwich',
        stage: 'active',
        category: 'sandwiches',
        targetMargin: 65,
      })

      expect(result.cost).toMatchObject({
        cost: 400,
        currency: 'GBP',
        vat: context.type === 'postgres' ? false : 0,
      })
    })

    test('should accept numeric id', async () => {
      const result = await service.findById(recipeId)
      expect(result.slug).toBe('ham-sandwich')
    })

    test('should not include ingredients by default', async () => {
      const result = await service.findById('ham-sandwich')
      expect(result).not.toHaveProperty('ingredients')
    })

    test('should not include historical pricing by default', async () => {
      const result = await service.findById('ham-sandwich')
      expect(result).not.toHaveProperty('historicalPricing')
    })

    test('should not include children by default', async () => {
      const result = await service.findById('ham-sandwich')
      expect(result).not.toHaveProperty('children')
    })

    describe('withIngredients', () => {
      test('should return ingredients when requested', async () => {
        const result = await service.findById('ham-sandwich', {
          withIngredients: true,
        })

        expect(result.ingredients).toHaveLength(2)
        expect(result.ingredients).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              slug: 'ham',
              name: 'Ham',
              unit: 'g',
              quantity: 25,
              notes: 'Thinly sliced',
              type: 'ingredient',
            }),
            expect.objectContaining({
              slug: 'cheese',
              name: 'Cheese',
              unit: 'g',
              quantity: 15,
              type: 'ingredient',
            }),
          ])
        )
      })

      test('should correctly identify sub-recipe types', async () => {
        const sauceId = (await service.create(
          {
            slug: 'sub-recipe-pizza-sauce',
            name: 'Pizza Sauce',
            class: 'sub_recipe',
            yieldAmount: '500',
            yieldUnit: 'ml',
          },
          { cost: '150', currency: 'GBP', vat: false }
        )).id

        const pizzaId = (await service.create(
          { slug: 'sub-recipe-margherita', name: 'Margherita Pizza', stage: 'active' },
          { cost: '800', currency: 'GBP', vat: false },
          [
            { type: 'recipe', slug: 'sub-recipe-pizza-sauce', quantity: '100', unit: 'ml', notes: 'Spread evenly' },
            { type: 'ingredient', slug: 'cheese', quantity: '50', unit: 'g', notes: 'Grated' },
          ]
        )).id

        const result = await service.findById('sub-recipe-margherita', {
          withIngredients: true,
        })

        expect(result.ingredients).toHaveLength(2)

        const regularIngredients = result.ingredients.filter(
          (i) => i.type === 'ingredient'
        )
        const subRecipes = result.ingredients.filter((i) => i.type === 'recipe')

        expect(regularIngredients).toHaveLength(1)
        expect(regularIngredients[0]).toMatchObject({
          slug: 'cheese',
          quantity: 50,
          unit: 'g',
          notes: 'Grated',
        })

        expect(subRecipes).toHaveLength(1)
        expect(subRecipes[0]).toMatchObject({
          slug: 'sub-recipe-pizza-sauce',
          quantity: 100,
          unit: 'ml',
          notes: 'Spread evenly',
        })

        // Cleanup
        await context.db
          .deleteFrom('Recipe')
          .where('id', 'in', [pizzaId, sauceId])
          .execute()
      })
    })

    describe('withHistoricalPrices', () => {
      test('should return empty history when no price changes', async () => {
        const result = await service.findById('ham-sandwich', {
          withHistoricalPrices: true,
        })
        expect(result.historicalPricing).toEqual([])
      })

      test('should return historical pricing after price change', async () => {
        await service.updatePricingHistory(recipeId, {
          cost: '450', currency: 'GBP', vat: false
        })

        const result = await service.findById('ham-sandwich', {
          withHistoricalPrices: true,
        })

        expect(result.cost!.cost).toBe(450)
        expect(result.historicalPricing.length).toBeGreaterThanOrEqual(1)
      })
    })

    describe('withChildren', () => {
      test('should return empty children when recipe has none', async () => {
        const result = await service.findById('ham-sandwich', {
          withChildren: true,
        })
        expect(result.children).toEqual([])
      })

      test('should return child recipes with pricing', async () => {
        const parentId = (await service.create({
            slug: 'base-pizza',
            name: 'Base Pizza',
            class: 'base_template',
          },
          { cost: '800', currency: 'GBP', vat: true }
        )).id

        const child1Id = (await service.create({
            slug: 'margherita',
            name: 'Margherita Pizza',
            stage: 'active',
            parentId,
          },
          { cost: '800', currency: 'GBP', vat: true }
        )).id

        const child2Id = (await service.create({
            slug: 'pepperoni',
            name: 'Pepperoni Pizza',
            stage: 'active',
            parentId,
          },
          { cost: '900', currency: 'GBP', vat: true }
        )).id

        const result = await service.findById('base-pizza', {
          withChildren: true,
        })

        expect(result.children).toHaveLength(2)
        expect(result.children).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              slug: 'margherita',
              name: 'Margherita Pizza',
              cost: expect.objectContaining({ cost: 800 }),
            }),
            expect.objectContaining({
              slug: 'pepperoni',
              name: 'Pepperoni Pizza',
              cost: expect.objectContaining({ cost: 900 }),
            }),
          ])
        )

        // Cleanup
        await context.db
          .deleteFrom('Recipe')
          .where('id', 'in', [child1Id, child2Id, parentId])
          .execute()
      })

      test('should return null cost for unpriced children', async () => {
        const parentId = (await service.create({ slug: 'base-pizza', name: 'Base Pizza', class: 'base_template' },
          { cost: '800', currency: 'GBP', vat: false }
        )).id

        const childId = (await service.create({
          slug: 'draft-pizza',
          name: 'Draft Pizza',
          parentId,
        })).id

        const result = await service.findById('base-pizza', {
          withChildren: true,
        })

        expect(result.children).toHaveLength(1)
        expect(result.children[0].cost).toBeNull()

        await context.db
          .deleteFrom('Recipe')
          .where('id', 'in', [childId, parentId])
          .execute()
      })
    })

    describe('combined options', () => {
      test('should return all optional data when all flags are true', async () => {
        const result = await service.findById('ham-sandwich', {
          withIngredients: true,
          withHistoricalPrices: true,
          withChildren: true,
        })

        expect(result).toHaveProperty('ingredients')
        expect(result).toHaveProperty('historicalPricing')
        expect(result).toHaveProperty('children')
        expect(result.slug).toBe('ham-sandwich')
      })
    })
  })

  describe('create', () => {
    let created: RecipeWithPricing | undefined

    afterEach(async () => {
      if (created) {
        await context.db
          .deleteFrom('Recipe')
          .where('id', '=', created.id)
          .execute()
        created = undefined
      }
    })

    test('should create recipe without pricing', async () => {
      created = await service.create({
        slug: 'ham-sandwich',
        name: 'Ham Sandwich',
        stage: 'active',
        class: 'menu_item',
        category: 'sandwiches',
        targetMargin: 65,
      })

      expect(created).toMatchObject({
        slug: 'ham-sandwich',
        name: 'Ham Sandwich',
        stage: 'active',
        category: 'sandwiches',
        targetMargin: 65,
      })
      expect(created.cost).toBeNull()
    })

    test('should create recipe with pricing', async () => {
      created = await service.create(
        {
          slug: 'ham-sandwich',
          name: 'Ham Sandwich',
          stage: 'active',
          class: 'menu_item',
          targetMargin: 65,
        },
        { vat: false, cost: '400', currency: 'GBP' }
      )

      expect(created.cost).toMatchObject({
        cost: 400,
        currency: 'GBP',
        vat: context.type === 'postgres' ? false : 0,
        validTo: null,
      })
    })

    test('should create recipe with ingredients by id', async () => {
      const hamId = await seedIngredient(
        context,
        { slug: 'create-ham', name: 'Ham', category: 'meat' },
        { cost: '599', currency: 'GBP', unit: '1kg', vat: false }
      )

      created = await service.create(
        { slug: 'ham-sandwich', name: 'Ham Sandwich' },
        { vat: false, cost: '400', currency: 'GBP' },
        [
          {
            ingredientId: hamId,
            subRecipeId: null,
            quantity: '25',
            unit: 'g',
            notes: 'Thinly sliced',
          },
        ]
      )

      const result = await service.findById('ham-sandwich', {
        withIngredients: true,
      })
      expect(result.ingredients).toHaveLength(1)
      expect(result.ingredients[0]).toMatchObject({
        slug: 'create-ham',
        quantity: 25,
        unit: 'g',
        notes: 'Thinly sliced',
        type: 'ingredient',
      })

      await context.db
        .deleteFrom('Ingredient')
        .where('id', '=', hamId)
        .execute()
    })

    test('should create recipe with ingredients by slug', async () => {
      const hamId = await seedIngredient(
        context,
        { slug: 'create-ham-slug', name: 'Ham', category: 'meat' },
        { cost: '599', currency: 'GBP', unit: '1kg', vat: false }
      )

      created = await service.create(
        { slug: 'ham-sandwich', name: 'Ham Sandwich' },
        { vat: false, cost: '400', currency: 'GBP' },
        [
          {
            type: 'ingredient',
            slug: 'create-ham-slug',
            quantity: '50',
            unit: 'g',
            notes: null,
          },
        ]
      )

      const result = await service.findById('ham-sandwich', {
        withIngredients: true,
      })
      expect(result.ingredients).toHaveLength(1)
      expect(result.ingredients[0]).toMatchObject({
        slug: 'create-ham-slug',
        type: 'ingredient',
      })

      await context.db
        .deleteFrom('Ingredient')
        .where('id', '=', hamId)
        .execute()
    })

    test('should create recipe with sub-recipe ingredient by slug', async () => {
      const sauceId = (await service.create({
          slug: 'create-sauce',
          name: 'Sauce',
          class: 'sub_recipe',
          yieldAmount: '500',
          yieldUnit: 'ml',
        },
        { cost: '150', currency: 'GBP', vat: false }
      )).id

      created = await service.create(
        { slug: 'pasta-dish', name: 'Pasta Dish' },
        { vat: false, cost: '800', currency: 'GBP' },
        [
          {
            type: 'recipe',
            slug: 'create-sauce',
            quantity: '100',
            unit: 'ml',
            notes: null,
          },
        ]
      )

      const result = await service.findById('pasta-dish', {
        withIngredients: true,
      })
      expect(result.ingredients).toHaveLength(1)
      expect(result.ingredients[0]).toMatchObject({
        slug: 'create-sauce',
        type: 'recipe',
        quantity: 100,
        unit: 'ml',
      })

      await context.db.deleteFrom('Recipe').where('id', '=', sauceId).execute()
    })

    test('should throw on duplicate slug', async () => {
      created = await service.create({
        slug: 'ham-sandwich',
        name: 'Ham Sandwich',
      })

      await expect(
        service.create({ slug: 'ham-sandwich', name: 'Another Ham' })
      ).rejects.toThrow(/already exists/)
    })
  })

  describe('update', () => {
    let recipeId: number

    beforeEach(async () => {
      recipeId = (await service.create(
        { slug: 'ham-sandwich', name: 'Ham Sandwich', stage: 'active' },
        { cost: '400', currency: 'GBP', vat: false }
      )).id
    })

    afterEach(async () => {
      await context.db.deleteFrom('Recipe').where('id', '=', recipeId).execute()
    })

    test('should update recipe fields', async () => {
      const result = await service.update('ham-sandwich', {
        name: 'Toasted Ham Sandwich',
        category: 'hot-sandwiches',
      })
      expect(result.name).toBe('Toasted Ham Sandwich')
      expect(result.category).toBe('hot-sandwiches')
    })

    test('should throw when attempting to change slug', async () => {
      await expect(
        service.update('ham-sandwich', { slug: 'new-slug' })
      ).rejects.toThrow(/Cannot change slug/)
    })

    test('should not modify pricing (use updatePricingHistory for that)', async () => {
      await service.update('ham-sandwich', { name: 'Updated' })
      const result = await service.findById('ham-sandwich')
      expect(result.cost!.cost).toBe(400)
    })
  })

  describe('delete', () => {
    test('should return false when deleting non-existent recipe', async () => {
      expect(await service.delete('does-not-exist')).toBe(false)
    })

    test('should return true and delete existing recipe', async () => {
      await service.create({ slug: 'temp-recipe', name: 'Temp' })
      expect(await service.delete('temp-recipe')).toBe(true)
      expect(await service.exists('temp-recipe')).toBe(false)
    })
  })

  describe('updatePricingHistory', () => {
    let recipeId: number

    beforeEach(async () => {
      recipeId = (await service.create(
        { slug: 'priced-recipe', name: 'Priced Recipe' },
        { cost: '400', currency: 'GBP', vat: false }
      )).id
    })

    afterEach(async () => {
      await context.db.deleteFrom('Recipe').where('id', '=', recipeId).execute()
    })

    test('should create new pricing record', async () => {
      const pricing = await service.updatePricingHistory(recipeId, {
        vat: false,
        cost: '599',
        currency: 'GBP',
      })

      expect(pricing.cost).toBe(599)
      expect(pricing.currency).toBe('GBP')
      expect(pricing.validTo).toBeNull()
    })

    test('should close previous active pricing', async () => {
      await service.updatePricingHistory(recipeId, {
        vat: false,
        cost: '599',
        currency: 'GBP',
      })

      const prices = await context.db
        .selectFrom('RecipePrice')
        .selectAll()
        .where('recipeId', '=', recipeId)
        .execute()

      expect(prices).toHaveLength(2)

      const expired = prices.filter((p) => p.validTo !== null)
      const current = prices.filter((p) => p.validTo === null)

      expect(expired).toHaveLength(1)
      expect(current).toHaveLength(1)
    })

    test('should return new pricing after update', async () => {
      const pricing = await service.updatePricingHistory(recipeId, {
        vat: true,
        cost: '500',
        currency: 'EUR',
      })

      expect(pricing.cost).toBe(500)
      expect(pricing.currency).toBe('EUR')
      expect(pricing.vat).toBe(context.type === 'postgres' ? true : 1)
    })

    test('should maintain pricing chain across multiple updates', async () => {
      await service.updatePricingHistory(recipeId, {
        vat: false,
        cost: '500',
        currency: 'GBP',
      })

      await service.updatePricingHistory(recipeId, {
        vat: false,
        cost: '650',
        currency: 'GBP',
      })

      const result = await service.findById('priced-recipe', {
        withHistoricalPrices: true,
      })
      expect(result.cost!.cost).toBe(650)
      expect(result.historicalPricing.length).toBeGreaterThanOrEqual(2)

      const historicalCosts = result.historicalPricing.map((p) => p.cost)
      expect(historicalCosts).toContain(400)
      expect(historicalCosts).toContain(500)
    })
  })

  describe('handleIngredient', () => {
    let recipeId: number
    let hamId: number

    beforeEach(async () => {
      hamId = await seedIngredient(
        context,
        { slug: 'handle-ham', name: 'Ham', category: 'meat' },
        { cost: '599', currency: 'GBP', unit: '1kg', vat: false }
      )

      recipeId = (await service.create(
        { slug: 'test-sandwich', name: 'Test Sandwich' },
        { cost: '400', currency: 'GBP', vat: false }
      )).id
    })

    afterEach(async () => {
      await context.db.deleteFrom('Recipe').where('id', '=', recipeId).execute()
      await context.db
        .deleteFrom('Ingredient')
        .where('id', '=', hamId)
        .execute()
    })

    test('put should add ingredient by id', async () => {
      const result = await service.handleIngredient('test-sandwich', 'put', {
        ingredientId: hamId,
        subRecipeId: null,
        quantity: '25',
        unit: 'g',
        notes: 'Sliced',
      })

      expect(result).toMatchObject({
        slug: 'handle-ham',
        type: 'ingredient',
        quantity: 25,
        unit: 'g',
        notes: 'Sliced',
      })
    })

    test('put should add ingredient by slug', async () => {
      const result = await service.handleIngredient('test-sandwich', 'put', {
        type: 'ingredient',
        slug: 'handle-ham',
        quantity: '50',
        unit: 'g',
        notes: null,
      })

      expect(result).toMatchObject({
        slug: 'handle-ham',
        type: 'ingredient',
        quantity: 50,
      })
    })

    test('put should add sub-recipe by slug', async () => {
      const sauceId = (await service.create({
          slug: 'handle-sauce',
          name: 'Sauce',
          class: 'sub_recipe',
          yieldAmount: '500',
          yieldUnit: 'ml',
        },
        { cost: '150', currency: 'GBP', vat: false }
      )).id

      const result = await service.handleIngredient('test-sandwich', 'put', {
        type: 'recipe',
        slug: 'handle-sauce',
        quantity: '100',
        unit: 'ml',
        notes: null,
      })

      expect(result).toMatchObject({
        slug: 'handle-sauce',
        type: 'recipe',
        quantity: 100,
        unit: 'ml',
      })

      await context.db.deleteFrom('Recipe').where('id', '=', sauceId).execute()
    })

    test('put should upsert (replace existing ingredient)', async () => {
      await service.handleIngredient('test-sandwich', 'put', {
        ingredientId: hamId,
        subRecipeId: null,
        quantity: '25',
        unit: 'g',
        notes: null,
      })

      const updated = await service.handleIngredient('test-sandwich', 'put', {
        ingredientId: hamId,
        subRecipeId: null,
        quantity: '50',
        unit: 'g',
        notes: 'Double portion',
      })

      expect(updated.quantity).toBe(50)
      expect(updated.notes).toBe('Double portion')

      // Should only have one record, not two
      const ingredients = await context.db
        .selectFrom('RecipeIngredients')
        .selectAll()
        .where('recipeId', '=', recipeId)
        .execute()
      expect(ingredients).toHaveLength(1)
    })

    test('delete should remove ingredient', async () => {
      await service.handleIngredient('test-sandwich', 'put', {
        ingredientId: hamId,
        subRecipeId: null,
        quantity: '25',
        unit: 'g',
        notes: null,
      })

      const result = await service.handleIngredient(
        'test-sandwich',
        'delete',
        'handle-ham'
      )
      expect(result).toBe(true)

      const ingredients = await context.db
        .selectFrom('RecipeIngredients')
        .selectAll()
        .where('recipeId', '=', recipeId)
        .execute()
      expect(ingredients).toHaveLength(0)
    })

    test('delete should return false for non-existent ingredient', async () => {
      const result = await service.handleIngredient(
        'test-sandwich',
        'delete',
        'does-not-exist'
      )
      expect(result).toBe(false)
    })
  })
})
