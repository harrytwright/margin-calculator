import { createDatabase, destroy } from './dialect'

import { getMigrationsPath, migrate, seed } from './migrate'

// SQLite-specific helpers
import { DatabaseAdapter } from '@menubook/shared'
import { jsonArrayFrom, jsonObjectFrom } from './helpers'

// Re-export types for convenience
export type { DatabaseContext, DB } from '@menubook/shared'

const Sqlite: DatabaseAdapter = {
  createDatabase,
  destroy,
  getMigrationsPath,
  migrate,
  seed,
  // @ts-ignore
  jsonArrayFrom,
  // @ts-ignore
  jsonObjectFrom,
}

export default Sqlite
