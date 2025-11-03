import { ExpressionBuilder, Kysely } from 'kysely'
import { jsonArrayFrom } from 'kysely/helpers/sqlite'

import type { DB } from '../datastore/types'
import { Recipe, RecipeIngredients } from '../interfaces/database'
import { Importer, type ImportOutcome } from '../lib/importer'
import type { RecipeResolvedImportData } from '../schema'
import { hasChanges } from '../utils/has-changes'
import { IngredientService } from './ingredient'

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
          jsonArrayFrom(
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
          ).as('ingredients'),
        ])
      )
      .where('Recipe.slug', '=', slug)
      .executeTakeFirst()
  }

  async upsert(slug: string, data: RecipeResolvedImportData) {
    const canUseParentData = !!data.parentSlug

    // In theory, we should not get here, but a last resort
    if (!canUseParentData && data.costing?.price === undefined) {
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
        sellPrice: canUseParentData
          ? eb
              .selectFrom('Recipe')
              .select('Recipe.sellPrice')
              .where('Recipe.slug', '=', data.parentSlug!)
          : data.costing!.price!,
        includesVat: data.costing?.vat !== false ? 1 : 0,
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
          includesVat: data.costing?.vat !== false ? 1 : 0,
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
        includesVat: (data) => (data.costing?.vat !== false ? 1 : 0),
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
