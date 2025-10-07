import { z } from 'zod'

/**
 * Import schemas for validating YAML/JSON files
 * These schemas are used for file imports and may differ from the database schema
 */

// Base schema with object type discriminator
const baseImportSchema = z.object({
  object: z.string(),
  data: z.unknown(),
})

// Ingredient import schema
export const ingredientImportDataSchema = z.object({
  slug: z.string().optional(),
  name: z.string().min(1, 'Ingredient name is required'),
  category: z.string().min(1, 'Category is required'),
  purchaseUnit: z
    .string()
    .min(1, "Purchase unit is required (e.g., '120g', '1 loaf')"),
  purchaseCost: z.number().positive('Purchase cost must be positive'),
  includesVat: z.boolean().optional().default(false),
  supplierId: z.string().optional(), // Slug, not ID - will be resolved during import
  conversionRate: z.string().optional(), // e.g., "1 loaf = 16 slices"
  notes: z.string().optional(),
  lastPurchased: z.string().datetime().optional(),
})

export const ingredientImportSchema = z.object({
  object: z.literal('ingredient'),
  data: ingredientImportDataSchema,
})

// Recipe ingredient reference schema (for use within recipes)
export const recipeIngredientReferenceSchema = z
  .object({
    ingredient: z.string().optional(), // Slug of ingredient
    recipe: z.string().optional(), // Slug of sub-recipe
    unit: z.string().min(1, "Unit is required (e.g., '50g', '2 slices')"),
    notes: z.string().optional(),
  })
  .refine(
    (data) => data.ingredient || data.recipe,
    "Either 'ingredient' or 'recipe' must be specified"
  )

// Recipe import schema
export const recipeImportDataSchema = z.object({
  slug: z.string().optional(), // Optional - will be generated from name if not provided
  name: z.string().min(1, 'Recipe name is required'),
  stage: z
    .enum(['development', 'active', 'discontinued'])
    .default('development'),
  class: z
    .enum(['menu_item', 'base_template', 'sub_recipe'])
    .default('menu_item'),
  category: z.string().optional(),
  sellPrice: z
    .number()
    .int()
    .nonnegative('Sell price must be non-negative (in pence)'),
  includesVat: z.boolean().default(true),
  targetMargin: z.number().int().min(0).max(100).default(20),
  // For sub-recipes
  yieldAmount: z.number().positive().optional(),
  yieldUnit: z.string().optional(),
  // For inheritance
  parent: z.string().optional(), // Slug of parent recipe
  // Ingredients list
  ingredients: z.array(recipeIngredientReferenceSchema).default([]),
})

export const recipeImportSchema = z.object({
  object: z.literal('recipe'),
  data: recipeImportDataSchema,
})

// Union type for any import
export const importSchema = z.discriminatedUnion('object', [
  ingredientImportSchema,
  recipeImportSchema,
])

// Type exports
export type IngredientImportData = z.infer<typeof ingredientImportDataSchema>
export type RecipeImportData = z.infer<typeof recipeImportDataSchema>
export type RecipeIngredientReference = z.infer<
  typeof recipeIngredientReferenceSchema
>
export type ImportData = z.infer<typeof importSchema>

/**
 * Helper function to validate and parse import data
 */
export function parseImportFile(data: unknown): ImportData {
  return importSchema.parse(data)
}

/**
 * Helper to check import type
 */
export function isIngredientImport(
  data: ImportData
): data is z.infer<typeof ingredientImportSchema> {
  return data.object === 'ingredient'
}

export function isRecipeImport(
  data: ImportData
): data is z.infer<typeof recipeImportSchema> {
  return data.object === 'recipe'
}
