import type { DB } from '@menubook/shared'
import Database from 'better-sqlite3'
import { Kysely, ParseJSONResultsPlugin, SqliteDialect } from 'kysely'

// Database instance cache
const databases = new Map<string, Kysely<DB>>()

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
