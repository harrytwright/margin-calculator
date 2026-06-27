import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('Settings')
    .addColumn('id', 'integer', (col) =>
      col.primaryKey().notNull().defaultTo(1).check(sql`id = 1`)
    )
    .addColumn('vatRateBps', 'integer', (col) => col.notNull().defaultTo(2000))
    .addColumn('marginTarget', 'integer', (col) => col.notNull().defaultTo(20))
    .addColumn('defaultPriceIncludesVat', 'boolean', (col) =>
      col.notNull().defaultTo(true)
    )
    .execute()

  await db
    .insertInto('Settings')
    .values({
      id: 1,
      vatRateBps: 2000,
      marginTarget: 20,
      defaultPriceIncludesVat: true,
    })
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('Settings').ifExists().execute()
}
