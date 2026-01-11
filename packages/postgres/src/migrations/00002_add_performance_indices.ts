import type { Kysely } from 'kysely'

/**
 * Migration: Add performance indices
 *
 * Adds indices for foreign key columns and commonly filtered columns to improve
 * query performance as the dataset grows.
 *
 * High priority indices (missing FK indices):
 * - Recipe.parentId: Used in self-joins for recipe inheritance
 * - Ingredient.supplierId: Used in JOINs, filtering, and aggregation
 * - RecipeIngredients.subRecipeId: Used in sub-recipe lookups
 *
 * Medium priority indices (filter optimization):
 * - Recipe.category: Used for filtering by category
 * - Recipe.class: Used for filtering by class (menu_item, base_template, sub_recipe)
 */
export async function up(db: Kysely<any>): Promise<void> {
  // High priority: Foreign key indices
  await db.schema
    .createIndex('Recipe_parentId_idx')
    .on('Recipe')
    .column('parentId')
    .execute()

  await db.schema
    .createIndex('Ingredient_supplierId_idx')
    .on('Ingredient')
    .column('supplierId')
    .execute()

  await db.schema
    .createIndex('RecipeIngredients_subRecipeId_idx')
    .on('RecipeIngredients')
    .column('subRecipeId')
    .execute()

  // Medium priority: Filter optimization
  await db.schema
    .createIndex('Recipe_category_idx')
    .on('Recipe')
    .column('category')
    .execute()

  await db.schema
    .createIndex('Recipe_class_idx')
    .on('Recipe')
    .column('class')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('Recipe_parentId_idx').execute()
  await db.schema.dropIndex('Ingredient_supplierId_idx').execute()
  await db.schema.dropIndex('RecipeIngredients_subRecipeId_idx').execute()
  await db.schema.dropIndex('Recipe_category_idx').execute()
  await db.schema.dropIndex('Recipe_class_idx').execute()
}
