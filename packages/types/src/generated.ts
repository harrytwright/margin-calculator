import type { ColumnType, GeneratedAlways } from 'kysely'
export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>
export type Timestamp = ColumnType<Date, Date | string, Date | string>

export const RecipeStage = {
  development: 'development',
  active: 'active',
  discontinued: 'discontinued',
} as const
export type RecipeStage = (typeof RecipeStage)[keyof typeof RecipeStage]
export const RecipeClass = {
  menu_item: 'menu_item',
  base_template: 'base_template',
  sub_recipe: 'sub_recipe',
} as const
export type RecipeClass = (typeof RecipeClass)[keyof typeof RecipeClass]
export type Ingredient = {
  id: GeneratedAlways<number>
  slug: string
  name: string
  category: string
  purchaseUnit: string
  purchaseCost: number
  includesVat: number
  conversionRule: string | null
  supplierId: number | null
  notes: string | null
  lastPurchased: string | null
}
export type Recipe = {
  id: GeneratedAlways<number>
  /**
   * Slugified name for the supplier, used for linking when importing
   */
  slug: string
  name: string
  /**
   * Metadata for usage
   */
  stage: Generated<RecipeStage>
  class: Generated<RecipeClass>
  category: string | null
  /**
   * What we are selling at
   */
  sellPrice: number
  /**
   * Do we need to strip vat from the above
   */
  includesVat: Generated<number>
  /**
   * The taget profit margin.
   */
  targetMargin: Generated<number>
  yieldAmount: number | null
  yieldUnit: string | null
  parentId: number | null
}
export type RecipeIngredients = {
  id: GeneratedAlways<number>
  recipeId: number
  ingredientId: number | null
  subRecipeId: number | null
  unit: string
  notes: string | null
}
export type Supplier = {
  id: GeneratedAlways<number>
  /**
   * Slugified name for the supplier, used for linking ingredients
   */
  slug: string
  name: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  notes: string | null
}
export type DB = {
  Ingredient: Ingredient
  Recipe: Recipe
  RecipeIngredients: RecipeIngredients
  Supplier: Supplier
}
