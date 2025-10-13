import { Router } from 'express'
import { Calculator } from '../../lib/calculation/calculator'
import { ConfigService } from '../../services/config'
import { IngredientService } from '../../services/ingredient'
import { RecipeService } from '../../services/recipe'
import { SupplierService } from '../../services/supplier'
import type { ServerConfig } from '../index'

export function createApiRouter(config: ServerConfig): Router {
  const router = Router()

  // Initialize services
  const supplier = new SupplierService(config.database)
  const ingredient = new IngredientService(config.database, supplier)
  const recipeService = new RecipeService(config.database, ingredient)
  const configService = new ConfigService(config.workingDir)
  const calculator = new Calculator(recipeService, ingredient, configService)

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
