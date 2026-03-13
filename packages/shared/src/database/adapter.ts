import { DB } from '@menubook/prisma'
import type { Kysely, MigrationResult } from 'kysely'

import type { JsonHelpers } from './context'

/**
 * Database adapter interface.
 * Each adapter (SQLite, PostgreSQL) must implement this interface.
 */
export interface DatabaseAdapter {
  /** Create a new Kysely database instance */
  createDatabase(connectionStringOrPath: string): Kysely<DB>

  /** Destroy a database connection */
  destroy(connectionStringOrPath: string): Promise<void>

  /** Get the path to the migrations directory */
  getMigrationsPath(): string

  /** Run database migrations */
  migrate(
    db: Kysely<DB>,
    direction?: 'up' | 'down',
    migrationPath?: string
  ): Promise<{ success: boolean; results?: MigrationResult[]; error?: unknown }>

  /** Seed the database with initial data */
  seed(db: Kysely<DB>): Promise<void>

  /** JSON array aggregation helper (database-specific) */
  jsonArrayFrom: JsonHelpers['jsonArrayFrom']

  /** JSON object helper (database-specific) */
  jsonObjectFrom: JsonHelpers['jsonObjectFrom']
}
