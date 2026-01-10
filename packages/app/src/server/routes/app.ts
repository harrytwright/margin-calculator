import { Router } from 'express'

import {
  ConfigService,
  DashboardService,
  IngredientService,
  RecipeService,
  SupplierService,
} from '@menubook/core'
import type { ServerConfig } from '../index'

const slugifyModule = require('@sindresorhus/slugify')
const slugify = slugifyModule.default || slugifyModule

export function createAppRouter(config: ServerConfig): Router {
  const router = Router()

  // Initialize services
  const configService = new ConfigService(config.locationDir)
  const supplierService = new SupplierService(config.database)
  const ingredientService = new IngredientService(
    config.database,
    supplierService
  )
  const recipeService = new RecipeService(
    config.database,
    ingredientService,
    configService
  )
  const dashboardService = new DashboardService(
    config.database,
    recipeService,
    ingredientService,
    configService
  )

  // Helper function to render views with layout (or just content for HTMX)
  function renderView(view: string, data: any = {}) {
    return async (req: any, res: any) => {
      const isHtmx = req.headers['hx-request'] === 'true'

      if (isHtmx) {
        // For HTMX requests, return only the content area
        res.render('pages/' + view, {
          ...data,
        })
      } else {
        // For regular requests, return full layout
        res.render('layouts/main', {
          view,
          pageTitle: `${view.charAt(0).toUpperCase() + view.slice(1)} - Menu Book`,
          ...data,
        })
      }
    }
  }

  // Dashboard route
  router.get('/dashboard', async (req, res) => {
    try {
      const isHtmx = req.headers['hx-request'] === 'true'
      const stats = await dashboardService.getStatistics()

      if (isHtmx) {
        res.render('pages/dashboard', { stats })
      } else {
        res.render('layouts/main', {
          view: 'dashboard',
          pageTitle: 'Dashboard - Menu Book',
          stats,
        })
      }
    } catch (error) {
      console.error('Dashboard error:', error)
      const isHtmx = req.headers['hx-request'] === 'true'

      if (isHtmx) {
        res.render('pages/dashboard', {
          stats: null,
          error: 'Failed to load dashboard statistics',
        })
      } else {
        res.render('layouts/main', {
          view: 'dashboard',
          pageTitle: 'Dashboard - Menu Book',
          stats: null,
          error: 'Failed to load dashboard statistics',
        })
      }
    }
  })

  // Suppliers route with search support
  router.get('/suppliers', async (req, res) => {
    try {
      const search = (req.query.search as string) || ''

      let query = config.database.db.selectFrom('Supplier').selectAll()

      // Apply search filter
      if (search) {
        query = query.where((eb) =>
          eb.or([
            eb('name', 'like', `%${search}%`),
            eb('slug', 'like', `%${search}%`),
          ])
        )
      }

      const suppliers = await query.execute()

      // Get ingredient counts for all suppliers in ONE query
      const counts = await config.database.db
        .selectFrom('Ingredient')
        .select((eb) => ['supplierId', eb.fn.count('id').as('count')])
        .groupBy('supplierId')
        .execute()

      const countMap = new Map(
        counts.map((c) => [c.supplierId, Number(c.count)])
      )

      const suppliersWithCounts = suppliers.map((supplier) => ({
        ...supplier,
        ingredientCount: countMap.get(supplier.id) || 0,
      }))

      // Check if this is an HTMX request (partial update)
      const isHtmx = req.headers['hx-request'] === 'true'
      const target = req.headers['hx-target'] as string

      if (isHtmx && target === 'content-area') {
        // Navigation request - return just page content
        res.render('pages/suppliers', {
          suppliers: suppliersWithCounts,
        })
      } else if (isHtmx) {
        // Component update - return just the component
        res.render('components/supplier-list', {
          suppliers: suppliersWithCounts,
        })
      } else {
        // Initial load - return full page with layout
        res.render('layouts/main', {
          view: 'suppliers',
          pageTitle: 'Suppliers - Menu Book',
          suppliers: suppliersWithCounts,
        })
      }
    } catch (error) {
      console.error('Suppliers error:', error)
      res.status(500).send('Failed to load suppliers')
    }
  })

  // Supplier form routes
  router.get('/suppliers/new', async (req, res) => {
    try {
      res.render('components/supplier-form', {
        supplier: null,
      })
    } catch (error) {
      console.error('Supplier form error:', error)
      res.status(500).send('Failed to load form')
    }
  })

  router.get('/suppliers/:slug/edit', async (req, res) => {
    try {
      const supplier = await config.database.db
        .selectFrom('Supplier')
        .selectAll()
        .where('slug', '=', req.params.slug)
        .executeTakeFirst()

      if (!supplier) {
        return res.status(404).send('Supplier not found')
      }
      res.render('components/supplier-form', {
        supplier,
      })
    } catch (error) {
      console.error('Supplier edit form error:', error)
      res.status(500).send('Failed to load form')
    }
  })

  // Create supplier
  router.post('/suppliers', async (req, res) => {
    try {
      const { name, contactName, contactEmail, contactPhone, notes } = req.body
      const slug = slugify(name)

      await config.database.db
        .insertInto('Supplier')
        .values({
          slug,
          name,
          contactName: contactName || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          notes: notes || null,
        })
        .onConflict((oc) =>
          oc.column('slug').doUpdateSet({
            name,
            contactName: contactName || null,
            contactEmail: contactEmail || null,
            contactPhone: contactPhone || null,
            notes: notes || null,
          })
        )
        .executeTakeFirst()

      // Return updated suppliers list
      const suppliers = await config.database.db
        .selectFrom('Supplier')
        .selectAll()
        .execute()

      const counts = await config.database.db
        .selectFrom('Ingredient')
        .select((eb) => ['supplierId', eb.fn.count('id').as('count')])
        .groupBy('supplierId')
        .execute()

      const countMap = new Map(
        counts.map((c) => [c.supplierId, Number(c.count)])
      )
      const suppliersWithCounts = suppliers.map((supplier) => ({
        ...supplier,
        ingredientCount: countMap.get(supplier.id) || 0,
      }))

      res.render('components/supplier-list', {
        suppliers: suppliersWithCounts,
      })
    } catch (error) {
      console.error('Supplier create error:', error)
      res.status(500).send('Failed to create supplier')
    }
  })

  // Update supplier
  router.put('/suppliers/:slug', async (req, res) => {
    try {
      const { name, contactName, contactEmail, contactPhone, notes } = req.body

      await config.database.db
        .updateTable('Supplier')
        .set({
          name,
          contactName: contactName || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          notes: notes || null,
        })
        .where('slug', '=', req.params.slug)
        .executeTakeFirst()

      // Return updated suppliers list
      const suppliers = await config.database.db
        .selectFrom('Supplier')
        .selectAll()
        .execute()

      const counts = await config.database.db
        .selectFrom('Ingredient')
        .select((eb) => ['supplierId', eb.fn.count('id').as('count')])
        .groupBy('supplierId')
        .execute()

      const countMap = new Map(
        counts.map((c) => [c.supplierId, Number(c.count)])
      )
      const suppliersWithCounts = suppliers.map((supplier) => ({
        ...supplier,
        ingredientCount: countMap.get(supplier.id) || 0,
      }))

      res.render('components/supplier-list', {
        suppliers: suppliersWithCounts,
      })
    } catch (error) {
      console.error('Supplier update error:', error)
      res.status(500).send('Failed to update supplier')
    }
  })

  // Delete supplier
  router.delete('/suppliers/:slug', async (req, res) => {
    try {
      await config.database.db
        .deleteFrom('Supplier')
        .where('slug', '=', req.params.slug)
        .execute()

      // Return updated suppliers list
      const suppliers = await config.database.db
        .selectFrom('Supplier')
        .selectAll()
        .execute()

      const counts = await config.database.db
        .selectFrom('Ingredient')
        .select((eb) => ['supplierId', eb.fn.count('id').as('count')])
        .groupBy('supplierId')
        .execute()

      const countMap = new Map(
        counts.map((c) => [c.supplierId, Number(c.count)])
      )
      const suppliersWithCounts = suppliers.map((supplier) => ({
        ...supplier,
        ingredientCount: countMap.get(supplier.id) || 0,
      }))

      res.render('components/supplier-list', {
        suppliers: suppliersWithCounts,
      })
    } catch (error) {
      console.error('Supplier delete error:', error)
      res.status(500).send('Failed to delete supplier')
    }
  })

  // Ingredients route with search and supplier filter
  router.get('/ingredients', async (req, res) => {
    try {
      const search = (req.query.search as string) || ''
      const filterCategory = (req.query['filter-category'] as string) || ''
      const filterSupplier = (req.query['filter-supplier'] as string) || ''

      let query = config.database.db
        .selectFrom('Ingredient')
        .leftJoin('Supplier', 'Ingredient.supplierId', 'Supplier.id')
        .select([
          'Ingredient.id',
          'Ingredient.slug',
          'Ingredient.name',
          'Ingredient.category',
          'Ingredient.purchaseCost',
          'Ingredient.purchaseUnit',
          'Ingredient.includesVat',
          'Ingredient.supplierId',
          'Supplier.name as supplierName',
        ])

      // Apply search filter
      if (search) {
        query = query.where((eb) =>
          eb.or([
            eb('Ingredient.name', 'like', `%${search}%`),
            eb('Ingredient.slug', 'like', `%${search}%`),
          ])
        )
      }

      // Apply category filter
      if (filterCategory) {
        query = query.where('Ingredient.category', '=', filterCategory)
      }

      // Apply supplier filter
      if (filterSupplier) {
        query = query.where(
          'Ingredient.supplierId',
          '=',
          parseInt(filterSupplier)
        )
      }

      const ingredients = await query.execute()

      // Get unique categories and suppliers for filters
      const categories = await config.database.db
        .selectFrom('Ingredient')
        .select('category')
        .distinct()
        .execute()

      const suppliers = await config.database.db
        .selectFrom('Supplier')
        .select(['id', 'name'])
        .execute()

      const uniqueCategories = categories
        .map((r) => r.category)
        .filter((c): c is string => c !== null)
        .sort()

      // Check if this is an HTMX request (partial update)
      const isHtmx = req.headers['hx-request'] === 'true'
      const target = req.headers['hx-target'] as string

      if (isHtmx && target === 'content-area') {
        // Navigation request - return just page content
        res.render('pages/ingredients', {
          ingredients,
          categories: uniqueCategories,
          suppliers,
        })
      } else if (isHtmx) {
        // Component update - return just the component
        res.render('components/ingredient-list', { ingredients })
      } else {
        // Initial load - return full page with layout
        res.render('layouts/main', {
          view: 'ingredients',
          pageTitle: 'Ingredients - Menu Book',
          ingredients,
          categories: uniqueCategories,
          suppliers,
        })
      }
    } catch (error) {
      console.error('Ingredients error:', error)
      res.status(500).send('Failed to load ingredients')
    }
  })

  // Ingredient form routes
  router.get('/ingredients/new', async (req, res) => {
    try {
      const suppliers = await config.database.db
        .selectFrom('Supplier')
        .select(['id', 'name'])
        .execute()

      res.render('components/ingredient-form', {
        ingredient: null,
        suppliers,
      })
    } catch (error) {
      console.error('Ingredient form error:', error)
      res.status(500).send('Failed to load form')
    }
  })

  router.get('/ingredients/:slug/edit', async (req, res) => {
    try {
      const ingredient = await config.database.db
        .selectFrom('Ingredient')
        .selectAll()
        .where('slug', '=', req.params.slug)
        .executeTakeFirst()

      if (!ingredient) {
        return res.status(404).send('Ingredient not found')
      }

      const suppliers = await config.database.db
        .selectFrom('Supplier')
        .select(['id', 'name'])
        .execute()

      res.render('components/ingredient-form', {
        ingredient,
        suppliers,
      })
    } catch (error) {
      console.error('Ingredient edit form error:', error)
      res.status(500).send('Failed to load form')
    }
  })

  // Create ingredient
  router.post('/ingredients', async (req, res) => {
    try {
      const {
        name,
        category,
        supplierId,
        purchaseCost,
        purchaseUnit,
        includesVat,
        conversionRule,
        notes,
      } = req.body
      const slug = slugify(name)

      await config.database.db
        .insertInto('Ingredient')
        .values({
          slug,
          name,
          category,
          supplierId: Number(supplierId),
          purchaseCost: Number(purchaseCost),
          purchaseUnit,
          includesVat: includesVat === '1' ? 1 : 0,
          conversionRule: conversionRule || null,
          notes: notes || null,
          lastPurchased: null,
        })
        .onConflict((oc) =>
          oc.column('slug').doUpdateSet({
            name,
            category,
            purchaseCost: Number(purchaseCost),
            purchaseUnit,
            includesVat: includesVat === '1' ? 1 : 0,
            conversionRule: conversionRule || null,
            notes: notes || null,
          })
        )
        .executeTakeFirst()

      // Return updated ingredients list
      const ingredients = await config.database.db
        .selectFrom('Ingredient')
        .leftJoin('Supplier', 'Ingredient.supplierId', 'Supplier.id')
        .select([
          'Ingredient.id',
          'Ingredient.slug',
          'Ingredient.name',
          'Ingredient.category',
          'Ingredient.purchaseCost',
          'Ingredient.purchaseUnit',
          'Ingredient.includesVat',
          'Ingredient.supplierId',
          'Supplier.name as supplierName',
        ])
        .execute()

      res.render('components/ingredient-list', { ingredients })
    } catch (error) {
      console.error('Ingredient create error:', error)
      res.status(500).send('Failed to create ingredient')
    }
  })

  // Update ingredient
  router.put('/ingredients/:slug', async (req, res) => {
    try {
      const {
        name,
        category,
        purchaseCost,
        purchaseUnit,
        includesVat,
        conversionRule,
        notes,
      } = req.body

      await config.database.db
        .updateTable('Ingredient')
        .set({
          name,
          category,
          purchaseCost: Number(purchaseCost),
          purchaseUnit,
          includesVat: includesVat === '1' ? 1 : 0,
          conversionRule: conversionRule || null,
          notes: notes || null,
        })
        .where('slug', '=', req.params.slug)
        .executeTakeFirst()

      // Return updated ingredients list
      const ingredients = await config.database.db
        .selectFrom('Ingredient')
        .leftJoin('Supplier', 'Ingredient.supplierId', 'Supplier.id')
        .select([
          'Ingredient.id',
          'Ingredient.slug',
          'Ingredient.name',
          'Ingredient.category',
          'Ingredient.purchaseCost',
          'Ingredient.purchaseUnit',
          'Ingredient.includesVat',
          'Ingredient.supplierId',
          'Supplier.name as supplierName',
        ])
        .execute()

      res.render('components/ingredient-list', { ingredients })
    } catch (error) {
      console.error('Ingredient update error:', error)
      res.status(500).send('Failed to update ingredient')
    }
  })

  // Delete ingredient
  router.delete('/ingredients/:slug', async (req, res) => {
    try {
      await config.database.db
        .deleteFrom('Ingredient')
        .where('slug', '=', req.params.slug)
        .execute()

      // Return updated ingredients list
      const ingredients = await config.database.db
        .selectFrom('Ingredient')
        .leftJoin('Supplier', 'Ingredient.supplierId', 'Supplier.id')
        .select([
          'Ingredient.id',
          'Ingredient.slug',
          'Ingredient.name',
          'Ingredient.category',
          'Ingredient.purchaseCost',
          'Ingredient.purchaseUnit',
          'Ingredient.includesVat',
          'Ingredient.supplierId',
          'Supplier.name as supplierName',
        ])
        .execute()

      res.render('components/ingredient-list', { ingredients })
    } catch (error) {
      console.error('Ingredient delete error:', error)
      res.status(500).send('Failed to delete ingredient')
    }
  })

  // Recipes route with search/filter support
  router.get('/recipes', async (req, res) => {
    try {
      const search = (req.query.search as string) || ''
      const filterClass = (req.query['filter-class'] as string) || ''
      const filterCategory = (req.query['filter-category'] as string) || ''

      let query = config.database.db.selectFrom('Recipe').selectAll()

      // Apply search filter
      if (search) {
        query = query.where((eb) =>
          eb.or([
            eb('name', 'like', `%${search}%`),
            eb('slug', 'like', `%${search}%`),
          ])
        )
      }

      // Apply class filter
      if (
        filterClass &&
        (filterClass === 'menu_item' ||
          filterClass === 'base_template' ||
          filterClass === 'sub_recipe')
      ) {
        query = query.where('class', '=', filterClass as any)
      }

      // Apply category filter
      if (filterCategory) {
        query = query.where('category', '=', filterCategory)
      }

      const recipes = await query.execute()

      // Get unique categories for filter dropdown
      const allRecipes = await config.database.db
        .selectFrom('Recipe')
        .select('category')
        .distinct()
        .execute()
      const categories = allRecipes
        .map((r) => r.category)
        .filter((c): c is string => c !== null)
        .sort()

      // Check if this is an HTMX request (partial update)
      const isHtmx = req.headers['hx-request'] === 'true'
      const target = req.headers['hx-target'] as string

      if (isHtmx && target === 'content-area') {
        // Navigation request - return just page content
        res.render('pages/recipes', {
          recipes,
          categories,
        })
      } else if (isHtmx) {
        // Component update - return just the component
        res.render('components/recipe-list', { recipes })
      } else {
        // Initial load - return full page with layout
        res.render('layouts/main', {
          view: 'recipes',
          pageTitle: 'Recipes - Menu Book',
          recipes,
          categories,
        })
      }
    } catch (error) {
      console.error('Recipes error:', error)
      res.status(500).send('Failed to load recipes')
    }
  })

  // Recipe form routes
  router.get('/recipes/new', async (req, res) => {
    try {
      res.render('components/recipe-form', {
        recipe: null,
      })
    } catch (error) {
      console.error('Recipe form error:', error)
      res.status(500).send('Failed to load form')
    }
  })

  router.get('/recipes/:slug/edit', async (req, res) => {
    try {
      const recipe = await config.database.db
        .selectFrom('Recipe')
        .selectAll()
        .where('slug', '=', req.params.slug)
        .executeTakeFirst()

      if (!recipe) {
        return res.status(404).send('Recipe not found')
      }

      res.render('components/recipe-form', {
        recipe,
      })
    } catch (error) {
      console.error('Recipe edit form error:', error)
      res.status(500).send('Failed to load form')
    }
  })

  // Create recipe
  router.post('/recipes', async (req, res) => {
    try {
      const {
        name,
        category,
        class: recipeClass,
        sellPrice,
        targetMargin,
        includesVat,
        stage,
        yieldAmount,
        yieldUnit,
      } = req.body
      const slug = slugify(name)

      await config.database.db
        .insertInto('Recipe')
        .values({
          slug,
          name,
          category: category || null,
          class: recipeClass || 'menu_item',
          sellPrice: Number(sellPrice),
          targetMargin: targetMargin ? Number(targetMargin) : undefined,
          includesVat: includesVat === '1' ? 1 : 0,
          stage: stage || 'active',
          yieldAmount: yieldAmount ? Number(yieldAmount) : undefined,
          yieldUnit: yieldUnit || null,
          parentId: null,
        })
        .onConflict((oc) =>
          oc.column('slug').doUpdateSet({
            name,
            category: category || null,
            class: recipeClass || 'menu_item',
            sellPrice: Number(sellPrice),
            targetMargin: targetMargin ? Number(targetMargin) : undefined,
            includesVat: includesVat === '1' ? 1 : 0,
            stage: stage || 'active',
            yieldAmount: yieldAmount ? Number(yieldAmount) : undefined,
            yieldUnit: yieldUnit || null,
          })
        )
        .executeTakeFirst()

      // Return updated recipes list
      const recipes = await config.database.db
        .selectFrom('Recipe')
        .selectAll()
        .execute()

      res.render('components/recipe-list', { recipes })
    } catch (error) {
      console.error('Recipe create error:', error)
      res.status(500).send('Failed to create recipe')
    }
  })

  // Update recipe
  router.put('/recipes/:slug', async (req, res) => {
    try {
      const {
        name,
        category,
        class: recipeClass,
        sellPrice,
        targetMargin,
        includesVat,
        stage,
        yieldAmount,
        yieldUnit,
      } = req.body

      await config.database.db
        .updateTable('Recipe')
        .set({
          name,
          category: category || null,
          class: recipeClass || 'menu_item',
          sellPrice: Number(sellPrice),
          targetMargin: targetMargin ? Number(targetMargin) : undefined,
          includesVat: includesVat === '1' ? 1 : 0,
          stage: stage || 'active',
          yieldAmount: yieldAmount ? Number(yieldAmount) : undefined,
          yieldUnit: yieldUnit || null,
        })
        .where('slug', '=', req.params.slug)
        .executeTakeFirst()

      // Return updated recipes list
      const recipes = await config.database.db
        .selectFrom('Recipe')
        .selectAll()
        .execute()

      res.render('components/recipe-list', { recipes })
    } catch (error) {
      console.error('Recipe update error:', error)
      res.status(500).send('Failed to update recipe')
    }
  })

  // Delete recipe
  router.delete('/recipes/:slug', async (req, res) => {
    try {
      await config.database.db
        .deleteFrom('Recipe')
        .where('slug', '=', req.params.slug)
        .execute()

      // Return updated recipes list
      const recipes = await config.database.db
        .selectFrom('Recipe')
        .selectAll()
        .execute()

      res.render('components/recipe-list', { recipes })
    } catch (error) {
      console.error('Recipe delete error:', error)
      res.status(500).send('Failed to delete recipe')
    }
  })

  // Margins route
  router.get('/margins', renderView('margins'))

  // Settings route
  router.get('/settings', renderView('settings'))

  // Help route
  router.get('/help', renderView('help'))

  // Default redirect to dashboard
  router.get('/', (_req, res) => {
    res.redirect('/app/dashboard')
  })

  return router
}
