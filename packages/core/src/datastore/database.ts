import { promises as fs } from 'fs'
import path from 'path'

import log from '@harrytwright/logger'
import Database from 'better-sqlite3'
import {
  FileMigrationProvider,
  Kysely,
  Migrator,
  ParseJSONResultsPlugin,
  SqliteDialect,
  type MigrationResult,
} from 'kysely'

import { DB } from './types'

const databases = new Map<string, Kysely<DB>>()

// Get the default migrations path (relative to this file's location)
export function getMigrationsPath(): string {
  return path.join(__dirname, 'migrations')
}

// Allow multiple databases if you need them. Shouldn't really, but could do this per season per database etc
export function database(path: string = ':memory:') {
  if (!databases.has(path)) {
    log.verbose('database', 'Created new database @ %s', path)
    databases.set(
      path,
      new Kysely<DB>({
        dialect: new SqliteDialect({
          database: Database(path),
        }),
        plugins: [new ParseJSONResultsPlugin()],
      })
    )
  }

  return databases.get(path)!
}

export async function destroy(path: string = ':memory:') {
  const db = database(path)
  databases.delete(path)

  await db.destroy()
}

export async function migrate(
  this: Kysely<DB>,
  direction: 'up' | 'down' = 'up',
  migrationPath: string = getMigrationsPath()
): Promise<{ success: boolean; results?: MigrationResult[]; error?: unknown }> {
  const migrator = new Migrator({
    db: this,
    provider: new FileMigrationProvider({
      fs,
      path,
      // This needs to be an absolute path.
      migrationFolder: path.normalize(migrationPath),
    }),
  })

  const { error, results } = await migrator.migrateToLatest()

  if (results?.length === 0) {
    log.verbose('migration', 'No new migration to apply')
    return { success: true, results }
  }

  results?.forEach((it: MigrationResult) => {
    if (it.status === 'Success') {
      log.verbose(
        'migration',
        `Migration "${it.migrationName}" was executed successfully`
      )
    } else if (it.status === 'Error') {
      log.error(
        'migration',
        `Failed to execute migration "${it.migrationName}"`
      )
    }
  })

  if (error) {
    log.error('migration', error, 'Failed to migrate')
    return { success: false, results, error }
  }

  return { success: true, results }
}

export async function seed(this: Kysely<DB>) {
  // Seed the generic supplier (used as default for ingredients without a specific supplier)
  await this.insertInto('Supplier')
    .values({
      slug: 'generic',
      name: 'Generic Supplier',
    })
    .onConflict((oc) => oc.column('slug').doNothing())
    .execute()

  log.verbose('seed', 'Seeded generic supplier')
}
