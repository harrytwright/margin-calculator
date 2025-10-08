import { Kysely } from 'kysely'
import { jsonArrayFrom } from 'kysely/helpers/sqlite'

import { DB } from '../datastore/types'
import { RecipeImportData } from '../schema'

export function findById(this: Kysely<DB>, slug: string) {
  return this.selectFrom('Recipe')
    .leftJoin('Recipe as ParentRecipe', 'Recipe.parentId', 'ParentRecipe.id')
    .select((eb) => [
      'Recipe.id',
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

export async function upsert(
  this: Kysely<DB>,
  slug: string,
  data: RecipeImportData
) {
  const result = await this.insertInto('Recipe')
    .values((eb) => ({
      slug,
      name: data.name,
      stage: data.stage,
      class: data.class,
      category: data.category,
      sellPrice: data.sellPrice,
      includesVat: data.includesVat ? 1 : 0,
      targetMargin: data.targetMargin,
      yieldAmount: data.yieldAmount,
      yieldUnit: data.yieldUnit,
      parentId: data.parent
        ? eb
            .selectFrom('Recipe')
            .select('Recipe.id')
            .where('Recipe.slug', '=', data.parent)
        : undefined,
    }))
    .onConflict((oc) =>
      oc.column('slug').doUpdateSet({
        // Note: parentId is NOT in this update - immutable after creation
        name: data.name,
        stage: data.stage,
        class: data.class,
        category: data.category,
        sellPrice: data.sellPrice,
        includesVat: data.includesVat ? 1 : 0,
        targetMargin: data.targetMargin,
        yieldAmount: data.yieldAmount,
        yieldUnit: data.yieldUnit,
      })
    )
    .returning('id')
    .executeTakeFirst()

  return result?.id
}

export async function upsertIngredients(
  this: Kysely<DB>,
  recipeId: number,
  data: RecipeImportData
) {
  // Delete existing ingredients
  await this.deleteFrom('RecipeIngredients')
    .where('recipeId', '=', recipeId)
    .execute()

  // Insert recipe ingredients
  for (const ing of data.ingredients) {
    await this.insertInto('RecipeIngredients')
      .values((eb) => ({
        recipeId,
        ingredientId: ing.ingredient
          ? eb
              .selectFrom('Ingredient')
              .select('Ingredient.id')
              .where('Ingredient.slug', '=', ing.ingredient)
          : undefined,
        subRecipeId: ing.recipe
          ? eb
              .selectFrom('Recipe')
              .select('Recipe.id')
              .where('Recipe.slug', '=', ing.recipe)
          : undefined,
        unit: ing.unit,
        notes: ing.notes,
      }))
      .execute()
  }
}

export async function exists(this: Kysely<DB>, slug: string) {
  return !!(await this.selectFrom('Recipe')
    .select('id')
    .where('slug', '=', slug)
    .executeTakeFirst())
}
