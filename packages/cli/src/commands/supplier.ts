import path from 'path'

import log from '@harrytwright/logger'
import { Command } from 'commander'
import ora from 'ora'

import type { DatabaseContext } from '@menubook/core'
import { Importer, SupplierService } from '@menubook/core'
import { createDatabase, jsonArrayFrom, jsonObjectFrom } from '@menubook/sqlite'
import { isInitialised } from '../utils/is-initialised'

/**
 * Import command
 * */

const importer = new Command()
  .name('import')
  .description('Import suppliers inside the database')
  .argument(
    '<files...>',
    'Set the file, or files to be looked up',
    (value, total) => {
      return [...((total || []) as any[]), path.join(process.cwd(), value)]
    }
  )
  .option('--root [dir]', 'Set the root directory')
  .option('--fail-fast', 'Stop on first error instead of continuing', false)
  .action(async (files, opts, cmd) => {
    log.warn(
      'supplier.import',
      '⚠️  Warning: `margin supplier import` is deprecated. Use `margin import` instead.'
    )

    log.silly('cli', { args: cmd.parent?.rawArgs }, cmd.parent?.rawArgs || [])

    const {
      location,
      working,
      workspace,
      database: dbName,
      failFast,
      root,
    } = cmd.optsWithGlobals()

    // Use location if provided, otherwise fall back to working (deprecated)
    const locationDir = location || working
    // Use workspace if provided, otherwise fall back to root (deprecated) or working/data
    const workspaceDir = workspace || root || path.join(working, 'data')

    if (!(await isInitialised(locationDir))) {
      log.error(
        'ingredients.supplier',
        'margin is not yet initialised. Call `$ margin initialise` first'
      )
      process.exit(409)
    }

    const db = createDatabase(path.join(locationDir, dbName))
    const context: DatabaseContext = {
      db,
      helpers: { jsonArrayFrom, jsonObjectFrom },
    }

    // Initialize service
    const supplier = new SupplierService(context)

    const importer = new Importer(context, {
      failFast,
      dataDir: path.resolve(process.cwd(), workspaceDir),
      processors: [['supplier', supplier]],
    })

    // Could add this to importer and allow the importer to log when it needs via this
    let spinner = ora('✨Loading suppliers')
    const { stats } = await importer.import(files)
    spinner.succeed('Saved to database')

    // Print summary
    log.info(
      'importer',
      `Summary: created=${stats.created}, upserted=${stats.upserted}, ignored=${stats.ignored}, failed=${stats.failed}`
    )

    // Log the errors
    const errors = importer.getErrors()
    if (errors.length > 0 && !failFast) {
      log.warn('importer', `${errors.length} error(s) occurred:`)
      errors.forEach(({ file, error }) => {
        log.warn('importer', `  ${path.basename(file)}: ${error}`)
      })
    }
  })

/**
 * Main command
 * */

export const supplier = new Command()
  .name('supplier')
  .description('Handle the suppliers within the database')
  .addCommand(importer)
