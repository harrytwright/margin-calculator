import { controller, Inject, path } from '@harrytwright/api/dist/core'
import type { DatabaseContext } from '@menubook/core'
import { ConfigService, slugify } from '@menubook/core'
import express from 'express'

import { DemoPersistenceManager } from '../datastore/sqlite.demo'
import {
  ingredientApiSchema,
  recipeApiSchema,
  supplierApiSchema,
} from '../schemas'
import CalculatorImpl from '../services/calculator.service'
import IngredientServiceImpl from '../services/ingredient.service'
import RecipeServiceImpl from '../services/recipe.service'
import SupplierServiceImpl from '../services/supplier.service'
import type { ServerRequest } from '../types/response.json.type'

const inDemoMode = process.env.DEMO === 'true'

/**
 * Check if demo mode is enabled
 */
function isDemoEnabled(): boolean {
  return inDemoMode
}

/**
 * Entity type validation
 */
const VALID_ENTITY_TYPES = ['suppliers', 'ingredients', 'recipes'] as const
type EntityType = (typeof VALID_ENTITY_TYPES)[number]

function isValidEntityType(type: string): type is EntityType {
  return VALID_ENTITY_TYPES.includes(type as EntityType)
}

@controller('/')
export class AppController {
  constructor(
    private readonly suppliers: SupplierServiceImpl,
    private readonly ingredients: IngredientServiceImpl,
    private readonly recipes: RecipeServiceImpl,
    @Inject('globalConfig') private readonly config: ConfigService,
    @Inject('database') private readonly ctx: DatabaseContext,
    private readonly calculator: CalculatorImpl,
    private readonly demo: DemoPersistenceManager
  ) {}

  /**
   * Helper method to render views with HTMX support
   */
  private render(
    req: express.Request,
    res: express.Response,
    view: string,
    pageTitle: string,
    data: Record<string, any> = {}
  ) {
    const isHtmx = req.headers['hx-request'] === 'true'
    const target = req.headers['hx-target'] as string | undefined

    if (isHtmx && target === 'content-area') {
      return res.render('partials/content-area', { view, ...data })
    } else if (isHtmx && target === 'main-content') {
      return res.render(`pages/${view}`, data)
    } else if (isHtmx && target === '.modal-content') {
      // Modal content rendering - find the appropriate component
      return res.render(`components/${data.componentView || view}`, data)
    } else if (isHtmx && target === '#entity-list') {
      // Entity list partial rendering
      return res.render(`components/${data.listView || view}`, data)
    } else if (
      isHtmx &&
      (target === '#recipes-editor' || target === 'recipes-editor')
    ) {
      // Recipe editor partial - only render the editor content
      return res.render('islands/recipe-editor', data)
    } else if (
      isHtmx &&
      (target === '#ingredients-editor' || target === 'ingredients-editor')
    ) {
      // Ingredient editor partial - only render the editor content
      return res.render('islands/ingredient-editor', data)
    } else if (isHtmx && target === '#supplier-details') {
      // Supplier details partial - render details island with OOB swap for ingredients
      return res.render('islands/supplier-details', data)
    } else if (
      isHtmx &&
      (target?.startsWith('#') || target?.endsWith('-editor'))
    ) {
      // Other island-specific partial rendering
      return res.render(`pages/${view}`, data)
    } else {
      // Use new app layout for island-based UI
      return res.render('layouts/app', {
        view,
        pageTitle,
        isDemo: isDemoEnabled(),
        ...data,
      })
    }
  }

  /**
   * GET / - Redirect to recipes (default view)
   */
  @path('/')
  async getRoot(req: express.Request, res: express.Response) {
    return res.redirect('/recipes')
  }

  /**
   * GET /recipes - List all recipes
   */
  @path('/recipes')
  async getRecipes(req: express.Request, res: express.Response) {
    const recipes = await this.recipes.find()
    return this.render(req, res, 'recipes', 'Recipes', { recipes })
  }

  /**
   * GET /recipes/new - New recipe form
   */
  @path('/recipes/new')
  async getNewRecipeForm(req: express.Request, res: express.Response) {
    return res.render('components/recipe-form', {
      recipe: null,
    })
  }

  /**
   * POST /recipes - Create recipe
   */
  @path('/recipes')
  async postRecipe(
    req: ServerRequest<never, unknown, Record<string, any>>,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const parsed = recipeApiSchema.parse(req.body)
      const slug = parsed.slug || (await slugify(parsed.name))
      await this.recipes.create(slug, parsed)

      // Use HX-Redirect to navigate to the new recipe
      res.setHeader('HX-Redirect', `/recipes/${slug}`)
      return res.status(201).send('')
    } catch (error) {
      return next(error)
    }
  }

  /**
   * GET /recipes/:slug/edit - Edit recipe form
   */
  @path('/recipes/:slug/edit')
  async getEditRecipeForm(req: express.Request, res: express.Response) {
    const { slug } = req.params
    const recipe = await this.recipes.findById(slug, true)

    if (!recipe) {
      return res.status(404).send('Recipe not found')
    }

    return res.render('components/recipe-form', {
      recipe,
    })
  }

  /**
   * GET /recipes/:slug - View/edit a specific recipe
   */
  @path('/recipes/:slug')
  async getRecipe(req: express.Request, res: express.Response) {
    const { slug } = req.params
    const recipes = await this.recipes.find()
    const recipe = await this.recipes.findById(slug, true)

    if (!recipe) {
      return res.status(404).send('Recipe not found')
    }

    // Calculate cost if recipe has ingredients
    let cost = null
    try {
      const costResult = await this.calculator.cost(slug)
      const marginResult = await this.calculator.margin(costResult)
      cost = {
        total: costResult.totalCost,
        breakdown: costResult.tree,
        margin: marginResult,
      }
    } catch (error) {
      // Cost calculation failed, continue without it
    }

    return this.render(req, res, 'recipes', 'Recipes', {
      recipes,
      recipe,
      cost,
    })
  }

  /**
   * PUT /recipes/:slug - Update recipe
   */
  @path('/recipes/:slug')
  async putRecipe(
    req: ServerRequest<{ slug: string }, unknown, Record<string, any>>,
    res: express.Response,
    next: express.NextFunction
  ) {
    const { slug } = req.params

    try {
      const parsed = recipeApiSchema.parse(req.body)
      await this.recipes.update(slug, parsed)

      // Re-fetch and return updated editor
      const recipes = await this.recipes.find()
      const recipe = await this.recipes.findById(slug, true)

      let cost = null
      try {
        const costResult = await this.calculator.cost(slug)
        const marginResult = await this.calculator.margin(costResult)
        cost = {
          total: costResult.totalCost,
          breakdown: costResult.tree,
          margin: marginResult,
        }
      } catch (error) {
        // Cost calculation failed
      }

      // Close modal via header
      res.setHeader('HX-Trigger', 'closeModal')
      return res.render('islands/recipe-editor', { recipes, recipe, cost })
    } catch (error) {
      return next(error)
    }
  }

  /**
   * DELETE /recipes/:slug - Delete recipe
   */
  @path('/recipes/:slug')
  async deleteRecipe(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const { slug } = req.params

    try {
      await this.recipes.delete(slug)

      // Return updated browser list
      const recipes = await this.recipes.find()

      return res.render('islands/browser', {
        type: 'recipes',
        items: recipes,
        selectedSlug: null,
        groupBy: 'category',
      })
    } catch (error) {
      return next(error)
    }
  }

  /**
   * GET /recipes/:slug/ingredients/add - Ingredient picker modal
   */
  @path('/recipes/:slug/ingredients/add')
  async getIngredientPicker(req: express.Request, res: express.Response) {
    const { slug } = req.params
    const recipe = await this.recipes.findById(slug, true)
    const ingredients = await this.ingredients.find()

    if (!recipe) {
      return res.status(404).send('Recipe not found')
    }

    return res.render('modals/ingredient-picker', {
      recipe,
      ingredients,
    })
  }

  /**
   * GET /ingredients - List all ingredients
   */
  @path('/ingredients')
  async getIngredients(req: express.Request, res: express.Response) {
    const ingredients = await this.ingredients.find()
    const suppliers = await this.suppliers.find()
    return this.render(req, res, 'ingredients', 'Ingredients', {
      ingredients,
      suppliers,
    })
  }

  /**
   * GET /ingredients/new - New ingredient form
   */
  @path('/ingredients/new')
  async getNewIngredientForm(req: express.Request, res: express.Response) {
    const suppliers = await this.suppliers.find()
    return res.render('components/ingredient-form', {
      ingredient: null,
      suppliers,
    })
  }

  /**
   * POST /ingredients - Create ingredient
   */
  @path('/ingredients')
  async postIngredient(
    req: ServerRequest<never, unknown, Record<string, any>>,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const parsed = ingredientApiSchema.parse(req.body)
      const slug = parsed.slug || (await slugify(parsed.name))
      const supplierSlug = req.body.supplierId || 'generic'
      await this.ingredients.create(slug, parsed, supplierSlug)

      res.setHeader('HX-Redirect', `/ingredients/${slug}`)
      return res.status(201).send('')
    } catch (error) {
      return next(error)
    }
  }

  /**
   * GET /ingredients/:slug/edit - Edit ingredient form
   */
  @path('/ingredients/:slug/edit')
  async getEditIngredientForm(req: express.Request, res: express.Response) {
    const { slug } = req.params
    const ingredient = await this.ingredients.findById(slug)
    const suppliers = await this.suppliers.find()

    if (!ingredient) {
      return res.status(404).send('Ingredient not found')
    }

    return res.render('components/ingredient-form', {
      ingredient,
      suppliers,
    })
  }

  /**
   * GET /ingredients/:slug - View/edit a specific ingredient
   */
  @path('/ingredients/:slug')
  async getIngredient(req: express.Request, res: express.Response) {
    const { slug } = req.params
    const ingredients = await this.ingredients.find()
    const ingredient = await this.ingredients.findById(slug)
    const suppliers = await this.suppliers.find()

    if (!ingredient) {
      return res.status(404).send('Ingredient not found')
    }

    // Find recipes using this ingredient
    // Note: We need to load each recipe with ingredients to check usage
    // For performance, we could add a dedicated query for this
    const allRecipes = await this.recipes.find()
    const recipesWithIngredients = await Promise.all(
      allRecipes.map((r) => this.recipes.findById(r.slug, true))
    )
    const usedIn = recipesWithIngredients.filter((r) => {
      if (!r || !r.ingredients) return false
      return r.ingredients.some(
        (i: any) => i.ingredientSlug === slug || i.slug === slug
      )
    })

    return this.render(req, res, 'ingredients', 'Ingredients', {
      ingredients,
      ingredient,
      suppliers,
      usedIn,
    })
  }

  /**
   * PUT /ingredients/:slug - Update ingredient
   */
  @path('/ingredients/:slug')
  async putIngredient(
    req: ServerRequest<{ slug: string }, unknown, Record<string, any>>,
    res: express.Response,
    next: express.NextFunction
  ) {
    const { slug } = req.params

    try {
      const parsed = ingredientApiSchema.parse(req.body)
      const supplierSlug = req.body.supplierId || 'generic'
      await this.ingredients.update(slug, parsed, supplierSlug)

      const ingredients = await this.ingredients.find()
      const ingredient = await this.ingredients.findById(slug)
      const suppliers = await this.suppliers.find()

      res.setHeader('HX-Trigger', 'closeModal')
      return res.render('islands/ingredient-editor', {
        ingredients,
        ingredient,
        suppliers,
      })
    } catch (error) {
      return next(error)
    }
  }

  /**
   * DELETE /ingredients/:slug - Delete ingredient
   */
  @path('/ingredients/:slug')
  async deleteIngredient(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const { slug } = req.params

    try {
      await this.ingredients.delete(slug)
      const ingredients = await this.ingredients.find()

      return res.render('islands/browser', {
        type: 'ingredients',
        items: ingredients,
        selectedSlug: null,
        groupBy: 'category',
      })
    } catch (error) {
      return next(error)
    }
  }

  /**
   * GET /suppliers - List all suppliers
   */
  @path('/suppliers')
  async getSuppliers(req: express.Request, res: express.Response) {
    const suppliers = await this.suppliers.find()
    // Add ingredient count to each supplier
    const ingredientsList = await this.ingredients.find()
    const suppliersWithCounts = suppliers.map((s) => ({
      ...s,
      ingredientCount: ingredientsList.filter((i) => i.supplierSlug === s.slug)
        .length,
    }))
    return this.render(req, res, 'suppliers', 'Suppliers', {
      suppliers: suppliersWithCounts,
    })
  }

  /**
   * GET /suppliers/new - New supplier form
   */
  @path('/suppliers/new')
  async getNewSupplierForm(req: express.Request, res: express.Response) {
    return res.render('components/supplier-form', {
      supplier: null,
    })
  }

  /**
   * POST /suppliers - Create supplier
   */
  @path('/suppliers')
  async postSupplier(
    req: ServerRequest<never, unknown, Record<string, any>>,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const parsed = supplierApiSchema.parse(req.body)
      const slug = parsed.slug || (await slugify(parsed.name))
      await this.suppliers.create(slug, parsed)

      res.setHeader('HX-Redirect', `/suppliers/${slug}`)
      return res.status(201).send('')
    } catch (error) {
      return next(error)
    }
  }

  /**
   * GET /suppliers/:slug/edit - Edit supplier form
   */
  @path('/suppliers/:slug/edit')
  async getEditSupplierForm(req: express.Request, res: express.Response) {
    const { slug } = req.params
    const supplier = await this.suppliers.findById(slug)

    if (!supplier) {
      return res.status(404).send('Supplier not found')
    }

    return res.render('components/supplier-form', {
      supplier,
    })
  }

  /**
   * GET /suppliers/:slug - View/edit a specific supplier
   */
  @path('/suppliers/:slug')
  async getSupplier(req: express.Request, res: express.Response) {
    const { slug } = req.params
    const allSuppliers = await this.suppliers.find()
    const supplier = await this.suppliers.findById(slug)

    if (!supplier) {
      return res.status(404).send('Supplier not found')
    }

    // Get ingredients from this supplier
    const allIngredients = await this.ingredients.find()
    const ingredients = allIngredients.filter((i) => i.supplierSlug === slug)

    // Add ingredient count to suppliers
    const suppliers = allSuppliers.map((s) => ({
      ...s,
      ingredientCount: allIngredients.filter((i) => i.supplierSlug === s.slug)
        .length,
    }))

    return this.render(req, res, 'suppliers', 'Suppliers', {
      suppliers,
      supplier,
      ingredients,
    })
  }

  /**
   * PUT /suppliers/:slug - Update supplier
   */
  @path('/suppliers/:slug')
  async putSupplier(
    req: ServerRequest<{ slug: string }, unknown, Record<string, any>>,
    res: express.Response,
    next: express.NextFunction
  ) {
    const { slug } = req.params

    try {
      const parsed = supplierApiSchema.parse(req.body)
      await this.suppliers.update(slug, parsed)

      const allSuppliers = await this.suppliers.find()
      const supplier = await this.suppliers.findById(slug)
      const allIngredients = await this.ingredients.find()
      const ingredients = allIngredients.filter((i) => i.supplierSlug === slug)

      const suppliers = allSuppliers.map((s) => ({
        ...s,
        ingredientCount: allIngredients.filter((i) => i.supplierSlug === s.slug)
          .length,
      }))

      res.setHeader('HX-Trigger', 'closeModal')
      return res.render('pages/suppliers', {
        suppliers,
        supplier,
        ingredients,
      })
    } catch (error) {
      return next(error)
    }
  }

  /**
   * DELETE /suppliers/:slug - Delete supplier
   */
  @path('/suppliers/:slug')
  async deleteSupplier(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const { slug } = req.params

    try {
      await this.suppliers.delete(slug)
      const suppliers = await this.suppliers.find()
      const ingredients = await this.ingredients.find()

      const suppliersWithCounts = suppliers.map((s) => ({
        ...s,
        ingredientCount: ingredients.filter((i) => i.supplierSlug === s.slug)
          .length,
      }))

      return res.render('islands/browser', {
        type: 'suppliers',
        items: suppliersWithCounts,
        selectedSlug: null,
        groupBy: null,
      })
    } catch (error) {
      return next(error)
    }
  }

  /**
   * GET /dashboard - Dashboard with statistics (kept for backwards compatibility)
   */
  @path('/dashboard')
  async getDashboard(req: express.Request, res: express.Response) {
    // Redirect to recipes page
    return res.redirect('/recipes')
  }

  /**
   * GET /management/:type - List entities
   */
  @path('/management/:type')
  async getManagement(req: express.Request, res: express.Response) {
    const { type } = req.params

    if (!isValidEntityType(type)) {
      return res.status(404).send('Not found')
    }

    const items = await this.getEntityList(type)
    const additionalData = await this.getAdditionalListData(type)

    return this.render(
      req,
      res,
      'management',
      `${this.capitalize(type)} Management`,
      {
        type,
        items,
        ...additionalData,
      }
    )
  }

  /**
   * GET /management/:type/new - New entity form
   */
  @path('/management/:type/new')
  async getNewEntityForm(req: express.Request, res: express.Response) {
    const { type } = req.params

    if (!isValidEntityType(type)) {
      return res.status(404).send('Not found')
    }

    const singular = type.slice(0, -1)
    const componentView = `${singular}-form`
    const additionalData = await this.getFormData(type)

    return res.render(`components/${componentView}`, {
      [singular]: null,
      ...additionalData,
    })
  }

  /**
   * GET /management/:type/:slug/edit - Edit entity form
   */
  @path('/management/:type/:slug/edit')
  async getEditEntityForm(req: express.Request, res: express.Response) {
    const { type, slug } = req.params

    if (!isValidEntityType(type)) {
      return res.status(404).send('Not found')
    }

    const entity = await this.getEntityBySlug(type, slug)
    if (!entity) {
      return res.status(404).send('Entity not found')
    }

    const singular = type.slice(0, -1)
    const componentView = `${singular}-form`
    const additionalData = await this.getFormData(type)

    return res.render(`components/${componentView}`, {
      [singular]: entity,
      ...additionalData,
    })
  }

  /**
   * POST /management/:type - Create entity
   */
  @path('/management/:type')
  async postEntity(
    req: ServerRequest<{ type: string }, unknown, Record<string, any>>,
    res: express.Response,
    next: express.NextFunction
  ) {
    const { type } = req.params

    if (!isValidEntityType(type)) {
      return res.status(404).send('Not found')
    }

    try {
      await this.createEntity(type, req.body)
      const items = await this.getEntityList(type)
      const listView = `${type.slice(0, -1)}-list`

      return res.render(`components/${listView}`, {
        [type]: items,
      })
    } catch (error) {
      return next(error)
    }
  }

  /**
   * PUT /management/:type/:slug - Update entity
   */
  @path('/management/:type/:slug')
  async putEntity(
    req: ServerRequest<
      { type: string; slug: string },
      unknown,
      Record<string, any>
    >,
    res: express.Response,
    next: express.NextFunction
  ) {
    const { type, slug } = req.params

    if (!isValidEntityType(type)) {
      return res.status(404).send('Not found')
    }

    try {
      await this.updateEntity(type, slug, req.body)
      const items = await this.getEntityList(type)
      const listView = `${type.slice(0, -1)}-list`

      return res.render(`components/${listView}`, {
        [type]: items,
      })
    } catch (error) {
      return next(error)
    }
  }

  /**
   * DELETE /management/:type/:slug - Delete entity
   */
  @path('/management/:type/:slug')
  async deleteEntity(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const { type, slug } = req.params

    if (!isValidEntityType(type)) {
      return res.status(404).send('Not found')
    }

    try {
      await this.deleteEntityBySlug(type, slug)
      const items = await this.getEntityList(type)
      const listView = `${type.slice(0, -1)}-list`

      return res.render(`components/${listView}`, {
        [type]: items,
      })
    } catch (error) {
      return next(error)
    }
  }

  /**
   * GET /margin - Margin calculator page
   */
  @path('/margin')
  async getMargin(req: express.Request, res: express.Response) {
    try {
      const allRecipes = await this.recipes.find()
      const margins = await Promise.all(
        allRecipes
          .filter((r) => r.sellPrice && r.sellPrice > 0)
          .map(async (recipe) => {
            try {
              const cost = await this.calculator.cost(recipe.slug)
              const marginResult = await this.calculator.margin(cost)
              return {
                slug: recipe.slug,
                name: recipe.name,
                class: recipe.class,
                sellPrice: recipe.sellPrice,
                includesVat: recipe.includesVat,
                foodCost: marginResult.cost,
                profit: marginResult.profit,
                actualMargin: marginResult.actualMargin,
                targetMargin: marginResult.targetMargin,
              }
            } catch (error: any) {
              return {
                slug: recipe.slug,
                name: recipe.name,
                class: recipe.class,
                sellPrice: recipe.sellPrice,
                includesVat: recipe.includesVat,
                foodCost: 0,
                profit: 0,
                actualMargin: 0,
                targetMargin: await this.config.getMarginTarget(),
                error: error.message,
              }
            }
          })
      )

      return this.render(req, res, 'margin', 'Margin Calculator', { margins })
    } catch (error) {
      return this.render(req, res, 'margin', 'Margin Calculator', {
        margins: [],
        error: 'Failed to load margin data',
      })
    }
  }

  /**
   * GET /settings - Settings page or modal
   */
  @path('/settings')
  async getSettings(req: express.Request, res: express.Response) {
    const settings = await this.config.getAll()

    // Check if this is a modal request
    const isHtmx = req.headers['hx-request'] === 'true'
    const target = req.headers['hx-target'] as string | undefined

    if (isHtmx && target === '.modal-content') {
      return res.render('modals/settings-modal', { settings })
    }

    return this.render(req, res, 'settings', 'Settings', { settings })
  }

  /**
   * POST /settings - Save settings
   */
  @path('/settings')
  async postSettings(
    req: ServerRequest<
      never,
      unknown,
      { vat?: string; marginTarget?: string; defaultPriceIncludesVat?: string }
    >,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const { vat, marginTarget, defaultPriceIncludesVat } = req.body

      const updates: Record<string, any> = {}

      if (vat !== undefined) {
        // Convert percentage to decimal (e.g., 20 -> 0.2)
        updates.vat = parseFloat(vat) / 100
      }

      if (marginTarget !== undefined) {
        updates.marginTarget = parseFloat(marginTarget)
      }

      // Checkbox: present = true, absent = false
      updates.defaultPriceIncludesVat =
        defaultPriceIncludesVat === 'on' || defaultPriceIncludesVat === '1'

      const settings = await this.config.update(updates)

      // Check if it's an HTMX request
      const isHtmx = req.headers['hx-request'] === 'true'
      const target = req.headers['hx-target'] as string | undefined

      if (isHtmx) {
        // If targeting modal, return modal with success
        if (target === '.modal-content') {
          return res.render('modals/settings-modal', {
            settings,
            success: true,
          })
        }
        return res.render('pages/settings', { settings, success: true })
      }

      return res.redirect('/settings')
    } catch (error) {
      return next(error)
    }
  }

  /**
   * GET /help - Help page or modal
   */
  @path('/help')
  async getHelp(req: express.Request, res: express.Response) {
    // Check if this is a modal request
    const isHtmx = req.headers['hx-request'] === 'true'
    const target = req.headers['hx-target'] as string | undefined

    if (isHtmx && target === '.modal-content') {
      return res.render('modals/help-modal')
    }

    return this.render(req, res, 'help', 'Help & Documentation')
  }

  // ==================== Helper Methods ====================

  private getContext(): DatabaseContext {
    const demoCtx = this.demo.ctx()
    return demoCtx || this.ctx
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  private async getEntityList(type: EntityType) {
    switch (type) {
      case 'suppliers':
        return this.suppliers.find()
      case 'ingredients':
        return this.ingredients.find()
      case 'recipes':
        return this.recipes.find()
    }
  }

  private async getEntityBySlug(type: EntityType, slug: string) {
    switch (type) {
      case 'suppliers':
        return this.suppliers.findById(slug)
      case 'ingredients':
        return this.ingredients.findById(slug)
      case 'recipes':
        return this.recipes.findById(slug, true)
    }
  }

  private async getAdditionalListData(
    type: EntityType
  ): Promise<Record<string, any>> {
    switch (type) {
      case 'ingredients':
        const suppliers = await this.suppliers.find()
        return { suppliers }
      default:
        return {}
    }
  }

  private async getFormData(type: EntityType): Promise<Record<string, any>> {
    switch (type) {
      case 'ingredients':
        const suppliers = await this.suppliers.find()
        return { suppliers }
      case 'recipes':
        const ingredients = await this.ingredients.find()
        const allRecipes = await this.recipes.find()
        return { ingredients, recipes: allRecipes }
      default:
        return {}
    }
  }

  private async createEntity(type: EntityType, data: Record<string, any>) {
    switch (type) {
      case 'suppliers': {
        const parsed = supplierApiSchema.parse(data)
        const slug = parsed.slug || (await slugify(parsed.name))
        return this.suppliers.create(slug, parsed)
      }
      case 'ingredients': {
        const parsed = ingredientApiSchema.parse(data)
        const slug = parsed.slug || (await slugify(parsed.name))
        const supplierSlug = data.supplierId || 'generic'
        return this.ingredients.create(slug, parsed, supplierSlug)
      }
      case 'recipes': {
        const parsed = recipeApiSchema.parse(data)
        const slug = parsed.slug || (await slugify(parsed.name))
        return this.recipes.create(slug, parsed)
      }
    }
  }

  private async updateEntity(
    type: EntityType,
    slug: string,
    data: Record<string, any>
  ) {
    switch (type) {
      case 'suppliers': {
        const parsed = supplierApiSchema.parse(data)
        return this.suppliers.update(slug, parsed)
      }
      case 'ingredients': {
        const parsed = ingredientApiSchema.parse(data)
        const supplierSlug = data.supplierId || 'generic'
        return this.ingredients.update(slug, parsed, supplierSlug)
      }
      case 'recipes': {
        const parsed = recipeApiSchema.parse(data)
        return this.recipes.update(slug, parsed)
      }
    }
  }

  private async deleteEntityBySlug(type: EntityType, slug: string) {
    switch (type) {
      case 'suppliers':
        return this.suppliers.delete(slug)
      case 'ingredients':
        return this.ingredients.delete(slug)
      case 'recipes':
        return this.recipes.delete(slug)
    }
  }
}
