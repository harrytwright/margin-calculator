import { Router, Request, Response } from 'express'

import {
  Calculator,
  ConfigService,
  DashboardService,
  IngredientService,
  RecipeService,
  SupplierService,
} from '@menubook/core'
import type { ServerConfig } from '../index'
import { isDemoEnabled } from '../middleware/demo'

const slugifyModule = require('@sindresorhus/slugify')
const slugify = slugifyModule.default || slugifyModule

type EntityType = 'suppliers' | 'ingredients' | 'recipes'

const VALID_TYPES: EntityType[] = ['suppliers', 'ingredients', 'recipes']

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

  // Helper to get database - uses demo database if available
  function getDatabase(req: Request) {
    return req.demoDatabase || config.database
  }

  // Helper to render page or partial based on HTMX request
  function render(
    res: Response,
    req: Request,
    view: string,
    pageTitle: string,
    data: Record<string, any> = {}
  ) {
    const isHtmx = req.headers['hx-request'] === 'true'
    const target = req.headers['hx-target'] as string

    if (isHtmx && target === 'content-area') {
      // Navigation request - return content area with header and main
      res.render('partials/content-area', { view, ...data })
    } else if (isHtmx) {
      // Component update - return just the component
      const component = data._component || view
      res.render(`components/${component}`, data)
    } else {
      // Full page load
      res.render('layouts/main', {
        view,
        pageTitle,
        isDemo: isDemoEnabled(),
        ...data,
      })
    }
  }

  // ============================================
  // Root redirect
  // ============================================
  router.get('/', (_req, res) => {
    res.redirect('/management/suppliers')
  })

  // ============================================
  // Dashboard (optional - redirect to management)
  // ============================================
  router.get('/dashboard', async (req, res) => {
    try {
      const db = getDatabase(req)
      const stats = await new DashboardService(
        db,
        new RecipeService(
          db,
          new IngredientService(db, new SupplierService(db)),
          configService
        ),
        new IngredientService(db, new SupplierService(db)),
        configService
      ).getStatistics()

      render(res, req, 'dashboard', 'Dashboard - Menu Book', { stats })
    } catch (error) {
      console.error('Dashboard error:', error)
      render(res, req, 'dashboard', 'Dashboard - Menu Book', {
        stats: null,
        error: 'Failed to load dashboard statistics',
      })
    }
  })

  // ============================================
  // Management routes - /management/:type
  // ============================================

  // List view
  router.get('/management/:type', async (req, res) => {
    const type = req.params.type as EntityType

    if (!VALID_TYPES.includes(type)) {
      return res.status(404).send('Invalid entity type')
    }

    try {
      const db = getDatabase(req)
      const search = (req.query.search as string) || ''
      const data: Record<string, any> = { type, search }

      switch (type) {
        case 'suppliers':
          data.items = await getSuppliers(db, search)
          break
        case 'ingredients':
          const filterCategory = (req.query['filter-category'] as string) || ''
          const filterSupplier = (req.query['filter-supplier'] as string) || ''
          data.items = await getIngredients(db, search, filterCategory, filterSupplier)
          data.categories = await getIngredientCategories(db)
          data.suppliers = await getAllSuppliers(db)
          data.filterCategory = filterCategory
          data.filterSupplier = filterSupplier
          break
        case 'recipes':
          const filterClass = (req.query['filter-class'] as string) || ''
          const filterRecipeCategory = (req.query['filter-category'] as string) || ''
          data.items = await getRecipes(db, search, filterClass, filterRecipeCategory)
          data.categories = await getRecipeCategories(db)
          data.filterClass = filterClass
          data.filterCategory = filterRecipeCategory
          break
      }

      const isHtmx = req.headers['hx-request'] === 'true'
      const target = req.headers['hx-target'] as string

      if (isHtmx && target === 'entity-list') {
        // Just update the list component
        res.render(`components/${type.slice(0, -1)}-list`, {
          [type]: data.items,
          ...(type === 'suppliers' ? { suppliers: data.items } : {}),
          ...(type === 'ingredients' ? { ingredients: data.items } : {}),
          ...(type === 'recipes' ? { recipes: data.items } : {}),
        })
      } else {
        render(res, req, 'management', `${capitalize(type)} - Menu Book`, data)
      }
    } catch (error) {
      console.error(`${type} error:`, error)
      res.status(500).send(`Failed to load ${type}`)
    }
  })

  // New form
  router.get('/management/:type/new', async (req, res) => {
    const type = req.params.type as EntityType

    if (!VALID_TYPES.includes(type)) {
      return res.status(404).send('Invalid entity type')
    }

    try {
      const db = getDatabase(req)
      const data: Record<string, any> = { type }

      if (type === 'ingredients') {
        data.suppliers = await getAllSuppliers(db)
      }

      res.render(`components/${type.slice(0, -1)}-form`, {
        [type.slice(0, -1)]: null,
        ...data,
      })
    } catch (error) {
      console.error(`${type} form error:`, error)
      res.status(500).send('Failed to load form')
    }
  })

  // Edit form
  router.get('/management/:type/:slug/edit', async (req, res) => {
    const type = req.params.type as EntityType
    const { slug } = req.params

    if (!VALID_TYPES.includes(type)) {
      return res.status(404).send('Invalid entity type')
    }

    try {
      const db = getDatabase(req)
      const tableName = getTableName(type)
      const item = await db.db
        .selectFrom(tableName as any)
        .selectAll()
        .where('slug', '=', slug)
        .executeTakeFirst()

      if (!item) {
        return res.status(404).send(`${capitalize(type.slice(0, -1))} not found`)
      }

      const data: Record<string, any> = { type }
      if (type === 'ingredients') {
        data.suppliers = await getAllSuppliers(db)
      }

      res.render(`components/${type.slice(0, -1)}-form`, {
        [type.slice(0, -1)]: item,
        ...data,
      })
    } catch (error) {
      console.error(`${type} edit form error:`, error)
      res.status(500).send('Failed to load form')
    }
  })

  // Create
  router.post('/management/:type', async (req, res) => {
    const type = req.params.type as EntityType

    if (!VALID_TYPES.includes(type)) {
      return res.status(404).send('Invalid entity type')
    }

    try {
      const db = getDatabase(req)

      switch (type) {
        case 'suppliers':
          await createSupplier(db, req.body)
          break
        case 'ingredients':
          await createIngredient(db, req.body)
          break
        case 'recipes':
          await createRecipe(db, req.body)
          break
      }

      // Return updated list
      const items = await getEntityList(db, type)
      res.render(`components/${type.slice(0, -1)}-list`, formatListData(type, items))
    } catch (error) {
      console.error(`${type} create error:`, error)
      res.status(500).send(`Failed to create ${type.slice(0, -1)}`)
    }
  })

  // Update
  router.put('/management/:type/:slug', async (req, res) => {
    const type = req.params.type as EntityType
    const { slug } = req.params

    if (!VALID_TYPES.includes(type)) {
      return res.status(404).send('Invalid entity type')
    }

    try {
      const db = getDatabase(req)

      switch (type) {
        case 'suppliers':
          await updateSupplier(db, slug, req.body)
          break
        case 'ingredients':
          await updateIngredient(db, slug, req.body)
          break
        case 'recipes':
          await updateRecipe(db, slug, req.body)
          break
      }

      // Return updated list
      const items = await getEntityList(db, type)
      res.render(`components/${type.slice(0, -1)}-list`, formatListData(type, items))
    } catch (error) {
      console.error(`${type} update error:`, error)
      res.status(500).send(`Failed to update ${type.slice(0, -1)}`)
    }
  })

  // Delete
  router.delete('/management/:type/:slug', async (req, res) => {
    const type = req.params.type as EntityType
    const { slug } = req.params

    if (!VALID_TYPES.includes(type)) {
      return res.status(404).send('Invalid entity type')
    }

    try {
      const db = getDatabase(req)
      const tableName = getTableName(type)

      await db.db.deleteFrom(tableName as any).where('slug', '=', slug).execute()

      // Return updated list
      const items = await getEntityList(db, type)
      res.render(`components/${type.slice(0, -1)}-list`, formatListData(type, items))
    } catch (error) {
      console.error(`${type} delete error:`, error)
      res.status(500).send(`Failed to delete ${type.slice(0, -1)}`)
    }
  })

  // ============================================
  // Margin route - /margin
  // ============================================
  router.get('/margin', async (req, res) => {
    try {
      const db = getDatabase(req)
      const search = (req.query.search as string) || ''
      const filterClass = (req.query['filter-class'] as string) || ''

      // Fetch recipes based on filters
      let query = db.db
        .selectFrom('Recipe')
        .selectAll()
        .where('sellPrice', 'is not', null)
        .where('sellPrice', '>', 0)

      if (filterClass && (filterClass === 'menu_item' || filterClass === 'sub_recipe' || filterClass === 'base_template')) {
        query = query.where('class', '=', filterClass as any)
      }

      if (search) {
        query = query.where((eb) =>
          eb.or([
            eb('name', 'like', `%${search}%`),
            eb('slug', 'like', `%${search}%`),
          ])
        )
      }

      const recipes = await query.execute()

      // Calculate margins for each recipe
      const calculator = new Calculator(
        new RecipeService(db, ingredientService, configService),
        ingredientService,
        configService
      )

      const marginData = await Promise.allSettled(
        recipes.map(async (recipe) => {
          try {
            const costResult = await calculator.cost(recipe.slug)
            const marginResult = await calculator.margin(costResult)
            return {
              name: recipe.name,
              slug: recipe.slug,
              class: recipe.class,
              category: recipe.category,
              includesVat: recipe.includesVat,
              targetMargin: recipe.targetMargin || (await configService.getMarginTarget()),
              foodCost: marginResult.cost,
              actualMargin: marginResult.actualMargin,
              profit: marginResult.profit,
              sellPrice: marginResult.sellPrice,
            }
          } catch (error) {
            return {
              name: recipe.name,
              slug: recipe.slug,
              class: recipe.class,
              category: recipe.category,
              sellPrice: recipe.sellPrice!,
              includesVat: recipe.includesVat,
              targetMargin: recipe.targetMargin || (await configService.getMarginTarget()),
              foodCost: 0,
              actualMargin: 0,
              profit: 0,
              error: error instanceof Error ? error.message : 'Calculation failed',
            }
          }
        })
      )

      const margins = marginData
        .filter(
          (result): result is PromiseFulfilledResult<any> =>
            result.status === 'fulfilled'
        )
        .map((result) => result.value)
        .sort((a, b) => b.actualMargin - a.actualMargin)

      render(res, req, 'margin', 'Margin Calculator - Menu Book', {
        margins,
        search,
        filterClass,
      })
    } catch (error) {
      console.error('Margin error:', error)
      render(res, req, 'margin', 'Margin Calculator - Menu Book', {
        margins: [],
        search: '',
        filterClass: '',
        error: 'Failed to calculate margins',
      })
    }
  })

  // ============================================
  // Settings & Help (disabled for demo)
  // ============================================
  router.get('/settings', (req, res) => {
    if (isDemoEnabled()) {
      return res.redirect('/management/suppliers')
    }
    render(res, req, 'settings', 'Settings - Menu Book', {})
  })

  router.get('/help', (req, res) => {
    if (isDemoEnabled()) {
      return res.redirect('/management/suppliers')
    }
    render(res, req, 'help', 'Help - Menu Book', {})
  })

  // ============================================
  // Legacy route redirects (for backwards compat)
  // ============================================
  router.get('/suppliers', (_req, res) => res.redirect('/management/suppliers'))
  router.get('/ingredients', (_req, res) => res.redirect('/management/ingredients'))
  router.get('/recipes', (_req, res) => res.redirect('/management/recipes'))
  router.get('/margins', (_req, res) => res.redirect('/margin'))

  // ============================================
  // Helper functions
  // ============================================

  function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  function getTableName(type: EntityType): string {
    switch (type) {
      case 'suppliers': return 'Supplier'
      case 'ingredients': return 'Ingredient'
      case 'recipes': return 'Recipe'
    }
  }

  async function getSuppliers(db: any, search: string) {
    let query = db.db.selectFrom('Supplier').selectAll()

    if (search) {
      query = query.where((eb: any) =>
        eb.or([
          eb('name', 'like', `%${search}%`),
          eb('slug', 'like', `%${search}%`),
        ])
      )
    }

    const suppliers = await query.execute()

    // Get ingredient counts
    const counts = await db.db
      .selectFrom('Ingredient')
      .select((eb: any) => ['supplierId', eb.fn.count('id').as('count')])
      .groupBy('supplierId')
      .execute()

    const countMap = new Map(counts.map((c: any) => [c.supplierId, Number(c.count)]))

    return suppliers.map((supplier: any) => ({
      ...supplier,
      ingredientCount: countMap.get(supplier.id) || 0,
    }))
  }

  async function getIngredients(db: any, search: string, category: string, supplierId: string) {
    let query = db.db
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

    if (search) {
      query = query.where((eb: any) =>
        eb.or([
          eb('Ingredient.name', 'like', `%${search}%`),
          eb('Ingredient.slug', 'like', `%${search}%`),
        ])
      )
    }

    if (category) {
      query = query.where('Ingredient.category', '=', category)
    }

    if (supplierId) {
      query = query.where('Ingredient.supplierId', '=', parseInt(supplierId))
    }

    return query.execute()
  }

  async function getRecipes(db: any, search: string, filterClass: string, category: string) {
    let query = db.db.selectFrom('Recipe').selectAll()

    if (search) {
      query = query.where((eb: any) =>
        eb.or([
          eb('name', 'like', `%${search}%`),
          eb('slug', 'like', `%${search}%`),
        ])
      )
    }

    if (filterClass && ['menu_item', 'base_template', 'sub_recipe'].includes(filterClass)) {
      query = query.where('class', '=', filterClass as any)
    }

    if (category) {
      query = query.where('category', '=', category)
    }

    return query.execute()
  }

  async function getAllSuppliers(db: any) {
    return db.db.selectFrom('Supplier').select(['id', 'name']).execute()
  }

  async function getIngredientCategories(db: any) {
    const results = await db.db
      .selectFrom('Ingredient')
      .select('category')
      .distinct()
      .execute()
    return results
      .map((r: any) => r.category)
      .filter((c: string | null): c is string => c !== null)
      .sort()
  }

  async function getRecipeCategories(db: any) {
    const results = await db.db
      .selectFrom('Recipe')
      .select('category')
      .distinct()
      .execute()
    return results
      .map((r: any) => r.category)
      .filter((c: string | null): c is string => c !== null)
      .sort()
  }

  async function getEntityList(db: any, type: EntityType) {
    switch (type) {
      case 'suppliers':
        return getSuppliers(db, '')
      case 'ingredients':
        return getIngredients(db, '', '', '')
      case 'recipes':
        return getRecipes(db, '', '', '')
    }
  }

  function formatListData(type: EntityType, items: any[]) {
    switch (type) {
      case 'suppliers':
        return { suppliers: items }
      case 'ingredients':
        return { ingredients: items }
      case 'recipes':
        return { recipes: items }
    }
  }

  async function createSupplier(db: any, body: any) {
    const { name, contactName, contactEmail, contactPhone, notes } = body
    const slug = slugify(name)

    await db.db
      .insertInto('Supplier')
      .values({
        slug,
        name,
        contactName: contactName || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        notes: notes || null,
      })
      .onConflict((oc: any) =>
        oc.column('slug').doUpdateSet({
          name,
          contactName: contactName || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          notes: notes || null,
        })
      )
      .executeTakeFirst()
  }

  async function updateSupplier(db: any, slug: string, body: any) {
    const { name, contactName, contactEmail, contactPhone, notes } = body

    await db.db
      .updateTable('Supplier')
      .set({
        name,
        contactName: contactName || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        notes: notes || null,
      })
      .where('slug', '=', slug)
      .executeTakeFirst()
  }

  async function createIngredient(db: any, body: any) {
    const {
      name,
      category,
      supplierId,
      purchaseCost,
      purchaseUnit,
      includesVat,
      conversionRule,
      notes,
    } = body
    const slug = slugify(name)

    await db.db
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
      .onConflict((oc: any) =>
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
  }

  async function updateIngredient(db: any, slug: string, body: any) {
    const {
      name,
      category,
      purchaseCost,
      purchaseUnit,
      includesVat,
      conversionRule,
      notes,
    } = body

    await db.db
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
      .where('slug', '=', slug)
      .executeTakeFirst()
  }

  async function createRecipe(db: any, body: any) {
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
    } = body
    const slug = slugify(name)

    await db.db
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
      .onConflict((oc: any) =>
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
  }

  async function updateRecipe(db: any, slug: string, body: any) {
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
    } = body

    await db.db
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
      .where('slug', '=', slug)
      .executeTakeFirst()
  }

  return router
}
