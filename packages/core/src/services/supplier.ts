import { NotFound } from '@hndlr/errors'
import { DB, Supplier } from '@menubook/types'
import { Insertable, Selectable, Transaction, Updateable } from 'kysely'

import type { DatabaseContext } from '../datastore/context'
import { handleError } from '../datastore/handleError'
import { Importer, type ImportOutcome } from '../lib/importer'
import type { SupplierResolvedImportData } from '../schema'
import { hasChanges } from '../utils'

export class SupplierService {
  constructor(private context: DatabaseContext) {}

  get database() {
    return this.context.db
  }

  async exists(slug: string, trx?: Transaction<DB>) {
    return !!(await (trx ?? this.database)
      .selectFrom('Supplier')
      .select('id')
      .where('slug', '=', slug)
      .executeTakeFirst())
  }

  findById(slug: string, trx?: Transaction<DB>): Promise<Selectable<Supplier>> {
    return (trx ?? this.database)
      .selectFrom('Supplier')
      .selectAll('Supplier')
      .where('slug', '=', slug)
      .executeTakeFirstOrThrow(handleError({ slug }))
  }

  upsert(
    slug: string,
    data: Insertable<Supplier> | Updateable<Supplier>,
    trx?: Transaction<DB>
  ) {
    return (trx ?? this.database)
      .insertInto('Supplier')
      .values({
        slug,
        name: data.name ?? slug,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        notes: data.notes,
      })
      .onConflict((oc) =>
        oc.column('slug').doUpdateSet({
          name: data.name,
          contactName: data.contactName,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
          notes: data.notes,
        })
      )
      .executeTakeFirst()
  }

  async delete(slug: string, trx?: Transaction<DB>) {
    const result = await (trx ?? this.database)
      .deleteFrom('Supplier')
      .where('slug', '=', slug)
      .executeTakeFirst()

    return result.numDeletedRows > 0n
  }

  async find(trx?: Transaction<DB>) {
    return (trx ?? this.database)
      .selectFrom('Supplier')
      .selectAll('Supplier')
      .execute()
  }

  async processor(
    importer: Importer,
    data: SupplierResolvedImportData,
    filePath: string | undefined,
    trx?: Transaction<DB>
  ): Promise<ImportOutcome> {
    const query = async (trx: Transaction<DB>) => {
      // Workaround for the throwing on findById
      let prev: Selectable<Supplier> | undefined = undefined
      try {
        // Load up the previous data if it exists
        prev = await this.findById(data.slug, trx)
      } catch (e) {
        if (!(e instanceof NotFound)) throw e
      }

      // Check if any mutable fields have changed
      const hasChanged = hasChanges(prev, data, {
        name: 'name',
      })

      if (prev && !hasChanged) return 'ignored'

      const res = await this.upsert(data.slug, data, trx)
      if (res.insertId === undefined)
        throw new Error('Failed to upsert supplier')

      return prev ? 'upserted' : 'created'
    }

    return trx ? query(trx) : this.database.transaction().execute(query)
  }
}
