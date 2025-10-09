import path from 'path'

import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'

import { migrate } from '../../datastore/database'
import { DB } from '../../datastore/types'
import { Importer } from '../../lib/importer'
import { RecipeResolvedImportData } from '../../schema'
import { IngredientService } from '../ingredient'
import { RecipeService } from '../recipe'
import { SupplierService } from '../supplier'

describe('RecipeService', () => {
  let db: Kysely<DB>
  let service: RecipeService
  let ingredientService: IngredientService
  let supplierService: SupplierService
  let supplierId: number
  let hamId: number
  let cheeseId: number

  beforeEach(async () => {
    db = new Kysely<DB>({
      dialect: new SqliteDialect({
        database: new Database(':memory:'),
      }),
    })

    await migrate.call(
      db,
      'up',
      path.join(__dirname, '../../datastore/migrations')
    )

    supplierService = new SupplierService(db)
    ingredientService = new IngredientService(db, supplierService)
    service = new RecipeService(db, ingredientService)

    // Create test supplier and ingredients
    const supplier = await db
      .insertInto('Supplier')
      .values({ slug: 'asda', name: 'Asda' })
      .returning('id')
      .executeTakeFirst()
    supplierId = supplier!.id

    const ham = await db
      .insertInto('Ingredient')
      .values({
        slug: 'ham',
        name: 'Ham',
        category: 'meat',
        purchaseUnit: '1kg',
        purchaseCost: 5.99,
        supplierId,
      })
      .returning('id')
      .executeTakeFirst()
    hamId = ham!.id

    const cheese = await db
      .insertInto('Ingredient')
      .values({
        slug: 'cheese',
        name: 'Cheese',
        category: 'dairy',
        purchaseUnit: '200g',
        purchaseCost: 2.5,
        supplierId,
      })
      .returning('id')
      .executeTakeFirst()
    cheeseId = cheese!.id
  })

  afterEach(async () => {
    await db.destroy()
  })

  describe('exists', () => {
    test('should return false for non-existent recipe', async () => {
      const exists = await service.exists('ham-sandwich')
      expect(exists).toBe(false)
    })

    test('should return true for existing recipe', async () => {
      await db
        .insertInto('Recipe')
        .values({
          slug: 'ham-sandwich',
          name: 'Ham Sandwich',
          sellPrice: 400,
        })
        .execute()

      const exists = await service.exists('ham-sandwich')
      expect(exists).toBe(true)
    })
  })

  describe('findById', () => {
    test('should return undefined for non-existent recipe', async () => {
      const result = await service.findById('ham-sandwich')
      expect(result).toBeUndefined()
    })

    test('should return recipe data with ingredients', async () => {
      const recipe = await db
        .insertInto('Recipe')
        .values({
          slug: 'ham-sandwich',
          name: 'Ham Sandwich',
          stage: 'active',
          class: 'menu_item',
          category: 'sandwiches',
          sellPrice: 400,
          includesVat: 0,
          targetMargin: 65,
        })
        .returning('id')
        .executeTakeFirst()

      await db
        .insertInto('RecipeIngredients')
        .values([
          {
            recipeId: recipe!.id,
            ingredientId: hamId,
            unit: '25g',
          },
          {
            recipeId: recipe!.id,
            ingredientId: cheeseId,
            unit: '15g',
          },
        ])
        .execute()

      const result = await service.findById('ham-sandwich')
      expect(result).toMatchObject({
        id: expect.any(Number),
        slug: 'ham-sandwich',
        name: 'Ham Sandwich',
        stage: 'active',
        class: 'menu_item',
        category: 'sandwiches',
        sellPrice: 400,
        includesVat: 0,
        targetMargin: 65,
      })

      // ParseJSONResultsPlugin converts jsonArrayFrom to array
      const ingredients =
        typeof result?.ingredients === 'string'
          ? JSON.parse(result.ingredients)
          : result?.ingredients

      expect(ingredients).toHaveLength(2)
      expect(ingredients).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ slug: 'ham', unit: '25g' }),
          expect.objectContaining({ slug: 'cheese', unit: '15g' }),
        ])
      )
    })

    test('should return recipe with parent reference', async () => {
      const parent = await db
        .insertInto('Recipe')
        .values({
          slug: 'base-pizza',
          name: 'Base Pizza',
          sellPrice: 800,
        })
        .returning('id')
        .executeTakeFirst()

      await db
        .insertInto('Recipe')
        .values({
          slug: 'margherita',
          name: 'Margherita Pizza',
          parentId: parent!.id,
          sellPrice: 800,
        })
        .execute()

      const result = await service.findById('margherita')
      expect(result?.parentSlug).toBe('base-pizza')
    })
  })

  describe('upsert', () => {
    test('should create new recipe', async () => {
      const data: RecipeResolvedImportData = {
        slug: 'ham-sandwich',
        name: 'Ham Sandwich',
        stage: 'active',
        class: 'menu_item',
        costing: {
          price: 400,
          vat: false,
          margin: 65,
        },
        ingredients: [],
      }

      const recipeId = await service.upsert('ham-sandwich', data)
      expect(recipeId).toBeDefined()

      const recipe = await db
        .selectFrom('Recipe')
        .selectAll()
        .where('id', '=', recipeId!)
        .executeTakeFirst()

      expect(recipe).toMatchObject({
        slug: 'ham-sandwich',
        name: 'Ham Sandwich',
        sellPrice: 400,
        includesVat: 0,
        targetMargin: 65,
      })
    })

    test('should update existing recipe', async () => {
      await db
        .insertInto('Recipe')
        .values({
          slug: 'ham-sandwich',
          name: 'Old Name',
          sellPrice: 300,
        })
        .execute()

      const data: RecipeResolvedImportData = {
        slug: 'ham-sandwich',
        name: 'New Name',
        stage: 'active',
        class: 'menu_item',
        costing: {
          price: 400,
        },
        ingredients: [],
      }

      await service.upsert('ham-sandwich', data)

      const recipe = await db
        .selectFrom('Recipe')
        .selectAll()
        .where('slug', '=', 'ham-sandwich')
        .executeTakeFirst()

      expect(recipe).toMatchObject({
        name: 'New Name',
        sellPrice: 400,
      })
    })

    test('should inherit price from parent recipe', async () => {
      const parent = await db
        .insertInto('Recipe')
        .values({
          slug: 'base-pizza',
          name: 'Base Pizza',
          sellPrice: 800,
        })
        .returning('id')
        .executeTakeFirst()

      const data: RecipeResolvedImportData = {
        slug: 'margherita',
        name: 'Margherita Pizza',
        parentSlug: 'base-pizza',
        stage: 'active',
        class: 'menu_item',
        costing: {},
        ingredients: [],
      }

      const recipeId = await service.upsert('margherita', data)

      const recipe = await db
        .selectFrom('Recipe')
        .selectAll()
        .where('id', '=', recipeId!)
        .executeTakeFirst()

      expect(recipe?.sellPrice).toBe(800)
      expect(recipe?.parentId).toBe(parent!.id)
    })

    test('should handle VAT flag', async () => {
      const data: RecipeResolvedImportData = {
        slug: 'ham-sandwich',
        name: 'Ham Sandwich',
        stage: 'active',
        class: 'menu_item',
        costing: {
          price: 400,
          vat: true,
        },
        ingredients: [],
      }

      const recipeId = await service.upsert('ham-sandwich', data)

      const recipe = await db
        .selectFrom('Recipe')
        .selectAll()
        .where('id', '=', recipeId!)
        .executeTakeFirst()

      expect(recipe?.includesVat).toBe(1)
    })

    test('should handle yield for sub-recipes', async () => {
      const data: RecipeResolvedImportData = {
        slug: 'pizza-sauce',
        name: 'Pizza Sauce',
        stage: 'active',
        class: 'sub_recipe',
        costing: {
          price: 0,
        },
        yieldAmount: 500,
        yieldUnit: 'ml',
        ingredients: [],
      }

      const recipeId = await service.upsert('pizza-sauce', data)

      const recipe = await db
        .selectFrom('Recipe')
        .selectAll()
        .where('id', '=', recipeId!)
        .executeTakeFirst()

      expect(recipe?.yieldAmount).toBe(500)
      expect(recipe?.yieldUnit).toBe('ml')
    })

    test('should throw error when no price and no parent', async () => {
      const data: RecipeResolvedImportData = {
        slug: 'ham-sandwich',
        name: 'Ham Sandwich',
        stage: 'active',
        class: 'menu_item',
        costing: {},
        ingredients: [],
      }

      await expect(service.upsert('ham-sandwich', data)).rejects.toThrow(
        /missing 'costing.price'/
      )
    })
  })

  describe('upsertIngredients', () => {
    let recipeId: number

    beforeEach(async () => {
      const recipe = await db
        .insertInto('Recipe')
        .values({
          slug: 'ham-sandwich',
          name: 'Ham Sandwich',
          sellPrice: 400,
        })
        .returning('id')
        .executeTakeFirst()
      recipeId = recipe!.id
    })

    test('should add ingredients to recipe', async () => {
      const data: RecipeResolvedImportData = {
        slug: 'ham-sandwich',
        name: 'Ham Sandwich',
        stage: 'active',
        class: 'menu_item',
        costing: { price: 400 },
        ingredients: [
          { type: 'ingredient', slug: 'ham', with: { unit: '25g' } },
          { type: 'ingredient', slug: 'cheese', with: { unit: '15g' } },
        ],
      }

      await service.upsertIngredients(recipeId, data)

      const ingredients = await db
        .selectFrom('RecipeIngredients')
        .selectAll()
        .where('recipeId', '=', recipeId)
        .execute()

      expect(ingredients).toHaveLength(2)
      expect(ingredients).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ ingredientId: hamId, unit: '25g' }),
          expect.objectContaining({ ingredientId: cheeseId, unit: '15g' }),
        ])
      )
    })

    test('should replace existing ingredients', async () => {
      // Add initial ingredients
      await db
        .insertInto('RecipeIngredients')
        .values({
          recipeId,
          ingredientId: hamId,
          unit: '50g',
        })
        .execute()

      const data: RecipeResolvedImportData = {
        slug: 'ham-sandwich',
        name: 'Ham Sandwich',
        stage: 'active',
        class: 'menu_item',
        costing: { price: 400 },
        ingredients: [
          { type: 'ingredient', slug: 'cheese', with: { unit: '20g' } },
        ],
      }

      await service.upsertIngredients(recipeId, data)

      const ingredients = await db
        .selectFrom('RecipeIngredients')
        .selectAll()
        .where('recipeId', '=', recipeId)
        .execute()

      expect(ingredients).toHaveLength(1)
      expect(ingredients[0]).toMatchObject({
        ingredientId: cheeseId,
        unit: '20g',
      })
    })

    test('should handle sub-recipe ingredients', async () => {
      const subRecipe = await db
        .insertInto('Recipe')
        .values({
          slug: 'pizza-sauce',
          name: 'Pizza Sauce',
          sellPrice: 0,
        })
        .returning('id')
        .executeTakeFirst()

      const data: RecipeResolvedImportData = {
        slug: 'margherita',
        name: 'Margherita Pizza',
        stage: 'active',
        class: 'menu_item',
        costing: { price: 800 },
        ingredients: [
          { type: 'recipe', slug: 'pizza-sauce', with: { unit: '100ml' } },
          { type: 'ingredient', slug: 'cheese', with: { unit: '50g' } },
        ],
      }

      await service.upsertIngredients(recipeId, data)

      const ingredients = await db
        .selectFrom('RecipeIngredients')
        .selectAll()
        .where('recipeId', '=', recipeId)
        .execute()

      expect(ingredients).toHaveLength(2)
      expect(ingredients).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            subRecipeId: subRecipe!.id,
            ingredientId: null,
            unit: '100ml',
          }),
          expect.objectContaining({
            ingredientId: cheeseId,
            subRecipeId: null,
            unit: '50g',
          }),
        ])
      )
    })

    test('should handle notes on ingredients', async () => {
      const data: RecipeResolvedImportData = {
        slug: 'ham-sandwich',
        name: 'Ham Sandwich',
        stage: 'active',
        class: 'menu_item',
        costing: { price: 400 },
        ingredients: [
          {
            type: 'ingredient',
            slug: 'ham',
            with: { unit: '25g', notes: 'Thinly sliced' },
          },
        ],
      }

      await service.upsertIngredients(recipeId, data)

      const ingredients = await db
        .selectFrom('RecipeIngredients')
        .selectAll()
        .where('recipeId', '=', recipeId)
        .execute()

      expect(ingredients[0].notes).toBe('Thinly sliced')
    })
  })

  describe('delete', () => {
    test('should return false when deleting non-existent recipe', async () => {
      const deleted = await service.delete('ham-sandwich')
      expect(deleted).toBe(false)
    })

    test('should return true and delete existing recipe', async () => {
      await db
        .insertInto('Recipe')
        .values({
          slug: 'ham-sandwich',
          name: 'Ham Sandwich',
          sellPrice: 400,
        })
        .execute()

      const deleted = await service.delete('ham-sandwich')
      expect(deleted).toBe(true)

      const exists = await service.exists('ham-sandwich')
      expect(exists).toBe(false)
    })

    test('should cascade delete recipe ingredients', async () => {
      const recipe = await db
        .insertInto('Recipe')
        .values({
          slug: 'ham-sandwich',
          name: 'Ham Sandwich',
          sellPrice: 400,
        })
        .returning('id')
        .executeTakeFirst()

      await db
        .insertInto('RecipeIngredients')
        .values({
          recipeId: recipe!.id,
          ingredientId: hamId,
          unit: '25g',
        })
        .execute()

      await service.delete('ham-sandwich')

      const ingredients = await db
        .selectFrom('RecipeIngredients')
        .selectAll()
        .where('recipeId', '=', recipe!.id)
        .execute()

      expect(ingredients).toHaveLength(0)
    })
  })

  describe('processor', () => {
    let importer: Importer

    beforeEach(() => {
      importer = new Importer(db)
    })

    test('should return "created" for new recipe', async () => {
      const data: RecipeResolvedImportData = {
        slug: 'ham-sandwich',
        name: 'Ham Sandwich',
        stage: 'active',
        class: 'menu_item',
        costing: {
          price: 400,
          margin: 65,
        },
        ingredients: [
          { type: 'ingredient', slug: 'ham', with: { unit: '25g' } },
          { type: 'ingredient', slug: 'cheese', with: { unit: '15g' } },
        ],
      }

      const result = await service.processor(importer, data, undefined)
      expect(result).toBe('created')

      const recipe = await service.findById('ham-sandwich')
      expect(recipe?.name).toBe('Ham Sandwich')

      const ingredients =
        typeof recipe?.ingredients === 'string'
          ? JSON.parse(recipe.ingredients)
          : recipe?.ingredients
      expect(ingredients).toHaveLength(2)
    })

    test('should return "upserted" for updated recipe', async () => {
      await db
        .insertInto('Recipe')
        .values({
          slug: 'ham-sandwich',
          name: 'Old Name',
          sellPrice: 300,
        })
        .execute()

      const data: RecipeResolvedImportData = {
        slug: 'ham-sandwich',
        name: 'New Name',
        stage: 'active',
        class: 'menu_item',
        costing: {
          price: 400,
        },
        ingredients: [],
      }

      const result = await service.processor(importer, data, undefined)
      expect(result).toBe('upserted')
    })

    test('should return "ignored" when no changes detected', async () => {
      const recipe = await db
        .insertInto('Recipe')
        .values({
          slug: 'ham-sandwich',
          name: 'Ham Sandwich',
          stage: 'development',
          class: 'menu_item',
          category: null,
          sellPrice: 400,
          includesVat: 0,
          targetMargin: 65,
          yieldAmount: null,
          yieldUnit: null,
        })
        .returning('id')
        .executeTakeFirst()

      const data: RecipeResolvedImportData = {
        slug: 'ham-sandwich',
        name: 'Ham Sandwich',
        stage: 'development',
        class: 'menu_item',
        costing: {
          price: 400,
          margin: 65,
          vat: false,
        },
        ingredients: [],
      }

      const result = await service.processor(importer, data, undefined)
      expect(result).toBe('ignored')
    })

    test('should throw error when parent recipe does not exist', async () => {
      const data: RecipeResolvedImportData = {
        slug: 'margherita',
        name: 'Margherita Pizza',
        parentSlug: 'non-existent',
        stage: 'active',
        class: 'menu_item',
        costing: {},
        ingredients: [],
      }

      await expect(
        service.processor(importer, data, undefined)
      ).rejects.toThrow(/missing parent 'non-existent'/)
    })

    test('should throw error when changing parent on existing recipe', async () => {
      const parent1 = await db
        .insertInto('Recipe')
        .values({
          slug: 'base-pizza-1',
          name: 'Base Pizza 1',
          sellPrice: 800,
        })
        .returning('id')
        .executeTakeFirst()

      const parent2 = await db
        .insertInto('Recipe')
        .values({
          slug: 'base-pizza-2',
          name: 'Base Pizza 2',
          sellPrice: 800,
        })
        .returning('id')
        .executeTakeFirst()

      await db
        .insertInto('Recipe')
        .values({
          slug: 'margherita',
          name: 'Margherita Pizza',
          parentId: parent1!.id,
          sellPrice: 800,
        })
        .execute()

      const data: RecipeResolvedImportData = {
        slug: 'margherita',
        name: 'Margherita Pizza',
        parentSlug: 'base-pizza-2',
        stage: 'active',
        class: 'menu_item',
        costing: {},
        ingredients: [],
      }

      await expect(
        service.processor(importer, data, undefined)
      ).rejects.toThrow(/Cannot change parent/)
    })

    test('should detect changes in ingredients', async () => {
      const recipe = await db
        .insertInto('Recipe')
        .values({
          slug: 'ham-sandwich',
          name: 'Ham Sandwich',
          sellPrice: 400,
        })
        .returning('id')
        .executeTakeFirst()

      await db
        .insertInto('RecipeIngredients')
        .values({
          recipeId: recipe!.id,
          ingredientId: hamId,
          unit: '25g',
        })
        .execute()

      const data: RecipeResolvedImportData = {
        slug: 'ham-sandwich',
        name: 'Ham Sandwich',
        stage: 'development',
        class: 'menu_item',
        costing: {
          price: 400,
        },
        ingredients: [
          { type: 'ingredient', slug: 'ham', with: { unit: '30g' } }, // Changed amount
        ],
      }

      const result = await service.processor(importer, data, undefined)
      expect(result).toBe('upserted')
    })
  })
})
