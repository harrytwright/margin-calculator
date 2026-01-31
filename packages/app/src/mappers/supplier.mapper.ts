import { register } from '@harrytwright/api/dist/core'
import { InternalServerError } from '@hndlr/errors'
import type { Supplier } from '@menubook/types'
import { Insertable, Selectable, Updateable } from 'kysely'

import { Base } from './base'

import { SupplierApiData, supplierApiSchema } from '../schemas'

// Will add a generator next to generate these from OpenAPI schema
export type JSONSupplier = Pick<Selectable<Supplier>, 'slug' | 'name'> & {
  notes?: string
  contact?: {
    name?: string
    email?: string
    phone?: string
  }
}

@register('singleton')
export class SupplierMapper extends Base<
  Supplier,
  JSONSupplier,
  SupplierApiData
> {
  mapEntityToJSON(entity: Partial<Selectable<Supplier>>): JSONSupplier {
    if (!entity.slug || !entity.name) {
      throw new InternalServerError(
        'Cannot map supplier entity to JSON - missing slug or name'
      )
    }

    const hasContact =
      entity.contactName || entity.contactEmail || entity.contactPhone

    return {
      name: entity.name,
      slug: entity.slug,
      notes: entity.notes ?? undefined,
      contact: hasContact
        ? {
            name: entity.contactName ?? undefined,
            email: entity.contactEmail ?? undefined,
            phone: entity.contactPhone ?? undefined,
          }
        : undefined,
    }
  }

  mapJSONToEntity(
    json: SupplierApiData
  ): Insertable<Supplier> | Updateable<Supplier> {
    const parsed = supplierApiSchema.parse(json)
    return {
      slug: parsed.slug,
      name: parsed.name,
      contactName: parsed.contactName,
      contactEmail: parsed.contactEmail,
      contactPhone: parsed.contactPhone,
      notes: parsed.notes,
    }
  }
}
