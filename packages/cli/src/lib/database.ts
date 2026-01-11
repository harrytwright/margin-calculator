import path from 'path'

import log from '@harrytwright/logger'

import type { DatabaseAdapter, DatabaseContext } from '@menubook/core'
import {
  detectAdapter,
  getAdapter,
  hasAdapter,
  registerAdapter,
} from '@menubook/core'
import * as sqlite from '@menubook/sqlite'

// Register SQLite adapter immediately (always available)
registerAdapter('sqlite', sqlite as DatabaseAdapter)

/**
 * Ensures the PostgreSQL adapter is registered.
 * Lazily loads @menubook/postgres to avoid requiring it for SQLite-only users.
 *
 * @throws Error if @menubook/postgres is not installed
 */
export function ensurePostgresAdapter(): void {
  if (hasAdapter('postgres')) {
    return
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const postgres = require('@menubook/postgres')
    registerAdapter('postgres', postgres as DatabaseAdapter)
  } catch {
    throw new Error(
      '@menubook/postgres is not installed. Install it with: pnpm add @menubook/postgres'
    )
  }
}

/**
 * Checks if a string looks like a connection URL.
 */
function isConnectionUrl(value: string): boolean {
  return (
    value.startsWith('postgresql://') ||
    value.startsWith('postgres://') ||
    value.startsWith('sqlite://') ||
    value.startsWith('file://')
  )
}

/**
 * Checks if a string is an absolute path.
 */
function isAbsolutePath(value: string): boolean {
  return path.isAbsolute(value)
}

export interface DatabaseOptions {
  /** The database connection string, path, or filename */
  database: string
  /** The location directory (used for resolving relative filenames) */
  locationDir: string
}

export interface DatabaseResult {
  /** The database context for use with services */
  context: DatabaseContext
  /** The adapter instance */
  adapter: DatabaseAdapter
  /** The resolved connection string or path */
  connectionString: string
  /** The detected adapter name */
  adapterName: 'sqlite' | 'postgres'
}

/**
 * Creates a database context from CLI options.
 *
 * Handles three input formats:
 * 1. Connection URL (postgresql://..., postgres://...) → PostgreSQL
 * 2. Absolute path (/path/to/db.sqlite3) → SQLite
 * 3. Filename only (margin.sqlite3) → SQLite at <locationDir>/<filename> [DEPRECATED]
 *
 * @param options - Database and location options
 * @returns Database context, adapter, and connection details
 *
 * @example
 * // Connection URL (PostgreSQL)
 * createDatabaseContext({ database: 'postgresql://localhost/mydb', locationDir: '~/.margin' })
 *
 * @example
 * // Absolute path (SQLite)
 * createDatabaseContext({ database: '/var/data/margin.sqlite3', locationDir: '~/.margin' })
 *
 * @example
 * // Filename only (deprecated)
 * createDatabaseContext({ database: 'margin.sqlite3', locationDir: '~/.margin' })
 * // Resolves to ~/.margin/margin.sqlite3
 */
export function createDatabaseContext(
  options: DatabaseOptions
): DatabaseResult {
  const { database, locationDir } = options

  let connectionString: string

  if (isConnectionUrl(database)) {
    // Full connection URL - use as-is
    connectionString = database
  } else if (isAbsolutePath(database)) {
    // Absolute path - use as-is
    connectionString = database
  } else {
    // Filename only - join with location directory (DEPRECATED)
    log.warn(
      'database',
      `Passing a filename to --database is deprecated. Use a full path or connection string. This will be removed in v0.4.0.`
    )
    connectionString = path.join(locationDir, database)
  }

  const adapterName = detectAdapter(connectionString)

  // Ensure postgres adapter is loaded if needed
  if (adapterName === 'postgres') {
    ensurePostgresAdapter()
  }

  const adapter = getAdapter(adapterName)
  const db = adapter.createDatabase(connectionString)

  const context: DatabaseContext = {
    db,
    helpers: {
      jsonArrayFrom: adapter.jsonArrayFrom,
      jsonObjectFrom: adapter.jsonObjectFrom,
    },
  }

  return {
    context,
    adapter,
    connectionString,
    adapterName,
  }
}

/**
 * Runs database migrations using the appropriate adapter.
 *
 * @param context - Database context
 * @param adapter - Database adapter
 * @param direction - Migration direction ('up' or 'down')
 */
export async function runMigrations(
  context: DatabaseContext,
  adapter: DatabaseAdapter,
  direction: 'up' | 'down' = 'up'
): Promise<{ success: boolean; error?: unknown }> {
  return adapter.migrate(context.db, direction)
}
