import path from 'path'

import log from '@harrytwright/logger'
import { Command } from 'commander'

import { startServer } from '@menubook/app'
import { database } from '@menubook/core'
import { isInitialised } from '../utils/is-initialised'

export const ui = new Command()
  .name('ui')
  .description('Launch the web UI for viewing recipes and margins')
  .option('-p, --port <port>', 'Port to run the server on', '3000')
  .option('--no-open', 'Do not automatically open browser')
  .option('--no-watch', 'Disable live file watching and automatic imports')
  .option(
    '--standalone',
    'Run in standalone mode (database-only storage, no file watching)'
  )
  .action(async (opts, cmd) => {
    log.silly('cli', { args: cmd.parent?.rawArgs }, cmd.parent?.rawArgs || [])

    const {
      location,
      working,
      workspace,
      database: dbName,
      storage: storageMode,
      port,
      open,
      watch: watchFlag,
      standalone,
    } = cmd.optsWithGlobals()

    // Use location if provided, otherwise fall back to working (deprecated)
    const locationDir = location || working
    // Use workspace if provided, otherwise fall back to working/data
    const workspaceDir = workspace || path.join(working, 'data')

    // Standalone mode forces database-only storage and disables file watching
    let finalStorageMode = storageMode
    let watch = watchFlag !== false

    if (standalone) {
      finalStorageMode = 'database-only'
      watch = false
      log.info(
        'ui',
        '🔒 Running in standalone mode (database-only, no file watching)'
      )
    }

    // Validate storage mode
    if (
      finalStorageMode &&
      !['fs', 'database-only'].includes(finalStorageMode)
    ) {
      log.error(
        'ui',
        `Invalid storage mode '${finalStorageMode}'. Must be 'fs' or 'database-only'`
      )
      process.exit(1)
    }

    if (!(await isInitialised(locationDir))) {
      log.error(
        'ui',
        'margin is not yet initialised. Call `$ margin initialise` first'
      )
      process.exit(409)
    }

    const db = database(path.join(locationDir, dbName))

    try {
      const server = await startServer({
        port: parseInt(port, 10),
        database: db,
        locationDir,
        workspaceDir,
        storageMode: finalStorageMode,
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
