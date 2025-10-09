import path from 'path'

import log from '@harrytwright/logger'
import { Command } from 'commander'

import ora from 'ora'
import { database } from '../datastore/database'
import {
  IngredientResolvedImportData,
  SupplierResolvedImportData,
} from '../schema'
import { isInitialised } from '../utils/is-initialised'

import { Importer } from '../lib/importer'
import { IngredientService } from '../services/ingredient'
import { SupplierService } from '../services/supplier'

/**
 * Import command
 * */

const importer = new Command()
  .name('import')
  .description('Import ingredients inside the database')
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
    log.silly('cli', { args: cmd.parent?.rawArgs }, cmd.parent?.rawArgs || [])

    const { working, database: dbName, failFast, root } = cmd.optsWithGlobals()

    if (!(await isInitialised(path.join(working)))) {
      log.error(
        'ingredients.import',
        'margin is not yet initialised. Call `$ margin initialise` first'
      )
      process.exit(409)
    }

    const db = database(path.join(working, './data', dbName))

    const importer = new Importer(db, {
      failFast,
      projectRoot: path.join(process.cwd(), root || ''),
    })

    // This is why I have started to love DI, but will work fow now
    const supplier = new SupplierService(db)
    const ingredient = new IngredientService(db, supplier)

    // Could change this to be handled within the importer itself, maybe via the constructor, or an array?

    importer.addProcessor<SupplierResolvedImportData>(
      'supplier',
      function (data, filePath) {
        return supplier.processor(this, data, filePath)
      }
    )

    importer.addProcessor<IngredientResolvedImportData>(
      'ingredient',
      function (data, filePath) {
        return ingredient.processor(this, data, filePath)
      }
    )

    // Could add this to importer and allow the importer to log when it needs via this
    let spinner = ora('✨Loading ingredients')
    const stats = await importer.import(files)
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

export const ingredient = new Command()
  .name('ingredient')
  .description('Handle the ingredients within the database')
  .addCommand(importer)
