import { promises as fs } from 'fs'
import path from 'path'

import Database from 'better-sqlite3'
import {
  FileMigrationProvider,
  Kysely,
  Migrator,
  ParseJSONResultsPlugin,
  SqliteDialect,
  type MigrationResult,
} from 'kysely'

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
 * Create a new SQLite database instance.
 *
 * @param dbPath - Path to the SQLite database file, or ':memory:' for in-memory
 * @returns Kysely instance configured for SQLite
 */
export function createDatabase(dbPath: string = ':memory:'): Kysely<DB> {
  // Don't cache in-memory databases - each should be independent (important for tests)
  if (dbPath === ':memory:') {
    return new Kysely<DB>({
      dialect: new SqliteDialect({
        database: Database(dbPath),
      }),
      plugins: [new ParseJSONResultsPlugin()],
    })
  }

  if (!databases.has(dbPath)) {
    databases.set(
      dbPath,
      new Kysely<DB>({
        dialect: new SqliteDialect({
          database: Database(dbPath),
        }),
        plugins: [new ParseJSONResultsPlugin()],
      })
    )
  }

  return databases.get(dbPath)!
}

/**
 * Destroy a database connection and remove it from the cache.
 *
 * @param dbPath - Path to the database to destroy
 */
export async function destroy(dbPath: string = ':memory:'): Promise<void> {
  const db = databases.get(dbPath)
  if (db) {
    databases.delete(dbPath)
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
