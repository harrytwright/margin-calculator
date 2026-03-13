import { z } from 'zod'

import { nonEmptyStringSchema, nullableStringSchema } from './common'

export const supplierContactSchema = z
  .object({
    name: nullableStringSchema,
    email: nullableStringSchema,
    phone: nullableStringSchema,
  })
  .strip()

const supplierBaseSchema = z
  .object({
    slug: nonEmptyStringSchema,
    name: nonEmptyStringSchema,
    notes: nullableStringSchema,
  })
  .strip()

export const supplierCreateSchema = supplierBaseSchema
  .extend({
    contact: supplierContactSchema.optional(),
  })
  .strip()

export const supplierUpdateSchema = supplierCreateSchema.partial().strip()

export const supplierUpsertSchema = supplierCreateSchema
  .extend({
    slug: nonEmptyStringSchema.optional(),
  })
  .strip()
