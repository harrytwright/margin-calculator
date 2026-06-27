import { promises as fs } from 'fs'
import path from 'path'

import {
  FileMigrationProvider,
  Kysely,
  MigrationResult,
  Migrator,
} from 'kysely'

import { DB } from '@menubook/shared'

/**
 * Get the path to the migrations directory.
 */
export function getMigrationsPath(): string {
  return path.join(__dirname, 'migrations')
}

/**
 * Run database migrations.
 *
 * @param db - Kysely database instance
 * @param direction - Migration direction ('up' or 'down')
 * @param migrationPath - Path to migrations directory (defaults to built-in migrations)
 * @returns Migration result with success status and any errors
 */
export async function migrate(
  db: Kysely<DB>,
  direction: 'up' | 'down' = 'up',
  migrationPath: string = getMigrationsPath()
): Promise<{ success: boolean; results?: MigrationResult[]; error?: unknown }> {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.normalize(migrationPath),
    }),
  })

  const { error, results } =
    direction === 'up'
      ? await migrator.migrateToLatest()
      : await migrator.migrateDown()

  if (error) {
    return { success: false, results, error }
  }

  return { success: true, results }
}

/**
 * Seed the database with initial data.
 *
 * @param db - Kysely database instance
 */
export async function seed(db: Kysely<DB>): Promise<void> {
  await db
    .insertInto('Supplier')
    .values({
      slug: 'generic',
      name: 'Generic Supplier',
    })
    .onConflict((oc) => oc.column('slug').doNothing())
    .execute()

  await db
    .insertInto('Settings')
    .values({
      id: 1,
      vatRateBps: 2000,
      marginTarget: 20,
      defaultPriceIncludesVat: 1 as any,
    } as any)
    .onConflict((oc) => oc.column('id').doNothing())
    .execute()
}
