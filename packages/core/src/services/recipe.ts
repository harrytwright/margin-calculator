import type { ExpressionBuilder } from 'kysely'

import type { DB } from '@menubook/types'

import type { CacheAdapter } from '../cache'
import type { DatabaseContext } from '../datastore/context'
import type { Recipe, RecipeIngredients } from '../interfaces/database'
import { Importer, type ImportOutcome } from '../lib/importer'
import type { RecipeResolvedImportData } from '../schema'
import { hasChanges } from '../utils/has-changes'
import { ConfigService } from './config'
import { IngredientService } from './ingredient'

/** Cache key patterns for invalidation */
const CACHE_PATTERNS = {
  /** Invalidate all margin calculations */
  margin: 'margin:*',
  /** Invalidate all dashboard stats */
  dashboard: 'dashboard:*',
} as const

export type RecipeIngredientsLookup = Pick<
  RecipeIngredients,
  'unit' | 'notes'
> & {
  name: string | null
  slug: string
  type: 'ingredient' | 'recipe'
}

export type RecipeWithIngredients<WithIngredients extends boolean> = Omit<
  Recipe,
  'parentId'
> & { parent: string | null } & (WithIngredients extends true
    ? { ingredients: RecipeIngredientsLookup[] }
    : { ingredients?: RecipeIngredientsLookup[] })

export interface RecipeServiceOptions {
  /** Cache adapter for invalidation on mutations */
  cache?: CacheAdapter
}

export class RecipeService {
  private cache?: CacheAdapter

  constructor(
    private context: DatabaseContext,
    private readonly ingredient: IngredientService,
    private readonly config: ConfigService,
    options: RecipeServiceOptions = {}
  ) {
    this.cache = options.cache
  }

  /**
   * Invalidate cache entries affected by recipe changes.
   * Called automatically on upsert/delete.
   */
  private async invalidateCache(): Promise<void> {
    if (!this.cache) return
    await Promise.all([
      this.cache.invalidatePattern(CACHE_PATTERNS.margin),
      this.cache.invalidatePattern(CACHE_PATTERNS.dashboard),
    ])
  }

  private get database() {
    return this.context.db
  }

  async exists(slug: string) {
    return !!(await this.database
      .selectFrom('Recipe')
      .select('id')
      .where('slug', '=', slug)
      .executeTakeFirst())
  }

  find() {
    return this.database
      .selectFrom('Recipe')
      .leftJoin('Recipe as ParentRecipe', 'Recipe.parentId', 'ParentRecipe.id')
      .select([
        'Recipe.id',
        'Recipe.slug',
        'Recipe.name',
        'Recipe.stage',
        'Recipe.class',
        'Recipe.category',
        'Recipe.sellPrice',
        'Recipe.includesVat',
        'Recipe.targetMargin',
        'Recipe.yieldAmount',
        'Recipe.yieldUnit',
        'ParentRecipe.slug as parent',
      ])
      .execute()
  }

  findByIngredientSlug(ingredientSlug: string) {
    return this.database
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

  findById(slug: string): Promise<RecipeWithIngredients<true> | undefined>
  findById(
    slug: string,
    withIngredients: true
  ): Promise<RecipeWithIngredients<true> | undefined>
  findById(
    slug: string,
    withIngredients: false
  ): Promise<RecipeWithIngredients<false> | undefined>
  findById(
    slug: string,
    withIngredients: boolean = true
  ): Promise<
    RecipeWithIngredients<true> | RecipeWithIngredients<false> | undefined
  > {
    return this.database
      .selectFrom('Recipe')
      .leftJoin('Recipe as ParentRecipe', 'Recipe.parentId', 'ParentRecipe.id')
      .select([
        'Recipe.id',
        'Recipe.slug',
        'Recipe.name',
        'Recipe.stage',
        'Recipe.class',
        'Recipe.category',
        'Recipe.sellPrice',
        'Recipe.includesVat',
        'Recipe.targetMargin',
        'Recipe.yieldAmount',
        'Recipe.yieldUnit',
        'ParentRecipe.slug as parent',
      ])
      .$if(withIngredients, (eb) =>
        eb.select((eb) => [
          this.context.helpers
            .jsonArrayFrom(
              eb
                .selectFrom('RecipeIngredients')
                .leftJoin(
                  'Ingredient',
                  'RecipeIngredients.ingredientId',
                  'Ingredient.id'
                )
                .leftJoin(
                  'Recipe as SubRecipe',
                  'RecipeIngredients.subRecipeId',
                  'SubRecipe.id'
                )
                .select((eb) => [
                  'RecipeIngredients.unit',
                  'RecipeIngredients.notes',
                  // Coalesce to get slug from either Ingredient or SubRecipe
                  eb
                    .fn<string>('coalesce', [
                      eb.ref('Ingredient.slug'),
                      eb.ref('SubRecipe.slug'),
                    ])
                    .as('slug'),
                  eb
                    .fn<string>('coalesce', [
                      eb.ref('Ingredient.name'),
                      eb.ref('SubRecipe.name'),
                    ])
                    .as('name'),
                  // Type discriminator: if ingredientId is not null, it's an ingredient
                  eb
                    .case()
                    .when('RecipeIngredients.ingredientId', 'is not', null)
                    .then(eb.val<'ingredient' | 'recipe'>('ingredient'))
                    .else(eb.val<'ingredient' | 'recipe'>('recipe'))
                    .end()
                    .as('type'),
                ])
                .where((eb) =>
                  eb.or([
                    eb(
                      'RecipeIngredients.recipeId',
                      '=',
                      eb.ref('Recipe.parentId')
                    ),
                    eb('RecipeIngredients.recipeId', '=', eb.ref('Recipe.id')),
                  ])
                )
            )
            .as('ingredients'),
        ])
      )
      .where('Recipe.slug', '=', slug)
      .executeTakeFirst()
  }

  async upsert(
    slug: string,
    data: RecipeResolvedImportData,
    defaultPriceIncludesVat: boolean = true
  ) {
    const canUseParentData = !!data.parentSlug

    // In theory, we should not get here, but a last resort
    if (!canUseParentData && data.costing?.price === undefined) {
      throw new Error(
        `Cannot create a recipe '${data.slug}' with missing 'costing.price'. ` +
          `If you forgot to add a parent value, use 'extends' to inherit from a parent recipe instead.`
      )
    }

    // Determine includesVat value: explicit value, or use default
    const includesVat =
      data.costing?.vat !== undefined
        ? data.costing.vat
          ? 1
          : 0
        : defaultPriceIncludesVat
          ? 1
          : 0

    const result = await this.database
      .insertInto('Recipe')
      .values((eb) => ({
        slug,
        name: data.name,
        stage: data.stage,
        class: data.class,
        category: data.category,
        sellPrice: canUseParentData
          ? eb
              .selectFrom('Recipe')
              .select('Recipe.sellPrice')
              .where('Recipe.slug', '=', data.parentSlug!)
          : data.costing!.price!,
        includesVat,
        targetMargin: data.costing?.margin,
        yieldAmount:
          canUseParentData && data.yieldAmount === undefined
            ? eb
                .selectFrom('Recipe')
                .select('Recipe.yieldAmount')
                .where('Recipe.slug', '=', data.parentSlug!)
            : data.yieldAmount,
        yieldUnit:
          canUseParentData && data.yieldUnit === undefined
            ? eb
                .selectFrom('Recipe')
                .select('Recipe.yieldUnit')
                .where('Recipe.slug', '=', data.parentSlug!)
            : data.yieldUnit,
        parentId: data.parentSlug
          ? eb
              .selectFrom('Recipe')
              .select('Recipe.id')
              .where('Recipe.slug', '=', data.parentSlug)
          : undefined,
      }))
      .onConflict((oc) =>
        oc.column('slug').doUpdateSet((eb) => ({
          // Note: parentId is NOT in this update - immutable after creation
          name: data.name,
          stage: data.stage,
          class: data.class,
          category: data.category,
          sellPrice: canUseParentData
            ? eb
                .selectFrom('Recipe')
                .select('Recipe.sellPrice')
                .where('Recipe.slug', '=', data.parentSlug!)
            : data.costing!.price!,
          includesVat,
          targetMargin: data.costing?.margin,
          yieldAmount: data.yieldAmount,
          yieldUnit: data.yieldUnit,
        }))
      )
      .returning('id')
      .executeTakeFirst()

    // Invalidate cache after mutation
    await this.invalidateCache()

    return result?.id
  }

  async upsertIngredients(recipeId: number, data: RecipeResolvedImportData) {
    // Delete existing ingredients
    await this.database
      .deleteFrom('RecipeIngredients')
      .where('recipeId', '=', recipeId)
      .execute()

    // Insert recipe ingredients
    for (const ing of data.ingredients) {
      const query = (eb: ExpressionBuilder<DB, 'RecipeIngredients'>) => {
        const database: keyof DB =
          ing.type === 'ingredient' ? 'Ingredient' : 'Recipe'
        return eb
          .selectFrom(database)
          .select(`${database}.id`)
          .where(`${database}.slug`, '=', ing.slug)
      }

      await this.database
        .insertInto('RecipeIngredients')
        .values((eb) => ({
          recipeId,
          ingredientId: ing.type === 'ingredient' ? query(eb) : undefined,
          subRecipeId: ing.type === 'recipe' ? query(eb) : undefined,
          unit: ing.with.unit,
          notes: ing.with.notes,
        }))
        .execute()
    }
  }

  async delete(slug: string) {
    const result = await this.database
      .deleteFrom('Recipe')
      .where('slug', '=', slug)
      .executeTakeFirst()

    const deleted = result.numDeletedRows > 0n

    // Invalidate cache after deletion
    if (deleted) {
      await this.invalidateCache()
    }

    return deleted
  }

  async processor(
    importer: Importer,
    data: RecipeResolvedImportData,
    filePath: string | undefined
  ): Promise<ImportOutcome> {
    // log.verbose('recipe.processor', 'Processing %o', data)

    if (data.parentSlug && !(await this.exists(data.parentSlug))) {
      throw new Error(
        `Cannot create recipe '${data.slug}' with missing parent '${data.parentSlug}'. ` +
          `Parent recipe should be imported prior to child recipes.`
      )
    }

    const prev = await this.findById(data.slug)

    // log.verbose('recipe.processor', 'Found %o', prev)

    // Use != since one side will be null and the other verbose
    if (prev != null && prev.parent != data.parentSlug) {
      throw new Error(
        `Cannot change parent for recipe '${data.slug}' from '${prev.parent}' to '${data.parentSlug}'. ` +
          `Parent is immutable after creation. Create a new recipe with a different slug instead.`
      )
    }

    // Get default VAT setting from config
    const defaultPriceIncludesVat =
      await this.config.getDefaultPriceIncludesVat()

    // Determine includesVat value: explicit value, or use default
    const includesVat =
      data.costing?.vat !== undefined
        ? data.costing.vat
          ? 1
          : 0
        : defaultPriceIncludesVat
          ? 1
          : 0

    // Normalize ingredients for comparison
    const prevIngredients =
      typeof prev?.ingredients === 'string'
        ? prev.ingredients
        : JSON.stringify(prev?.ingredients || [])
    const newIngredients = JSON.stringify(data.ingredients)

    // Check if any mutable fields have changed
    const hasChanged =
      prevIngredients !== newIngredients ||
      hasChanges(prev, data, {
        name: 'name',
        stage: 'stage',
        class: 'class',
        category: 'category',
        sellPrice: (data) => data.costing?.price,
        includesVat: () => includesVat,
        targetMargin: (data) => data.costing?.margin,
        yieldAmount: 'yieldAmount',
        yieldUnit: 'yieldUnit',
      })

    if (prev && !hasChanged) {
      return 'ignored'
    }

    const recipeId = await this.upsert(data.slug, data, defaultPriceIncludesVat)

    if (!recipeId) throw new Error('Failed to get recipe ID after upsert')

    await this.upsertIngredients(recipeId, data)

    return prev ? 'upserted' : 'created'
  }
}
