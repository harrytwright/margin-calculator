import { Inject, register } from '@harrytwright/api/dist/core'
import { BadRequest, Conflict, NotFound } from '@hndlr/errors'
import type {
  DatabaseContext,
  RecipeResolvedImportData,
  RecipeWithIngredients,
} from '@menubook/core'
import {
  ConfigService,
  IngredientService,
  RecipeService,
  SupplierService,
} from '@menubook/core'
import type { EventEmitter } from 'events'

import { DemoPersistenceManager } from '../datastore/sqlite.demo'
import { RecipeApiData, toRecipeData } from '../schemas'
import IngredientServiceImpl from './ingredient.service'

// Basically a wrapper around the RecipeService to work with the DI side of the webapp
@register('singleton')
export default class RecipeServiceImpl {
  // The shared recipe service instance. Each method will have a `ctx` parameter, if set, a new service instance
  // will be created for that call and that call only. For use with the demo system.
  readonly defaultRecipe: RecipeService = new RecipeService(
    this.ctx,
    this.ingredient.defaultIngredient,
    this.conf
  )

  constructor(
    @Inject('database') private readonly ctx: DatabaseContext,
    @Inject('globalConfig') private readonly conf: ConfigService,
    @Inject('events') private readonly events: EventEmitter,
    private readonly ingredient: IngredientServiceImpl,
    private readonly demo: DemoPersistenceManager
  ) {}

  private recipe(ctx?: DatabaseContext): RecipeService {
    const _ctx = ctx || this.demo.ctx()
    return _ctx
      ? new RecipeService(
          _ctx,
          new IngredientService(_ctx, new SupplierService(_ctx)),
          this.conf
        )
      : this.defaultRecipe
  }

  async delete(slug: string, ctx?: DatabaseContext): Promise<boolean> {
    if (!(await this.exists(slug, ctx))) {
      throw new NotFound(`Recipe with slug '${slug}' not found`)
    }

    const res = await this.recipe(ctx).delete(slug)

    if (res) this.events.emit('recipe.deleted', slug)

    return res
  }

  exists(slug: string, ctx?: DatabaseContext): Promise<boolean> {
    return this.recipe(ctx).exists(slug)
  }

  upsert(
    slug: string,
    data: RecipeResolvedImportData,
    defaultPriceIncludesVat: boolean = true,
    ctx?: DatabaseContext
  ) {
    return this.recipe(ctx).upsert(slug, data, defaultPriceIncludesVat)
  }

  async create(slug: string, raw: RecipeApiData, ctx?: DatabaseContext) {
    if (await this.exists(slug, ctx)) {
      throw new Conflict(`Recipe with slug '${slug}' already exists`)
    }

    // Validate parent recipe exists if specified
    if (raw.extends && !(await this.exists(raw.extends, ctx))) {
      throw new NotFound(`Parent recipe with slug '${raw.extends}' not found`)
    }

    // Validate price requirement
    if (!raw.extends && !raw.costing?.price) {
      throw new BadRequest(
        'costing.price is required when no parent recipe (extends) is specified'
      )
    }

    // Detect ingredient types and validate they exist
    const ingredientTypes = await this.detectIngredientTypes(
      raw.ingredients,
      ctx
    )

    const data = toRecipeData(raw, slug, ingredientTypes)
    const recipeId = await this.upsert(slug, data, true, ctx)

    if (!recipeId) {
      throw new Error('Failed to create recipe')
    }

    await this.upsertIngredients(recipeId, data, ctx)

    return this.findAndEmit(slug, 'recipe.created', ctx)
  }

  async update(slug: string, raw: RecipeApiData, ctx?: DatabaseContext) {
    if (raw.slug && raw.slug !== slug) {
      throw new BadRequest(
        `Slug mismatch: expected '${slug}' but received '${raw.slug}'`
      )
    }

    const existing = await this.findById(slug, true, ctx)
    if (!existing) {
      throw new NotFound(`Recipe with slug '${slug}' not found`)
    }

    // Validate parent recipe exists if specified
    if (raw.extends && !(await this.exists(raw.extends, ctx))) {
      throw new NotFound(`Parent recipe with slug '${raw.extends}' not found`)
    }

    // Validate parent is not being changed
    if (existing.parent !== (raw.extends || null)) {
      throw new BadRequest(
        `Cannot change parent recipe from '${existing.parent}' to '${raw.extends || null}'. Parent is immutable after creation.`
      )
    }

    // Detect ingredient types and validate they exist
    const ingredientTypes = await this.detectIngredientTypes(
      raw.ingredients,
      ctx
    )

    const data = toRecipeData(raw, slug, ingredientTypes)
    const recipeId = await this.upsert(slug, data, true, ctx)

    if (!recipeId) {
      throw new Error('Failed to update recipe')
    }

    await this.upsertIngredients(recipeId, data, ctx)

    return this.findAndEmit(slug, 'recipe.updated', ctx)
  }

  findById(
    slug: string,
    ctx?: DatabaseContext
  ): Promise<RecipeWithIngredients<true> | undefined>
  findById(
    slug: string,
    withIngredients: true,
    ctx?: DatabaseContext
  ): Promise<RecipeWithIngredients<true> | undefined>
  findById(
    slug: string,
    withIngredients: false,
    ctx?: DatabaseContext
  ): Promise<RecipeWithIngredients<false> | undefined>
  findById(
    slug: string,
    withIngredients?: boolean | DatabaseContext,
    ctx?: DatabaseContext
  ): Promise<
    RecipeWithIngredients<true> | RecipeWithIngredients<false> | undefined
  > {
    if (withIngredients && typeof withIngredients !== 'boolean') {
      ctx = withIngredients
      withIngredients = true
    }

    if (!withIngredients) withIngredients = true

    return this.recipe(ctx).findById(slug, withIngredients)
  }

  find(ctx?: DatabaseContext) {
    return this.recipe(ctx).find()
  }

  findByIngredientSlug(ingredientSlug: string, ctx?: DatabaseContext) {
    const _ctx = ctx || this.demo.ctx() || this.ctx
    return _ctx.db
      .selectFrom('RecipeIngredients')
      .innerJoin('Recipe', 'RecipeIngredients.recipeId', 'Recipe.id')
      .innerJoin(
        'Ingredient',
        'RecipeIngredients.ingredientId',
        'Ingredient.id'
      )
      .select(['Recipe.slug', 'Recipe.name', 'Recipe.class', 'Recipe.category'])
      .where('Ingredient.slug', '=', ingredientSlug)
      .distinct()
      .execute()
  }

  upsertIngredients(
    recipeId: number,
    data: RecipeResolvedImportData,
    ctx?: DatabaseContext
  ) {
    return this.recipe(ctx).upsertIngredients(recipeId, data)
  }

  async addIngredient(
    recipeSlug: string,
    ingredientSlug: string,
    data: { quantity?: number; unit: string },
    ctx?: DatabaseContext
  ) {
    const recipe = await this.findById(recipeSlug, true, ctx)
    if (!recipe) {
      throw new NotFound(`Recipe with slug '${recipeSlug}' not found`)
    }

    // Detect ingredient type
    let type: 'ingredient' | 'recipe'
    if (await this.ingredient.exists(ingredientSlug, ctx)) {
      type = 'ingredient'
    } else if (await this.exists(ingredientSlug, ctx)) {
      type = 'recipe'
    } else {
      throw new NotFound(
        `Ingredient or sub-recipe with slug '${ingredientSlug}' not found`
      )
    }

    // Build updated ingredients list
    const existingIngredients = recipe.ingredients || []
    const unitStr =
      data.quantity != null ? `${data.quantity}${data.unit}` : data.unit

    // Filter out if already exists, then add
    const filteredIngredients = existingIngredients.filter(
      (ing) => ing.slug !== ingredientSlug
    )
    const updatedIngredients = [
      ...filteredIngredients.map((ing) => ({
        slug: ing.slug,
        type: ing.type,
        with: { unit: ing.unit, notes: ing.notes || undefined },
      })),
      { slug: ingredientSlug, type, with: { unit: unitStr } },
    ]

    // Build the update payload
    const raw: RecipeApiData = {
      name: recipe.name,
      stage: recipe.stage || 'development',
      class: recipe.class || 'menu_item',
      costing: {
        price: recipe.sellPrice,
        margin: recipe.targetMargin || undefined,
        vat: recipe.includesVat === 1,
      },
      extends: recipe.parent || undefined,
      ingredients: updatedIngredients.map((ing) => ({
        slug: ing.slug,
        type: ing.type,
        unit: ing.with.unit,
      })),
    }

    const ingredientTypes = new Map<string, 'ingredient' | 'recipe'>()
    for (const ing of updatedIngredients) {
      ingredientTypes.set(ing.slug, ing.type)
    }

    const recipeData = toRecipeData(raw, recipeSlug, ingredientTypes)
    const recipeId = await this.upsert(recipeSlug, recipeData, true, ctx)

    if (!recipeId) {
      throw new Error('Failed to update recipe')
    }

    await this.upsertIngredients(recipeId, recipeData, ctx)

    return this.findAndEmit(recipeSlug, 'recipe.updated', ctx)
  }

  async removeIngredient(
    recipeSlug: string,
    ingredientSlug: string,
    ctx?: DatabaseContext
  ) {
    const recipe = await this.findById(recipeSlug, true, ctx)
    if (!recipe) {
      throw new NotFound(`Recipe with slug '${recipeSlug}' not found`)
    }

    const existingIngredients = recipe.ingredients || []
    const hadIngredient = existingIngredients.some(
      (ing) => ing.slug === ingredientSlug
    )

    if (!hadIngredient) {
      throw new NotFound(
        `Ingredient '${ingredientSlug}' not found in recipe '${recipeSlug}'`
      )
    }

    // Build updated ingredients list without the removed one
    const updatedIngredients = existingIngredients
      .filter((ing) => ing.slug !== ingredientSlug)
      .map((ing) => ({
        slug: ing.slug,
        type: ing.type,
        with: { unit: ing.unit, notes: ing.notes || undefined },
      }))

    // Build the update payload
    const raw: RecipeApiData = {
      name: recipe.name,
      stage: recipe.stage || 'development',
      class: recipe.class || 'menu_item',
      costing: {
        price: recipe.sellPrice,
        margin: recipe.targetMargin || undefined,
        vat: recipe.includesVat === 1,
      },
      extends: recipe.parent || undefined,
      ingredients: updatedIngredients.map((ing) => ({
        slug: ing.slug,
        type: ing.type,
        unit: ing.with.unit,
      })),
    }

    const ingredientTypes = new Map<string, 'ingredient' | 'recipe'>()
    for (const ing of updatedIngredients) {
      ingredientTypes.set(ing.slug, ing.type)
    }

    const recipeData = toRecipeData(raw, recipeSlug, ingredientTypes)
    const recipeId = await this.upsert(recipeSlug, recipeData, true, ctx)

    if (!recipeId) {
      throw new Error('Failed to update recipe')
    }

    await this.upsertIngredients(recipeId, recipeData, ctx)

    return this.findAndEmit(recipeSlug, 'recipe.updated', ctx)
  }

  private async detectIngredientTypes(
    ingredients: RecipeApiData['ingredients'],
    ctx?: DatabaseContext
  ): Promise<Map<string, 'ingredient' | 'recipe'>> {
    const ingredientTypes = new Map<string, 'ingredient' | 'recipe'>()

    for (const ing of ingredients) {
      if (ing.type) {
        ingredientTypes.set(ing.slug, ing.type)
      } else {
        // Auto-detect: check ingredient first, then recipe
        if (await this.ingredient.exists(ing.slug, ctx)) {
          ingredientTypes.set(ing.slug, 'ingredient')
        } else if (await this.exists(ing.slug, ctx)) {
          ingredientTypes.set(ing.slug, 'recipe')
        } else {
          throw new NotFound(
            `Ingredient or sub-recipe with slug '${ing.slug}' not found`
          )
        }
      }
    }

    return ingredientTypes
  }

  private async findAndEmit(
    slug: string,
    event: string,
    ctx?: DatabaseContext
  ) {
    const result = await this.findById(slug, true, ctx)
    this.events.emit(event, result)
    return result
  }
}
