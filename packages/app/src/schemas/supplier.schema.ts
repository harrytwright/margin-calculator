import { z } from 'zod'

/**
 * API schema for supplier creation/update
 * Simpler than CLI import schema - no reference resolution needed
 */
export const supplierApiSchema = z.object({
  slug: z.string().optional(),
  name: z.string().min(1, 'Supplier name is required'),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
})

export type SupplierApiData = z.infer<typeof supplierApiSchema>

/**
 * Maps API data to core's resolved format
 */
export function toSupplierData(data: SupplierApiData, slug: string) {
  return {
    slug,
    name: data.name,
  }
}
