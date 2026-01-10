import type { Kysely, MigrationResult } from 'kysely'

import type { DB } from '@menubook/types'

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

// Adapter registry
const adapters = new Map<string, DatabaseAdapter>()

/**
 * Register a database adapter.
 *
 * @param name - Adapter name ('sqlite' or 'postgres')
 * @param adapter - The adapter implementation
 */
export function registerAdapter(name: string, adapter: DatabaseAdapter): void {
  adapters.set(name, adapter)
}

/**
 * Get a registered adapter by name.
 *
 * @param name - Adapter name
 * @returns The adapter
 * @throws Error if adapter is not registered
 */
export function getAdapter(name: string): DatabaseAdapter {
  const adapter = adapters.get(name)
  if (!adapter) {
    const available = [...adapters.keys()].join(', ') || 'none'
    throw new Error(
      `Database adapter '${name}' not registered. Available adapters: ${available}. ` +
        `Make sure to install and register either @menubook/sqlite or @menubook/postgres.`
    )
  }
  return adapter
}

/**
 * Check if an adapter is registered.
 *
 * @param name - Adapter name
 * @returns True if the adapter is registered
 */
export function hasAdapter(name: string): boolean {
  return adapters.has(name)
}

/**
 * Detect the appropriate adapter from a connection string.
 *
 * @param connectionString - Database connection string or file path
 * @returns 'postgres' for PostgreSQL URLs, 'sqlite' otherwise
 */
export function detectAdapter(connectionString: string): 'sqlite' | 'postgres' {
  if (
    connectionString.startsWith('postgresql://') ||
    connectionString.startsWith('postgres://')
  ) {
    return 'postgres'
  }
  return 'sqlite'
}

/**
 * Get a list of registered adapter names.
 */
export function getRegisteredAdapters(): string[] {
  return [...adapters.keys()]
}
