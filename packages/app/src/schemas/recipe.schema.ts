import type { RecipeResolvedImportData } from '@menubook/core'
import { z } from 'zod'

/**
 * API schema for recipe creation/update
 * Clean API format - no slug: prefixes, direct references
 */
export const recipeApiSchema = z.object({
  slug: z.string().optional(),
  name: z.string().min(1, 'Recipe name is required'),
  stage: z
    .enum(['development', 'active', 'discontinued'])
    .default('development'),
  class: z
    .enum(['menu_item', 'base_template', 'sub_recipe'])
    .default('menu_item'),
  category: z.string().optional(),
  extends: z.string().optional(), // Parent recipe slug (direct, not slug:xxx)
  costing: z
    .object({
      price: z.number().int().nonnegative().optional(),
      margin: z.number().int().min(0).max(100).optional(),
      vat: z.boolean().optional(),
    })
    .optional(),
  yieldAmount: z.number().positive().optional(),
  yieldUnit: z.string().optional(),
  ingredients: z
    .array(
      z.object({
        slug: z.string().min(1), // Direct slug reference
        type: z.enum(['ingredient', 'recipe']).optional(), // Auto-detect if omitted
        unit: z.string().min(1, 'Unit is required'),
        notes: z.string().optional(),
      })
    )
    .default([]),
})

export type RecipeApiData = z.infer<typeof recipeApiSchema>

/**
 * Maps API data to core's resolved format
 */
export function toRecipeData(
  data: RecipeApiData,
  slug: string,
  ingredientTypes: Map<string, 'ingredient' | 'recipe'>
): RecipeResolvedImportData {
  return {
    slug,
    name: data.name,
    stage: data.stage,
    class: data.class,
    category: data.category,
    parentSlug: data.extends,
    costing: data.costing,
    yieldAmount: data.yieldAmount,
    yieldUnit: data.yieldUnit,
    ingredients: data.ingredients.map((ing) => ({
      slug: ing.slug,
      type: ing.type || ingredientTypes.get(ing.slug) || 'ingredient',
      with: {
        unit: ing.unit,
        notes: ing.notes,
      },
    })),
  }
}
