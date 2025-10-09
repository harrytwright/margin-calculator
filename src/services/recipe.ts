import { ExpressionBuilder, Kysely } from 'kysely'
import { jsonArrayFrom } from 'kysely/helpers/sqlite'

import log from '@harrytwright/logger'
import type { DB } from '../datastore/types'
import { Importer, type ImportResult } from '../lib/importer'
import type { RecipeResolvedImportData } from '../schema'
import { hasChanges } from '../utils/has-changes'
import { IngredientService } from './ingredient'

export class RecipeService {
  constructor(
    private database: Kysely<DB>,
    private readonly ingredient: IngredientService
  ) {}

  async exists(slug: string) {
    return !!(await this.database
      .selectFrom('Recipe')
      .select('id')
      .where('slug', '=', slug)
      .executeTakeFirst())
  }

  findById(slug: string) {
    return this.database
      .selectFrom('Recipe')
      .leftJoin('Recipe as ParentRecipe', 'Recipe.parentId', 'ParentRecipe.id')
      .select((eb) => [
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
        'ParentRecipe.slug as parentSlug',
        jsonArrayFrom(
          eb
            .selectFrom('RecipeIngredients')
            .innerJoin(
              'Ingredient',
              'RecipeIngredients.ingredientId',
              'Ingredient.id'
            )
            .select(['Ingredient.slug', 'RecipeIngredients.unit'])
        ).as('ingredients'),
      ])
      .where('Recipe.slug', '=', slug)
      .executeTakeFirst()
  }

  async upsert(slug: string, data: RecipeResolvedImportData) {
    const shouldUseParentData =
      data.parentSlug && data.costing?.price === undefined

    // In theory, we should not get here, but a last resort
    if (!shouldUseParentData && data.costing?.price === undefined) {
      throw new Error(
        `Cannot create a recipe '${data.slug}' with missing 'costing.price'. ` +
          `If you forgot to add a parent value, use 'extends' to inherit from a parent recipe instead.`
      )
    }

    const result = await this.database
      .insertInto('Recipe')
      .values((eb) => ({
        slug,
        name: data.name,
        stage: data.stage,
        class: data.class,
        category: data.category,
        sellPrice: shouldUseParentData
          ? eb
              .selectFrom('Recipe')
              .select('Recipe.sellPrice')
              .where('Recipe.slug', '=', data.parentSlug!)
          : data.costing!.price!,
        includesVat: data.costing?.vat ? 1 : 0,
        targetMargin: data.costing?.margin,
        yieldAmount: data.yieldAmount,
        yieldUnit: data.yieldUnit,
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
          sellPrice: shouldUseParentData
            ? eb
                .selectFrom('Recipe')
                .select('Recipe.sellPrice')
                .where('Recipe.slug', '=', data.parentSlug!)
            : data.costing!.price!,
          includesVat: data.costing?.vat ? 1 : 0,
          targetMargin: data.costing?.margin,
          yieldAmount: data.yieldAmount,
          yieldUnit: data.yieldUnit,
        }))
      )
      .returning('id')
      .executeTakeFirst()

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

    return result.numDeletedRows > 0n
  }

  async processor(
    importer: Importer,
    data: RecipeResolvedImportData,
    filePath: string | undefined
  ): Promise<ImportResult> {
    log.verbose('recipe.processor', 'Processing %o', data)

    if (data.parentSlug && !(await this.exists(data.parentSlug))) {
      throw new Error(
        `Cannot create recipe '${data.slug}' with missing parent '${data.parentSlug}'. ` +
          `Parent recipe should be imported prior to child recipes.`
      )
    }

    const prev = await this.findById(data.slug)

    log.verbose('recipe.processor', 'Found %o', prev)

    // Use != since one side will be null and the other verbose
    if (prev != null && prev.parentSlug != data.parentSlug) {
      throw new Error(
        `Cannot change parent for recipe '${data.slug}' from '${prev.parentSlug}' to '${data.parentSlug}'. ` +
          `Parent is immutable after creation. Create a new recipe with a different slug instead.`
      )
    }

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
        includesVat: (data) => (data.costing?.vat ? 1 : 0),
        targetMargin: (data) => data.costing?.margin,
        yieldAmount: 'yieldAmount',
        yieldUnit: 'yieldUnit',
      })

    if (prev && !hasChanged) {
      return 'ignored'
    }

    const recipeId = await this.upsert(data.slug, data)

    if (!recipeId) throw new Error('Failed to get recipe ID after upsert')

    await this.upsertIngredients(recipeId, data)

    return prev ? 'upserted' : 'created'
  }
}
