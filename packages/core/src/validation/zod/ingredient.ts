import { z } from 'zod'

import {
  decimalLikeToStringSchema,
  intLikeToStringSchema,
  nonEmptyStringSchema,
  nullableStringSchema,
  pricingInputSchema,
  timestampSchema,
} from './common'

export const ingredientCreateSchema = z
  .object({
    slug: nonEmptyStringSchema,
    name: nonEmptyStringSchema,
    category: nonEmptyStringSchema,
    conversionRule: nullableStringSchema,
    supplierId: z.number().int().nullable().optional(),
    notes: nullableStringSchema,
    lastPurchased: timestampSchema.nullable().optional(),
    allergensContains: intLikeToStringSchema.optional(),
    allergensMayContain: intLikeToStringSchema.optional(),
    glutenCereals: nullableStringSchema,
    treeNuts: nullableStringSchema,
  })
  .strip()

export const ingredientUpdateSchema = ingredientCreateSchema.partial().strip()

export const ingredientSupplierRefSchema = z.union([
  z.number().int().positive(),
  nonEmptyStringSchema,
])

export const ingredientCostInputSchema = z
  .object({
    unit: nonEmptyStringSchema,
    vat: z.boolean(),
    validFrom: timestampSchema.optional(),
    validTo: timestampSchema.nullable().optional(),
  })
  .strip()

export const ingredientPricingInputSchema =
  ingredientCostInputSchema.merge(pricingInputSchema)

export const ingredientQuantitySchema = decimalLikeToStringSchema
