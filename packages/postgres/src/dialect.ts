import type { DB } from '@menubook/types'
import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'

// Database instance cache
const databases = new Map<string, Kysely<DB>>()

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
