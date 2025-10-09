import { Kysely } from 'kysely'

import type { DB } from '../datastore/types'
import { Importer, type ImportResult } from '../lib/importer'
import type { SupplierImportData, SupplierResolvedImportData } from '../schema'
import { hasChanges } from '../utils/has-changes'

export class SupplierService {
  constructor(private database: Kysely<DB>) {}

  async exists(slug: string) {
    return !!(await this.database
      .selectFrom('Supplier')
      .select('id')
      .where('slug', '=', slug)
      .executeTakeFirst())
  }

  findById(slug: string) {
    return this.database
      .selectFrom('Supplier')
      .select(['id', 'name'])
      .where('slug', '=', slug)
      .executeTakeFirst()
  }

  upsert(slug: string, data: SupplierImportData | SupplierResolvedImportData) {
    return this.database
      .insertInto('Supplier')
      .values({
        slug,
        name: data.name,
      })
      .onConflict((oc) =>
        oc.column('slug').doUpdateSet({
          name: data.name,
        })
      )
      .executeTakeFirst()
  }

  async processor(
    importer: Importer,
    data: SupplierResolvedImportData,
    filePath: string | undefined
  ): Promise<ImportResult> {
    // Load up the previous data if it exists
    const prev = await this.findById(data.slug)

    // Check if any mutable fields have changed
    const hasChanged = hasChanges(prev, data, {
      name: 'name',
    })

    if (prev && !hasChanged) return 'ignored'

    await this.upsert(data.slug, data)

    return prev ? 'upserted' : 'created'
  }
}
