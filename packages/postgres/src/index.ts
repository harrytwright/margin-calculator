import { createDatabase, destroy } from './dialect'

import { getMigrationsPath, migrate, seed } from './migrate'

// SQLite-specific helpers
import { DatabaseAdapter } from '@menubook/shared'
import { jsonArrayFrom, jsonObjectFrom } from './helpers'

// Re-export types for convenience
export type { DatabaseContext, DB } from '@menubook/shared'

const Postgres: DatabaseAdapter = {
  createDatabase,
  destroy,
  getMigrationsPath,
  migrate,
  seed,
  jsonArrayFrom,
  jsonObjectFrom,
}

export default Postgres
