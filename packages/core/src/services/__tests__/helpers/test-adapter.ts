import type { DatabaseAdapter, DatabaseContext } from '@menubook/shared'

/**
 * Resolve the test adapter based on the TEST_ADAPTER env var.
 * Defaults to SQLite (in-memory) for local dev.
 *
 * Usage:
 *   TEST_ADAPTER=postgres TEST_DATABASE_URL=postgres://... pnpm test
 */
const ADAPTER_NAME = process.env.TEST_ADAPTER || 'sqlite'

function loadAdapter(): DatabaseAdapter {
  switch (ADAPTER_NAME) {
    case 'postgres':
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('@menubook/postgres').default
    case 'sqlite':
    default:
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('@menubook/sqlite').default
  }
}

export const adapter = loadAdapter()

/**
 * Create an isolated DatabaseContext for a single test run.
 * Caller is responsible for calling `ctx.db.destroy()` in afterEach.
 */
export async function createTestContext(): Promise<DatabaseContext> {
  const connectionString =
    ADAPTER_NAME === 'postgres'
      ? process.env.TEST_DATABASE_URL ||
        'postgres://localhost:5432/menubook_test'
      : ':memory:'

  const db = adapter.createDatabase(connectionString)

  await adapter.migrate(db)
  await adapter.seed(db)

  return {
    db,
    helpers: {
      jsonArrayFrom: adapter.jsonArrayFrom,
      jsonObjectFrom: adapter.jsonObjectFrom,
    },
    type: ADAPTER_NAME === 'postgres' ? 'postgres' : 'sqlite',
  }
}
