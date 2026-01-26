import { Selectable } from 'kysely'

import type { DatabaseContext } from '../datastore/context'
import { Importer, type ImportOutcome } from '../lib/importer'
import type { SupplierImportData, SupplierResolvedImportData } from '../schema'
import { hasChanges } from '../utils'
import {Supplier} from "@menubook/types";
import {handleError} from "../datastore/handleError";

export class SupplierService {
  constructor(private context: DatabaseContext) {}

  private get database() {
    return this.context.db
  }

  async exists(slug: string) {
    return !!(await this.database
      .selectFrom('Supplier')
      .select('id')
      .where('slug', '=', slug)
      .executeTakeFirst())
  }

  findById(slug: string): Promise<Selectable<Supplier>> {
    return this.database
      .selectFrom('Supplier')
      .select(['id', 'slug', 'name', 'contactEmail', 'contactName', 'contactPhone', 'notes'])
      .where('slug', '=', slug)
      .executeTakeFirstOrThrow(handleError({ slug }))
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

  async delete(slug: string) {
    const result = await this.database
      .deleteFrom('Supplier')
      .where('slug', '=', slug)
      .executeTakeFirst()

    return result.numDeletedRows > 0n
  }

  async find () {
    return this.database
      .selectFrom('Supplier')
      .select(['id', 'slug', 'name'])
      .execute()
  }

  async processor(
    importer: Importer,
    data: SupplierResolvedImportData,
    filePath: string | undefined
  ): Promise<ImportOutcome> {
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
