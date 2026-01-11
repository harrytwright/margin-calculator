import fs from 'fs/promises'
import path from 'path'

import log from '@harrytwright/logger'
import { Command } from 'commander'
import ora from 'ora'

import type { ImportStats } from '@menubook/core'
import {
  ConfigService,
  detectRealm,
  FileWatcher,
  HashService,
  Importer,
  IngredientService,
  RecipeService,
  SupplierService,
} from '@menubook/core'
import { createDatabaseContext } from '../lib/database'
import { isInitialised } from '../utils/is-initialised'

/**
 * Global import command
 *
 * Imports any combination of suppliers, ingredients, and recipes
 * Automatically detects entity types from YAML/JSON files
 */

export const importCommand = new Command()
  .name('import')
  .description(
    'Import suppliers, ingredients, and recipes from YAML/JSON files'
  )
  .argument(
    '[files...]',
    'YAML or JSON files to import (auto-detects entity types)',
    (value, total = []) => {
      return [...(total as string[]), path.resolve(process.cwd(), value)]
    },
    [] as string[]
  )
  .option('--root [dir]', 'Set the project root directory for @/ references')
  .option('--fail-fast', 'Stop on first error instead of continuing', false)
  .option('--watch', 'Stay running and watch for file changes')
  .action(async (files, opts, cmd) => {
    log.silly('cli', { args: cmd.parent?.rawArgs }, cmd.parent?.rawArgs || [])

    const {
      location,
      working,
      workspace,
      database: dbName,
      failFast,
      root,
      watch,
    } = cmd.optsWithGlobals()

    // Use location if provided, otherwise fall back to working (deprecated)
    const locationDir = location || working
    // Use workspace if provided, otherwise fall back to root (deprecated) or working/data
    const workspaceDir = workspace || root || path.join(working, 'data')

    if (!(await isInitialised(locationDir))) {
      log.error(
        'import',
        'margin is not yet initialised. Call `$ margin initialise` first'
      )
      process.exit(409)
    }

    const { context } = createDatabaseContext({
      database: dbName,
      locationDir,
    })

    // Initialize services
    const config = new ConfigService(locationDir)
    const supplier = new SupplierService(context)
    const ingredient = new IngredientService(context, supplier)
    const recipe = new RecipeService(context, ingredient, config)

    const dataDir = path.resolve(process.cwd(), workspaceDir)

    const createImporter = () =>
      new Importer(context, {
        failFast,
        dataDir,
        processors: [
          ['supplier', supplier],
          ['ingredient', ingredient],
          ['recipe', recipe],
        ],
      })

    const fileList = (files as string[]) ?? []

    // Block --watch in cloud mode (no filesystem to watch)
    if (watch && detectRealm() === 'cloud') {
      log.error(
        'import',
        'Cannot use --watch in cloud mode (REALM=cloud). File watching requires filesystem access.'
      )
      process.exit(1)
    }

    if (watch) {
      await runWatchMode({
        files: fileList,
        importerFactory: createImporter,
        locationDir,
        workspaceDir: dataDir,
        failFast,
      })
      return
    }

    if (!fileList.length) {
      log.error('import', 'No files provided. Specify files or use --watch.')
      process.exit(1)
    }

    const importer = createImporter()

    let spinner = ora('Importing files')
    const { stats } = await importer.import(fileList)
    spinner.succeed('Saved to database')

    logSummary(importer, stats, failFast)
  })

interface WatchModeConfig {
  files: string[]
  importerFactory: () => Importer
  locationDir: string
  workspaceDir: string
  failFast: boolean
}

async function runWatchMode(config: WatchModeConfig): Promise<void> {
  const importer = config.importerFactory()

  if (config.files.length > 0) {
    const { stats } = await importer.import(config.files)
    logSummary(importer, stats, config.failFast)
  }

  const dataRoot = config.workspaceDir
  await ensureDirectories([
    dataRoot,
    path.join(dataRoot, 'suppliers'),
    path.join(dataRoot, 'ingredients'),
    path.join(dataRoot, 'recipes'),
  ])

  const watcher = new FileWatcher({
    roots: [dataRoot],
    hashService: new HashService(),
    debounceMs: 150,
    importerFactory: config.importerFactory,
    watchOptions: {
      usePolling: process.platform === 'darwin' && process.env.CI === 'true',
    },
  })

  watcher.on('entity', (event) => {
    log.info(
      'import.watch',
      `${event.action} ${event.type} (${event.slug}) [${path.relative(
        dataRoot,
        event.path
      )}]`
    )
  })

  watcher.on('error', (error) => {
    log.error('import.watch', error, 'File watcher error')
  })

  await watcher.start()

  console.log('👀 Watching for file changes. Press Ctrl+C to exit.')

  const shutdown = async () => {
    console.log('\n👋 Stopping watcher...')
    await watcher.stop()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  process.on('exit', () => {
    process.off('SIGINT', shutdown)
    process.off('SIGTERM', shutdown)
  })
}

function logSummary(importer: Importer, stats: ImportStats, failFast: boolean) {
  log.info(
    'import',
    `Summary: created=${stats.created}, upserted=${stats.upserted}, ignored=${stats.ignored}, failed=${stats.failed}`
  )

  const errors = importer.getErrors()
  if (errors.length > 0 && !failFast) {
    log.warn('import', `${errors.length} error(s) occurred:`)
    errors.forEach(({ file, error }) => {
      log.warn('import', `  ${path.basename(file)}: ${error}`)
    })
  }
}

async function ensureDirectories(dirs: string[]): Promise<void> {
  await Promise.all(dirs.map((dir) => fs.mkdir(dir, { recursive: true })))
}
