import type { Kysely } from 'kysely'

import type { DB } from '@menubook/types'

/**
 * Type for JSON aggregation helper functions.
 * These differ between SQLite and PostgreSQL, so they're provided by the adapter.
 */
export type JsonHelpers = {
  jsonArrayFrom: typeof import('kysely/helpers/sqlite').jsonArrayFrom
  jsonObjectFrom: typeof import('kysely/helpers/sqlite').jsonObjectFrom
}

/**
 * Database context containing the Kysely instance and database-specific helpers.
 * Services receive this instead of a raw Kysely instance to support multiple databases.
 */
export interface DatabaseContext {
  /** The Kysely database instance */
  db: Kysely<DB>
  /** Database-specific helper functions (jsonArrayFrom, jsonObjectFrom) */
  helpers: JsonHelpers
}
