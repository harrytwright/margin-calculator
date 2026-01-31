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

/**
 * Generic reference schema
 * Supports:
 * - Absolute paths: @/ingredients/ham.yaml
 * - Relative paths: ./cheese.yaml or ../ingredients/cheese.yaml
 * - Slug references: slug:hovis-thick-white-bread
 */
export const referenceSchema = z
  .string()
  .min(1)
  .refine(
    (val) => {
      return (
        val.startsWith('@/') ||
        val.startsWith('./') ||
        val.startsWith('../') ||
        val.startsWith('slug:')
      )
    },
    { message: 'Reference must be a path (@/, ./, ../) or slug (slug:name)' }
  )

// Supplier reference schema
export const supplierReferenceSchema = z.object({
  uses: referenceSchema,
})

export const ingredientImportPurchaseSchema = z.object({
  cost: z.number().int().nonnegative('Purchase cost must be non-negative'), // in pence
  unit: z.string().min(1, "Purchase unit is required (e.g., '120g', '1 loaf')"),
  vat: z.boolean().optional().default(false),
})

// Ingredient import schema
export const ingredientImportDataSchema = z.object({
  slug: z.string().optional(),
  name: z.string().min(1, 'Ingredient name is required'),
  category: z.string().min(1, 'Category is required'),
  purchase: ingredientImportPurchaseSchema,
  supplier: supplierReferenceSchema.optional(),
  conversionRate: z.string().optional(), // e.g., "1 loaf = 16 slices"
  notes: z.string().optional(),
  lastPurchased: z.string().datetime().optional(),
})

export const ingredientImportSchema = z.object({
  object: z.literal('ingredient'),
  data: ingredientImportDataSchema,
})

// Supplier import schema
export const supplierImportDataSchema = z.object({
  slug: z.string().optional(), // Optional - will be generated from name if not provided
  name: z.string().min(1, 'Supplier name is required'),
  contactName: z.string().optional(),
  contactEmail: z.email().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
})

export const supplierImportSchema = z.object({
  object: z.literal('supplier'),
  data: supplierImportDataSchema,
})

// Recipe ingredient reference schema (uses/with pattern)
export const recipeIngredientReferenceSchema = z.object({
  uses: referenceSchema,
  type: z
    .enum(['ingredient', 'recipe'])
    .optional()
    .describe(
      'Optional type hint. If not specified, will auto-detect from database. Warning: specifying incorrect type has no effect - actual type is always used.'
    ),
  with: z.object({
    unit: z.string().min(1, "Unit is required (e.g., '50g', '2 slices')"),
    notes: z.string().optional(),
  }),
})

// Recipe costing schema (all fields optional for inheritance)
export const recipeImportCostingSchema = z.object({
  price: z
    .number()
    .int()
    .nonnegative('Price must be non-negative (in pence)')
    .optional(),
  margin: z.number().int().min(0).max(100).optional(),
  vat: z.boolean().optional(),
})

// Recipe import schema
export const recipeImportDataSchema = z
  .object({
    slug: z.string().optional(), // Optional - will be generated from name if not provided
    name: z.string().min(1, 'Recipe name is required'),
    stage: z
      .enum(['development', 'active', 'discontinued'])
      .default('development'),
    class: z
      .enum(['menu_item', 'base_template', 'sub_recipe'])
      .default('menu_item'),
    category: z.string().optional(),
    // Parent recipe reference
    extends: referenceSchema.optional(),
    // Costing (optional - can inherit from parent)
    costing: recipeImportCostingSchema.optional(),
    // For sub-recipes
    yieldAmount: z.number().positive().optional(),
    yieldUnit: z.string().optional(),
    // Ingredients list
    ingredients: z.array(recipeIngredientReferenceSchema).default([]),
  })
  .refine(
    (data) => {
      // If no parent recipe, costing.price is required
      if (!data.extends) {
        return data.costing?.price !== undefined
      }
      return true
    },
    {
      message:
        'costing.price is required when no parent recipe (extends) is specified',
      path: ['costing', 'price'],
    }
  )

export const recipeImportSchema = z.object({
  object: z.literal('recipe'),
  data: recipeImportDataSchema,
})

// Union type for any import
export const importSchema = z.discriminatedUnion('object', [
  supplierImportSchema,
  ingredientImportSchema,
  recipeImportSchema,
])

// Type exports
export type SupplierImportData = z.infer<typeof supplierImportDataSchema>
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
export function isSupplierImport(
  data: ImportData
): data is z.infer<typeof supplierImportSchema> {
  return data.object === 'supplier'
}

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

/**
 * Reference type utilities
 */
export type ReferenceType = 'absolute' | 'relative' | 'slug'
export type SupplierReference = z.infer<typeof supplierReferenceSchema>

/**
 * Resolved reference types (after slug resolution)
 */
export interface SupplierResolvedReference {
  slug: string
}

export type IngredientResolvedImportData = Omit<
  IngredientImportData,
  'supplier'
> & {
  slug: string // Always present after resolution
  supplier?: SupplierResolvedReference
}

export interface RecipeIngredientResolvedReference {
  slug: string // Resolved from 'uses'
  type: 'ingredient' | 'recipe' // Always present after resolution
  with: {
    unit: string
    notes?: string
  }
}

export type RecipeResolvedImportData = Omit<
  RecipeImportData,
  'extends' | 'ingredients'
> & {
  slug: string // Always present after resolution
  parentSlug?: string // Resolved from 'extends'
  ingredients: RecipeIngredientResolvedReference[]
}

export type SupplierResolvedImportData = SupplierImportData & {
  slug: string // Always present after resolution
}

export type ResolvedImportData =
  | SupplierResolvedImportData
  | IngredientResolvedImportData
  | RecipeResolvedImportData

export interface ParsedReference {
  type: ReferenceType
  value: string // Path or slug
  slug?: string // For slug type, the extracted slug value
}

/**
 * Parse a reference string into its components
 */
export function parseReference(ref: string): ParsedReference {
  if (ref.startsWith('slug:')) {
    return {
      type: 'slug',
      value: ref,
      slug: ref.slice(5), // Remove 'slug:' prefix
    }
  }

  // If missing an extension, throw
  if (!ref.endsWith('.yaml'))
    throw new Error(`Invalid reference: ${ref}. Must end with .yaml extension`)

  if (ref.startsWith('@/')) {
    return {
      type: 'absolute',
      value: ref,
    }
  }

  if (ref.startsWith('./') || ref.startsWith('../')) {
    return {
      type: 'relative',
      value: ref,
    }
  }

  throw new Error(
    `Invalid reference: ${ref}. Must start with @/, ./, ../, or slug:`
  )
}

/**
 * Check if a reference is a path (absolute or relative)
 */
export function isPathReference(ref: string): boolean {
  return ref.startsWith('@/') || ref.startsWith('./') || ref.startsWith('../')
}

/**
 * Check if a reference is a slug
 */
export function isSlugReference(ref: string): boolean {
  return ref.startsWith('slug:')
}
