import { z } from 'zod'
import type { IngredientResolvedImportData } from '@menubook/core'

/**
 * API schema for ingredient creation/update
 * Simpler than CLI import schema:
 * - supplier is just a slug string (not { uses: "slug:..." })
 * - no path references to resolve
 */
export const ingredientApiSchema = z.object({
  slug: z.string().optional(),
  name: z.string().min(1, 'Ingredient name is required'),
  category: z.string().min(1, 'Category is required'),
  purchase: z.object({
    cost: z.number().positive('Purchase cost must be positive'),
    unit: z.string().min(1, "Purchase unit is required (e.g., '120g', '1 loaf')"),
    vat: z.boolean().optional().default(false),
  }),
  supplier: z.string().optional(), // Just a slug, defaults to 'generic'
  conversionRate: z.string().optional(),
  notes: z.string().optional(),
  lastPurchased: z.string().datetime().optional(),
})

export type IngredientApiData = z.infer<typeof ingredientApiSchema>

/**
 * Maps API data to core's resolved format
 */
export function toIngredientData(
  data: IngredientApiData,
  slug: string
): IngredientResolvedImportData {
  return {
    slug,
    name: data.name,
    category: data.category,
    purchase: {
      cost: data.purchase.cost,
      unit: data.purchase.unit,
      vat: data.purchase.vat,
    },
    supplier: data.supplier ? { slug: data.supplier } : undefined,
    conversionRate: data.conversionRate,
    notes: data.notes,
    lastPurchased: data.lastPurchased,
  }
}
