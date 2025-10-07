import type { PathLike } from 'fs'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import log from '@harrytwright/logger'
import { Command } from 'commander'
import prompt from 'prompts'
import toml from 'toml'

import { database, migrate } from '../datastore/database'
import { spin } from '../utils/spinner'
import { tomlWriter } from '../utils/toml-writer'

// Used to initialise the system.

export const defaultWorkingDir = path.join(os.homedir(), './margin')

export const initialise = new Command()
  .name('initialise')
  .description('Initialise the cli')
  .option('--working [file]', 'Change the working directory', defaultWorkingDir)
  .option(
    '-d, --database [name]',
    'Set the default database name. Stored within the `<working>/data`',
    'margin.sqlite3'
  )
  .option('--force', 'Force the recreation', false)
  .action(async ({ working, database: dbPath, force }) => {
    log.info('initialise', 'Initialising the cli')

    // Create a working dir
    const { conf, base, data } = await spin(createWorkingDirectory(working), {
      text: '⚙ Creating working directory',
      successText: 'Created working directory',
    })

    // Create the config file within the above folder
    await writeDefaultConfiguration(path.join(conf, './margin.toml'), force)

    // Delete the old database first,
    if (force) {
      const databaseDeletion = await prompt({
        type: 'select',
        name: 'delete',
        message:
          'Force delete existing database. This is destructive. Do we proceed?',
        hint: 'Setting to `No` will still run the migration. This is to check if you wish the database to be deleted',
        choices: [
          {
            value: true,
            title: 'Yes',
          },
          { value: false, title: 'No', selected: true },
        ],
      })

      if (databaseDeletion.delete) {
        await fs
          .access(path.join(data, dbPath))
          .then(() => fs.unlink(path.join(data, dbPath)))
          .catch(() => log.verbose('initialise', 'Database does not exist'))

        log.warn('initialise', 'Database deleted')
      }
    }

    // Initialise the database file
    const db = database(path.join(data, dbPath))

    await migrate.call(
      db,
      'up',
      path.join(__dirname, '../datastore/migrations')
    )

    console.log(
      '\nInitialised margin system.\nDatabase: ✔\nDirectory: ✔ (%s)',
      base
    )
  })

async function createWorkingDirectory(dir: PathLike) {
  const base = (await fs.mkdir(dir, { recursive: true })) || dir.toString()

  const data =
    (await fs.mkdir(path.join(dir.toString(), './data'), {
      recursive: true,
    })) || path.join(dir.toString(), './data')

  const conf =
    (await fs.mkdir(path.join(dir.toString(), './conf'), {
      recursive: true,
    })) || path.join(dir.toString(), './conf')

  return { base, data, conf }
}

// Use `force` for overwriting the previous configuration. Clean the slate as you will.
function writeDefaultConfiguration(path: PathLike, force: boolean) {
  return spin(
    async () => {
      // If the file exists and we have force enabled just return early.
      let prev: {} = {}
      try {
        prev = toml.parse(await fs.readFile(path, { encoding: 'utf8' }))
      } catch (err) {
        log.error('initialise', err)
      }

      if (force) {
        prev = {
          vat: 0.2,
          marginTarget: 20,
        }
      } else {
        prev = Object.assign(
          {
            vat: 0.2,
            marginTarget: 20,
          },
          prev
        )
      }

      return fs.writeFile(
        path,
        tomlWriter(prev, { newlineAfterSection: true }),
        'utf8'
      )
    },
    {
      text: '⚙ Initialising configuration',
      successText: 'Configuration initialised',
      failText: (err) => `Failed to initialise due to ${err}`,
    }
  )
}
