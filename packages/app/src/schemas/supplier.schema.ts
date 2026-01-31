import { z } from 'zod'

// Transform empty strings to undefined for optional fields
const emptyToUndefined = (val: string | undefined) =>
  val === '' ? undefined : val

/**
 * API schema for supplier creation/update
 * Simpler than CLI import schema - no reference resolution needed
 */
export const supplierApiSchema = z.object({
  slug: z.string().optional(),
  name: z.string().min(1, 'Supplier name is required'),
  contactName: z.preprocess(emptyToUndefined, z.string().optional()),
  contactEmail: z.preprocess(
    emptyToUndefined,
    z.string().email('Invalid email address').optional()
  ),
  contactPhone: z.preprocess(emptyToUndefined, z.string().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().optional()),
})

export type SupplierApiData = z.infer<typeof supplierApiSchema>

/**
 * Maps API data to core's resolved format
 */
export function toSupplierData(data: SupplierApiData, slug: string) {
  return {
    slug,
    name: data.name,
    contactName: data.contactName,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone,
    notes: data.notes,
  }
}
