import { Kysely } from 'kysely'

import { DB } from '../datastore/types'
import { SupplierImportData } from '../schema'

export function findById(this: Kysely<DB>, slug: string) {
  return this.selectFrom('Supplier')
    .select(['id', 'name'])
    .where('slug', '=', slug)
    .executeTakeFirst()
}

export function upsert(
  this: Kysely<DB>,
  slug: string,
  data: SupplierImportData
) {
  return this.insertInto('Supplier')
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

export async function exists(this: Kysely<DB>, slug: string) {
  return !!(await this.selectFrom('Supplier')
    .select('id')
    .where('slug', '=', slug)
    .executeTakeFirst())
}
