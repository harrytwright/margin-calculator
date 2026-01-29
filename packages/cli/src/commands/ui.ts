import path from 'path'

import log from '@harrytwright/logger'
import { Command } from 'commander'

import { startServer } from '@menubook/app'
import { resolveRealmConfig } from '@menubook/core'
import { createDatabaseContext } from '../lib/database'
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
      storage: legacyStorage,
      fileSystem,
      port,
      open,
      watch: watchFlag,
      standalone,
    } = cmd.optsWithGlobals()

    // Use location if provided, otherwise fall back to working (deprecated)
    const locationDir = location || working
    // Use workspace if provided, otherwise fall back to working/data
    const workspaceDir = workspace || path.join(working, 'data')

    // Warn about deprecated --storage option
    if (legacyStorage !== undefined) {
      log.warn(
        'ui',
        '--storage is deprecated and will be removed in v0.4.0. Use --file-system or --no-file-system instead.'
      )
    }

    // Resolve realm configuration from CLI options and environment
    const realmConfig = resolveRealmConfig({
      fileSystem,
      standalone,
      storage: legacyStorage,
      watch: watchFlag,
    })

    // Log the resolved configuration
    if (realmConfig.realm === 'cloud') {
      log.info('ui', 'Running in cloud mode (REALM=cloud)')
    }

    if (standalone) {
      log.info(
        'ui',
        'Running in standalone mode (database-only, no file watching)'
      )
    } else if (!realmConfig.watchFiles) {
      log.info('ui', 'File watching disabled')
    }

    if (realmConfig.storageMode === 'database-only') {
      log.info('ui', 'Using database-only storage (no filesystem writes)')
    }

    if (!(await isInitialised(locationDir))) {
      log.error(
        'ui',
        'margin is not yet initialised. Call `$ margin initialise` first'
      )
      process.exit(409)
    }

    const { context } = createDatabaseContext({
      database: dbName,
      locationDir,
    })

    try {
      const server = await startServer({
        // port: parseInt(port, 10),
        database: context,
        location: locationDir,
        // workspaceDir,
        // storageMode: realmConfig.storageMode,
        openBrowser: open,
        // watchFiles: realmConfig.watchFiles,
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
