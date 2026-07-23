import { z } from 'zod'

import {
  decimalLikeToStringSchema,
  nonEmptyStringSchema,
  nullableStringSchema,
  pricingInputSchema,
  timestampSchema,
} from './common'

const recipeStageSchema = z.enum(['development', 'active', 'discontinued'])
const recipeClassSchema = z.enum(['menu_item', 'base_template', 'sub_recipe'])

export const recipeCreateSchema = z
  .object({
    slug: nonEmptyStringSchema,
    name: nonEmptyStringSchema,
    stage: recipeStageSchema.optional(),
    class: recipeClassSchema.optional(),
    category: nullableStringSchema,
    targetMargin: z.number().int().nonnegative().optional(),
    yieldAmount: decimalLikeToStringSchema.nullable().optional(),
    yieldUnit: nullableStringSchema,
    parentId: z.number().int().nullable().optional(),
  })
  .strip()

export const recipeUpdateSchema = recipeCreateSchema.partial().strip()

export const recipePriceInputSchema = z
  .object({
    vat: z.boolean(),
    validFrom: timestampSchema.optional(),
    validTo: timestampSchema.nullable().optional(),
  })
  .strip()

export const recipePricingInputSchema =
  recipePriceInputSchema.merge(pricingInputSchema)

const recipeIngredientBaseSchema = z
  .object({
    quantity: decimalLikeToStringSchema,
    unit: nonEmptyStringSchema,
    notes: nullableStringSchema,
  })
  .strip()

const recipeIngredientIdObjectSchema = z
  .object({
    ingredientId: z.number().int().positive().nullable().optional(),
    subRecipeId: z.number().int().positive().nullable().optional(),
  })
  .strip()

const recipeIngredientSlugSchema = z
  .object({
    type: z.enum(['ingredient', 'recipe']),
    slug: nonEmptyStringSchema,
  })
  .strip()

export const recipeIngredientInputSchema = z.union([
  recipeIngredientBaseSchema
    .merge(recipeIngredientIdObjectSchema)
    .refine((data) => data.ingredientId || data.subRecipeId, {
      message: 'Either ingredientId or subRecipeId is required',
    })
    .refine((data) => !(data.ingredientId && data.subRecipeId), {
      message: 'Only one of ingredientId or subRecipeId is allowed',
    }),
  recipeIngredientBaseSchema.merge(recipeIngredientSlugSchema),
])

export const recipeIngredientInputArraySchema = z.array(
  recipeIngredientInputSchema
)

export const recipeIngredientDeleteSchema = nonEmptyStringSchema
