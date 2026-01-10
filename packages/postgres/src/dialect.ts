import { promises as fs } from 'fs'
import path from 'path'

import {
  FileMigrationProvider,
  Kysely,
  Migrator,
  PostgresDialect,
  type MigrationResult,
} from 'kysely'
import { Pool } from 'pg'

import type { DB } from '@menubook/types'

// Database instance cache
const databases = new Map<string, Kysely<DB>>()

/**
 * Get the path to the migrations directory.
 */
export function getMigrationsPath(): string {
  return path.join(__dirname, 'migrations')
}

/**
 * Create a new PostgreSQL database instance.
 *
 * @param connectionString - PostgreSQL connection string (e.g., 'postgresql://user:pass@localhost/db')
 * @returns Kysely instance configured for PostgreSQL
 */
export function createDatabase(connectionString: string): Kysely<DB> {
  if (!databases.has(connectionString)) {
    databases.set(
      connectionString,
      new Kysely<DB>({
        dialect: new PostgresDialect({
          pool: new Pool({ connectionString }),
        }),
      })
    )
  }

  return databases.get(connectionString)!
}

/**
 * Destroy a database connection and remove it from the cache.
 *
 * @param connectionString - Connection string of the database to destroy
 */
export async function destroy(connectionString: string): Promise<void> {
  const db = databases.get(connectionString)
  if (db) {
    databases.delete(connectionString)
    await db.destroy()
  }
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
