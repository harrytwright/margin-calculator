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
  .option('--no-watch', 'Disable live file watching and automatic imports')
  .action(async (opts, cmd) => {
    log.silly('cli', { args: cmd.parent?.rawArgs }, cmd.parent?.rawArgs || [])

    const { working, database: dbName, port, open, watch: watchFlag } =
      cmd.optsWithGlobals()

    const watch = watchFlag !== false

    if (!(await isInitialised(path.join(working)))) {
      log.error(
        'ui',
        'margin is not yet initialised. Call `$ margin initialise` first'
      )
      process.exit(409)
    }

    const db = database(path.join(working, './data', dbName))

    try {
      const server = await startServer({
        port: parseInt(port, 10),
        database: db,
        workingDir: working,
        openBrowser: open,
        watchFiles: watch,
      })

      // Keep process alive
      const shutdown = async () => {
        console.log('\n\n👋 Shutting down server...')
        await server.close()
        process.exit(0)
      }

      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)

      process.on('exit', () => {
        process.off('SIGINT', shutdown)
        process.off('SIGTERM', shutdown)
      })
    } catch (error: any) {
      log.error('ui', error, `Failed to start server: ${error.message}`)
      process.exit(1)
    }
  })
