import type { DBIngredient } from '@menubook/core'

import { JSONSupplier } from './supplier.mapper'

// Will add a generator next to generate these from OpenAPI schema
export type JSONIngredient = Pick<
  DBIngredient,
  'slug' | 'name' | 'category'
> & {
  notes?: string
  purchase: {
    unit: string
    cost: number
    vat: boolean
  }
  conversionRule?: string
  lastPurchased?: string
  supplier?: JSONSupplier | string
}
//
// @register('singleton')
// export class IngredientMapper extends Base<
//   DBIngredient | DBIngredientWithSupplier,
//   JSONIngredient,
//   IngredientImportData
// > {
//   mapEntityToJSON(entity: Partial<Selectable<Supplier>>): JSONIngredient {
//     if (!entity.slug || !entity.name) {
//       throw new InternalServerError(
//         'Cannot map supplier entity to JSON - missing slug or name'
//       )
//     }
//
//     const hasContact =
//       entity.contactName || entity.contactEmail || entity.contactPhone
//
//     return {
//       name: entity.name,
//       slug: entity.slug,
//       notes: entity.notes ?? undefined,
//       contact: hasContact
//         ? {
//             name: entity.contactName ?? undefined,
//             email: entity.contactEmail ?? undefined,
//             phone: entity.contactPhone ?? undefined,
//           }
//         : undefined,
//     }
//   }
//
//   mapJSONToEntity(
//     json: IngredientImportData
//   ): Insertable<Ingredient> | Updateable<Ingredient> {
//     const parsed = ingredientApiSchema.parse(json)
//     return {
//       slug: parsed.slug,
//       name: parsed.name,
//       contactName: parsed.contactName,
//       contactEmail: parsed.contactEmail,
//       contactPhone: parsed.contactPhone,
//       notes: parsed.notes,
//     }
//   }
// }
