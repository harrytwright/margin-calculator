import { promises as fs } from 'fs'
import path from 'path'

import {
  FileMigrationProvider,
  Kysely,
  Migrator,
  type MigrationResult,
} from 'kysely'

import type { DB } from '@menubook/types'

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
  // Seed the generic supplier (used as default for ingredients without a specific supplier)
  await db
    .insertInto('Supplier')
    .values({
      slug: 'generic',
      name: 'Generic Supplier',
    })
    .onConflict((oc) => oc.column('slug').doNothing())
    .execute()
}
