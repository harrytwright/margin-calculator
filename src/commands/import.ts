import fs from 'fs/promises'
import path from 'path'

import log from '@harrytwright/logger'
import { Command } from 'commander'
import ora from 'ora'

import { database } from '../datastore/database'
import { FileWatcher } from '../lib/file-watcher'
import { HashService } from '../lib/hash-service'
import { Importer } from '../lib/importer'
import type { ImportStats } from '../lib/importer'
import { IngredientService } from '../services/ingredient'
import { RecipeService } from '../services/recipe'
import { SupplierService } from '../services/supplier'
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

    const { working, database: dbName, failFast, root, watch } =
      cmd.optsWithGlobals()

    if (!(await isInitialised(path.join(working)))) {
      log.error(
        'import',
        'margin is not yet initialised. Call `$ margin initialise` first'
      )
      process.exit(409)
    }

    const db = database(path.join(working, './data', dbName))

    // Initialize services
    const supplier = new SupplierService(db)
    const ingredient = new IngredientService(db, supplier)
    const recipe = new RecipeService(db, ingredient)

    const projectRoot = root
      ? path.resolve(process.cwd(), root)
      : path.join(working, 'data')

    const createImporter = () =>
      new Importer(db, {
        failFast,
        projectRoot,
        processors: [
          ['supplier', supplier],
          ['ingredient', ingredient],
          ['recipe', recipe],
        ],
      })

    const fileList = (files as string[]) ?? []

    if (watch) {
      await runWatchMode({
        files: fileList,
        importerFactory: createImporter,
        workingDir: working,
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
  workingDir: string
  failFast: boolean
}

async function runWatchMode(config: WatchModeConfig): Promise<void> {
  const importer = config.importerFactory()

  if (config.files.length > 0) {
    const { stats } = await importer.import(config.files)
    logSummary(importer, stats, config.failFast)
  }

  const dataRoot = path.join(config.workingDir, 'data')
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
