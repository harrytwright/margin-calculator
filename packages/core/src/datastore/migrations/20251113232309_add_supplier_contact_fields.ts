import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('Supplier')
    .addColumn('contactName', 'text')
    .execute()

  await db.schema
    .alterTable('Supplier')
    .addColumn('contactEmail', 'text')
    .execute()

  await db.schema
    .alterTable('Supplier')
    .addColumn('contactPhone', 'text')
    .execute()

  await db.schema.alterTable('Supplier').addColumn('notes', 'text').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('Supplier').dropColumn('contactName').execute()
  await db.schema.alterTable('Supplier').dropColumn('contactEmail').execute()
  await db.schema.alterTable('Supplier').dropColumn('contactPhone').execute()
  await db.schema.alterTable('Supplier').dropColumn('notes').execute()
}
