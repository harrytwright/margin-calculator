import { Router, type Response } from 'express'
import { ZodError } from 'zod'

import { Calculator } from '../../lib/calculation/calculator'
import {
  ingredientImportDataSchema,
  recipeImportDataSchema,
  supplierImportDataSchema,
} from '../../schema'
import { ConfigService } from '../../services/config'
import { IngredientService } from '../../services/ingredient'
import { RecipeService } from '../../services/recipe'
import { SupplierService } from '../../services/supplier'
import type { ServerConfig } from '../index'
import { EntityPersistence } from '../services/entity-persistence'
import { HttpError } from '../utils/http-error'

export function createApiRouter(config: ServerConfig): Router {
  const router = Router()

  // Initialize services
  const supplier = new SupplierService(config.database)
  const ingredient = new IngredientService(config.database, supplier)
  const recipeService = new RecipeService(config.database, ingredient)
  const configService = new ConfigService(config.workingDir)
  const calculator = new Calculator(recipeService, ingredient, configService)
  const persistence = new EntityPersistence(config, {
    supplier,
    ingredient,
    recipe: recipeService,
  })

  router.get('/suppliers', async (_req, res) => {
    try {
      const suppliers = await config.database
        .selectFrom('Supplier')
        .select(['slug', 'name'])
        .orderBy('name')
        .execute()

      res.json(suppliers)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  router.get('/suppliers/:slug', async (req, res) => {
    try {
      const record = await supplier.findById(req.params.slug)
      if (!record) {
        return res.status(404).json({ error: 'Supplier not found' })
      }

      res.json({ slug: req.params.slug, ...record })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  router.get('/ingredients', async (_req, res) => {
    try {
      const ingredients = await config.database
        .selectFrom('Ingredient')
        .leftJoin('Supplier', 'Ingredient.supplierId', 'Supplier.id')
        .select((eb) => [
          eb.ref('Ingredient.slug').as('slug'),
          eb.ref('Ingredient.name').as('name'),
          eb.ref('Ingredient.category').as('category'),
          eb.ref('Supplier.slug').as('supplierSlug'),
        ])
        .orderBy('Ingredient.name')
        .execute()

      res.json(ingredients)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  router.get('/ingredients/:slug', async (req, res) => {
    try {
      const record = await ingredient.findById(req.params.slug)
      if (!record) {
        return res.status(404).json({ error: 'Ingredient not found' })
      }

      res.json({
        slug: req.params.slug,
        name: record.name,
        category: record.category,
        purchase: {
          unit: record.purchaseUnit,
          cost: record.purchaseCost,
          vat: record.includesVat === 1,
        },
        supplierSlug: record.supplierSlug,
        conversionRate: record.conversionRule || '',
        notes: record.notes || '',
        lastPurchased: record.lastPurchased,
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  router.post('/suppliers', async (req, res) => {
    try {
      const parsed = supplierImportDataSchema.parse(req.body)
      const record = await persistence.createSupplier(parsed)
      res.status(201).json(record)
    } catch (error) {
      handleError(res, error)
    }
  })

  router.post('/ingredients', async (req, res) => {
    try {
      const parsed = ingredientImportDataSchema.parse(req.body)
      const record = await persistence.createIngredient(parsed)
      res.status(201).json(record)
    } catch (error) {
      handleError(res, error)
    }
  })

  router.post('/recipes', async (req, res) => {
    try {
      const parsed = recipeImportDataSchema.parse(req.body)
      const record = await persistence.createRecipe(parsed)
      res.status(201).json(record)
    } catch (error) {
      handleError(res, error)
    }
  })

  router.put('/suppliers/:slug', async (req, res) => {
    try {
      const parsed = supplierImportDataSchema.parse(req.body)
      const record = await persistence.updateSupplier(req.params.slug, parsed)
      res.json(record)
    } catch (error) {
      handleError(res, error)
    }
  })

  router.put('/ingredients/:slug', async (req, res) => {
    try {
      const parsed = ingredientImportDataSchema.parse(req.body)
      const record = await persistence.updateIngredient(req.params.slug, parsed)
      res.json(record)
    } catch (error) {
      handleError(res, error)
    }
  })

  router.put('/recipes/:slug', async (req, res) => {
    try {
      const parsed = recipeImportDataSchema.parse(req.body)
      const record = await persistence.updateRecipe(req.params.slug, parsed)
      res.json(record)
    } catch (error) {
      handleError(res, error)
    }
  })

  router.delete('/suppliers/:slug', async (req, res) => {
    try {
      await persistence.deleteSupplier(req.params.slug)
      res.status(204).send()
    } catch (error) {
      handleError(res, error)
    }
  })

  router.delete('/ingredients/:slug', async (req, res) => {
    try {
      await persistence.deleteIngredient(req.params.slug)
      res.status(204).send()
    } catch (error) {
      handleError(res, error)
    }
  })

  router.delete('/recipes/:slug', async (req, res) => {
    try {
      await persistence.deleteRecipe(req.params.slug)
      res.status(204).send()
    } catch (error) {
      handleError(res, error)
    }
  })

  // GET /api/recipes - List all recipes
  router.get('/recipes', async (req, res) => {
    try {
      const recipes = await config.database
        .selectFrom('Recipe')
        .select([
          'id',
          'slug',
          'name',
          'class',
          'category',
          'sellPrice',
          'targetMargin',
        ])
        .execute()

      res.json(recipes)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // GET /api/recipes/:slug - Get recipe details
  router.get('/recipes/:slug', async (req, res) => {
    try {
      const recipe = await recipeService.findById(req.params.slug)

      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' })
      }

      res.json(recipe)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // GET /api/recipes/:slug/calculate - Calculate cost and margin
  router.get('/recipes/:slug/calculate', async (req, res) => {
    try {
      const cost = await calculator.cost(req.params.slug)
      const margin = await calculator.margin(cost)

      res.json({
        recipe: cost.recipe,
        cost: {
          total: margin.cost,
          breakdown: cost.tree,
        },
        margin: {
          sellPrice: margin.sellPrice,
          customerPrice: margin.customerPrice,
          vatAmount: margin.vatAmount,
          profit: margin.profit,
          actualMargin: margin.actualMargin,
          targetMargin: margin.targetMargin,
          meetsTarget: margin.meetsTarget,
          vatApplicable: margin.vatApplicable,
        },
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // GET /api/report - Calculate all recipes
  router.get('/report', async (req, res) => {
    try {
      const allRecipes = await config.database
        .selectFrom('Recipe')
        .select('slug')
        .execute()

      const results = []

      for (const { slug } of allRecipes) {
        try {
          const cost = await calculator.cost(slug)
          const margin = await calculator.margin(cost)

          results.push({
            slug,
            name: cost.recipe.name,
            success: true,
            cost: margin.cost,
            margin: {
              sellPrice: margin.sellPrice,
              actualMargin: margin.actualMargin,
              targetMargin: margin.targetMargin,
              meetsTarget: margin.meetsTarget,
            },
          })
        } catch (error: any) {
          results.push({
            slug,
            success: false,
            error: error.message,
          })
        }
      }

      res.json(results)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  return router
}

function handleError(res: Response, error: unknown) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: error.message,
      details: error.details,
    })
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.issues,
    })
  }

  if (error instanceof Error) {
    return res.status(500).json({ error: error.message })
  }

  return res.status(500).json({ error: 'Unknown error' })
}
