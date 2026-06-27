import type { DatabaseAdapter } from '@menubook/shared'

import { createDatabase, destroy } from './dialect'
import { jsonArrayFrom, jsonObjectFrom } from './helpers'
import { getMigrationsPath, migrate, seed } from './migrate'

export {
  createDatabase,
  destroy,
  getMigrationsPath,
  jsonArrayFrom,
  jsonObjectFrom,
  migrate,
  seed,
}

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
