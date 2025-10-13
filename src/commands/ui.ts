import path from 'path'

import log from '@harrytwright/logger'
import { Command } from 'commander'

import { database } from '../datastore/database'
import { startServer } from '../server/index'
import { isInitialised } from '../utils/is-initialised'

export const ui = new Command()
  .name('ui')
  .description('Launch the web UI for viewing recipes and margins')
  .option('-p, --port <port>', 'Port to run the server on', '3000')
  .option('--no-open', 'Do not automatically open browser')
  .action(async (opts, cmd) => {
    log.silly('cli', { args: cmd.parent?.rawArgs }, cmd.parent?.rawArgs || [])

    const { working, database: dbName, port, open } = cmd.optsWithGlobals()

    if (!(await isInitialised(path.join(working)))) {
      log.error(
        'ui',
        'margin is not yet initialised. Call `$ margin initialise` first'
      )
      process.exit(409)
    }

    const db = database(path.join(working, './data', dbName))

    try {
      await startServer({
        port: parseInt(port, 10),
        database: db,
        workingDir: working,
        openBrowser: open,
      })

      // Keep process alive
      process.on('SIGINT', () => {
        console.log('\n\n👋 Shutting down server...')
        process.exit(0)
      })
    } catch (error: any) {
      log.error('ui', error, `Failed to start server: ${error.message}`)
      process.exit(1)
    }
  })
