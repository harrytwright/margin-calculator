import { Router, type Response } from 'express'
import { ZodError } from 'zod'

import {
  Calculator,
  ConfigService,
  DatabaseOnlyStorage,
  ExportService,
  FileSystemStorage,
  ingredientImportDataSchema,
  IngredientService,
  recipeImportDataSchema,
  RecipeService,
  supplierImportDataSchema,
  SupplierService,
} from '@menubook/core'
import type { ServerConfig } from '../index'
import { EntityPersistence } from '../services/entity-persistence'
import { HttpError } from '../utils/http-error'
import { ValidationException, Validator } from '../utils/validation'

export function createApiRouter(config: ServerConfig): Router {
  const router = Router()

  // Initialize services
  const configService = new ConfigService(config.locationDir)
  const supplier = new SupplierService(config.database)
  const ingredient = new IngredientService(config.database, supplier)
  const recipeService = new RecipeService(
    config.database,
    ingredient,
    configService
  )
  const calculator = new Calculator(recipeService, ingredient, configService)
  const exportService = new ExportService(
    config.database,
    supplier,
    ingredient,
    recipeService,
    calculator
  )

  // Initialize storage service based on mode
  const storageMode = config.storageMode || 'fs'
  const storage =
    storageMode === 'database-only'
      ? new DatabaseOnlyStorage()
      : new FileSystemStorage()

  const persistence = new EntityPersistence(
    config,
    {
      supplier,
      ingredient,
      recipe: recipeService,
    },
    storage
  )
  const validator = new Validator(config.database.db)

  router.get('/suppliers', async (_req, res) => {
    try {
      const suppliers = await config.database.db
        .selectFrom('Supplier')
        .select(['slug', 'name'])
        .orderBy('name')
        .execute()

      res.json(suppliers)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  router.get('/events', (req, res) => {
    if (!config.events) {
      return res.status(503).json({ error: 'Event stream not available' })
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()
    res.write(': connected\n\n')

    const sendEvent = (payload: unknown) => {
      res.write(`event: entity\ndata: ${JSON.stringify(payload)}\n\n`)
    }

    const keepAlive = setInterval(() => {
      res.write(': keep-alive\n\n')
    }, 30000)

    config.events.on('entity', sendEvent)

    req.on('close', () => {
      clearInterval(keepAlive)
      config.events?.off('entity', sendEvent)
    })
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
      const ingredients = await config.database.db
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

      // Validate supplier exists if provided
      if (parsed.supplier?.uses) {
        const supplierSlug = parsed.supplier.uses.replace('slug:', '')
        if (!(await validator.supplierExists(supplierSlug))) {
          validator.fail([
            {
              field: 'supplier',
              message: `Supplier '${supplierSlug}' not found. Please create the supplier first.`,
            },
          ])
        }
      }

      // Validate purchase cost is positive
      if (!validator.isPositiveNumber(parsed.purchase.cost)) {
        validator.fail([
          {
            field: 'purchase.cost',
            message: 'Purchase cost must be greater than 0',
          },
        ])
      }

      const record = await persistence.createIngredient(parsed)
      res.status(201).json(record)
    } catch (error) {
      handleError(res, error)
    }
  })

  router.post('/recipes', async (req, res) => {
    try {
      const parsed = recipeImportDataSchema.parse(req.body)

      // Validate price is positive
      if (
        parsed.costing?.price &&
        !validator.isPositiveNumber(parsed.costing.price)
      ) {
        validator.fail([
          {
            field: 'costing.price',
            message: 'Price must be greater than 0',
          },
        ])
      }

      // Validate margin is in range 0-100
      if (
        parsed.costing?.margin !== undefined &&
        !validator.isInRange(parsed.costing.margin, 0, 100)
      ) {
        validator.fail([
          {
            field: 'costing.margin',
            message: 'Target margin must be between 0 and 100',
          },
        ])
      }

      // Validate all ingredients exist
      if (parsed.ingredients && parsed.ingredients.length > 0) {
        const errors = []
        for (const ing of parsed.ingredients) {
          const slug = ing.uses.replace(/^(slug:|ref:@\/)/, '')
          const exists =
            ing.type === 'ingredient'
              ? await validator.ingredientExists(slug)
              : await validator.recipeExists(slug)

          if (!exists) {
            errors.push({
              field: 'ingredients',
              message: `${ing.type === 'ingredient' ? 'Ingredient' : 'Recipe'} '${slug}' not found. Please create it first.`,
            })
          }
        }
        if (errors.length > 0) {
          validator.fail(errors)
        }
      }

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

      // Check if supplier is being changed (immutable field)
      const existing = await ingredient.findById(req.params.slug)
      if (existing && parsed.supplier?.uses) {
        const newSupplierSlug = parsed.supplier.uses.replace('slug:', '')
        if (existing.supplierSlug !== newSupplierSlug) {
          validator.fail([
            {
              field: 'supplier',
              message: `Cannot change supplier from '${existing.supplierSlug}' to '${newSupplierSlug}'. Supplier is immutable after creation.`,
            },
          ])
        }
      }

      // Validate supplier exists if provided
      if (parsed.supplier?.uses) {
        const supplierSlug = parsed.supplier.uses.replace('slug:', '')
        if (!(await validator.supplierExists(supplierSlug))) {
          validator.fail([
            {
              field: 'supplier',
              message: `Supplier '${supplierSlug}' not found. Please create the supplier first.`,
            },
          ])
        }
      }

      // Validate purchase cost is positive
      if (!validator.isPositiveNumber(parsed.purchase.cost)) {
        validator.fail([
          {
            field: 'purchase.cost',
            message: 'Purchase cost must be greater than 0',
          },
        ])
      }

      const record = await persistence.updateIngredient(req.params.slug, parsed)
      res.json(record)
    } catch (error) {
      handleError(res, error)
    }
  })

  router.put('/recipes/:slug', async (req, res) => {
    try {
      const parsed = recipeImportDataSchema.parse(req.body)

      // Validate price is positive
      if (
        parsed.costing?.price &&
        !validator.isPositiveNumber(parsed.costing.price)
      ) {
        validator.fail([
          {
            field: 'costing.price',
            message: 'Price must be greater than 0',
          },
        ])
      }

      // Validate margin is in range 0-100
      if (
        parsed.costing?.margin !== undefined &&
        !validator.isInRange(parsed.costing.margin, 0, 100)
      ) {
        validator.fail([
          {
            field: 'costing.margin',
            message: 'Target margin must be between 0 and 100',
          },
        ])
      }

      // Validate all ingredients exist
      if (parsed.ingredients && parsed.ingredients.length > 0) {
        const errors = []
        for (const ing of parsed.ingredients) {
          const slug = ing.uses.replace(/^(slug:|ref:@\/)/, '')
          const exists =
            ing.type === 'ingredient'
              ? await validator.ingredientExists(slug)
              : await validator.recipeExists(slug)

          if (!exists) {
            errors.push({
              field: 'ingredients',
              message: `${ing.type === 'ingredient' ? 'Ingredient' : 'Recipe'} '${slug}' not found. Please create it first.`,
            })
          }
        }
        if (errors.length > 0) {
          validator.fail(errors)
        }
      }

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
      const recipes = await config.database.db
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
      const allRecipes = await config.database.db
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

  // Settings endpoints
  router.get('/settings', async (_req, res) => {
    try {
      const settings = await configService.getAll()
      res.json(settings)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  router.put('/settings', async (req, res) => {
    try {
      const updates = req.body

      // Validate input
      if (updates.vat !== undefined) {
        const vat = Number(updates.vat)
        if (isNaN(vat) || vat < 0 || vat > 1) {
          return res.status(400).json({
            error: 'VAT rate must be a number between 0 and 1',
          })
        }
        updates.vat = vat
      }

      if (updates.marginTarget !== undefined) {
        const margin = Number(updates.marginTarget)
        if (isNaN(margin) || margin < 0 || margin > 100) {
          return res.status(400).json({
            error: 'Margin target must be a number between 0 and 100',
          })
        }
        updates.marginTarget = margin
      }

      if (updates.defaultPriceIncludesVat !== undefined) {
        if (typeof updates.defaultPriceIncludesVat !== 'boolean') {
          return res.status(400).json({
            error: 'defaultPriceIncludesVat must be a boolean',
          })
        }
      }

      const updated = await configService.update(updates)
      res.json(updated)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Export endpoints

  // Export single recipe
  router.get('/export/recipe/:slug', async (req, res) => {
    try {
      const slug = req.params.slug
      const includeDependencies = req.query.dependencies === 'true'

      const result = await exportService.exportRecipe(slug, {
        includeDependencies,
      })

      if (typeof result === 'string') {
        // Single file export
        res.setHeader('Content-Type', 'text/yaml')
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${slug}.yaml"`
        )
        res.send(result)
      } else {
        // Multi-file export with dependencies (will be handled by ZIP endpoint)
        res.status(400).json({
          error:
            'Use /export/recipe/:slug/zip endpoint for exports with dependencies',
        })
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Export single ingredient
  router.get('/export/ingredient/:slug', async (req, res) => {
    try {
      const slug = req.params.slug
      const result = await exportService.exportIngredient(slug, {
        includeDependencies: false,
      })

      res.setHeader('Content-Type', 'text/yaml')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${slug}.yaml"`
      )
      res.send(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Export single supplier
  router.get('/export/supplier/:slug', async (req, res) => {
    try {
      const slug = req.params.slug
      const result = await exportService.exportSupplier(slug)

      res.setHeader('Content-Type', 'text/yaml')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${slug}.yaml"`
      )
      res.send(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Bulk export all recipes
  router.get('/export/recipes', async (_req, res) => {
    try {
      const yaml = await exportService.exportAllRecipes()

      res.setHeader('Content-Type', 'text/yaml')
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="recipes.yaml"'
      )
      res.send(yaml)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Bulk export all ingredients
  router.get('/export/ingredients', async (_req, res) => {
    try {
      const yaml = await exportService.exportAllIngredients()

      res.setHeader('Content-Type', 'text/yaml')
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="ingredients.yaml"'
      )
      res.send(yaml)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Bulk export all suppliers
  router.get('/export/suppliers', async (_req, res) => {
    try {
      const yaml = await exportService.exportAllSuppliers()

      res.setHeader('Content-Type', 'text/yaml')
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="suppliers.yaml"'
      )
      res.send(yaml)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // ZIP export endpoints
  router.get('/export/recipe/:slug/zip', async (req, res) => {
    try {
      const slug = req.params.slug
      const archiver = require('archiver')

      const result = await exportService.exportRecipe(slug, {
        includeDependencies: true,
      })

      if (typeof result === 'string') {
        return res
          .status(400)
          .json({ error: 'Recipe has no dependencies to export' })
      }

      const archive = archiver('zip', { zlib: { level: 9 } })

      res.setHeader('Content-Type', 'application/zip')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${slug}-with-dependencies.zip"`
      )

      archive.pipe(res)

      // Add all files to the archive
      for (const [path, content] of result.files) {
        archive.append(content, { name: path })
      }

      await archive.finalize()
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Export complete dataset as ZIP
  router.get('/export/all', async (_req, res) => {
    try {
      const archiver = require('archiver')

      const result = await exportService.exportAll()

      const archive = archiver('zip', { zlib: { level: 9 } })

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      res.setHeader('Content-Type', 'application/zip')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="margin-data-${timestamp}.zip"`
      )

      archive.pipe(res)

      // Add all files to the archive
      for (const [path, content] of result.files) {
        archive.append(content, { name: path })
      }

      await archive.finalize()
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // CSV export endpoints
  router.get('/export/csv/suppliers', async (_req, res) => {
    try {
      const csv = await exportService.exportSuppliersCSV()

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="suppliers.csv"'
      )
      res.send(csv)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  router.get('/export/csv/ingredients', async (_req, res) => {
    try {
      const csv = await exportService.exportIngredientsCSV()

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="ingredients.csv"'
      )
      res.send(csv)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  router.get('/export/csv/recipes', async (_req, res) => {
    try {
      const csv = await exportService.exportRecipesCSV()

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename="recipes.csv"')
      res.send(csv)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  router.get('/export/csv/recipes-with-costs', async (_req, res) => {
    try {
      const csv = await exportService.exportRecipesWithCostsCSV()

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="recipes-with-costs.csv"'
      )
      res.send(csv)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Database backup endpoint
  router.get('/backup/database', async (_req, res) => {
    try {
      const fs = require('fs')
      const path = require('path')

      // Get the database file path from config
      const dbPath = path.join(config.locationDir, 'margin.sqlite3')

      // Check if file exists
      if (!fs.existsSync(dbPath)) {
        return res.status(404).json({ error: 'Database file not found' })
      }

      // Get file stats for size
      const stats = fs.statSync(dbPath)

      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupFilename = `margin-backup-${timestamp}.sqlite3`

      res.setHeader('Content-Type', 'application/x-sqlite3')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${backupFilename}"`
      )
      res.setHeader('Content-Length', stats.size)

      // Stream the file
      const fileStream = fs.createReadStream(dbPath)
      fileStream.pipe(res)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  return router
}

function handleError(res: Response, error: unknown) {
  if (error instanceof ValidationException) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.errors,
    })
  }

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
