import { z } from 'zod'

export const nonEmptyStringSchema = z.string().min(1)
export const nullableStringSchema = z.string().nullable().optional()

export const idSchema = z.number().int().positive()

export const integerStringSchema = z.string().regex(/^\d+$/)
export const decimalStringSchema = z.string().regex(/^\d+(\.\d+)?$/)

export const intLikeSchema = z.union([
  z.number().int().nonnegative(),
  integerStringSchema,
])

export const decimalLikeSchema = z.union([
  z.number().nonnegative(),
  decimalStringSchema,
])

export const intLikeToStringSchema = intLikeSchema.transform((value) =>
  String(value)
)

export const decimalLikeToStringSchema = decimalLikeSchema.transform((value) =>
  String(value)
)

export const timestampSchema = z.union([z.string(), z.date()])

export const currencySchema = z.string().length(3)

export const pricingInputSchema = z
  .object({
    cost: intLikeToStringSchema,
    currency: currencySchema,
  })
  .strip()
