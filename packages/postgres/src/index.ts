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
