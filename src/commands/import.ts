import path from 'path'

import log from '@harrytwright/logger'
import { Command } from 'commander'
import ora from 'ora'

import { database } from '../datastore/database'
import { Importer } from '../lib/importer'
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
    '<files...>',
    'YAML or JSON files to import (auto-detects entity types)',
    (value, total) => {
      return [...((total || []) as any[]), path.resolve(process.cwd(), value)]
    }
  )
  .option('--root [dir]', 'Set the project root directory for @/ references')
  .option('--fail-fast', 'Stop on first error instead of continuing', false)
  .action(async (files, opts, cmd) => {
    log.silly('cli', { args: cmd.parent?.rawArgs }, cmd.parent?.rawArgs || [])

    const { working, database: dbName, failFast, root } = cmd.optsWithGlobals()

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

    const importer = new Importer(db, {
      failFast,
      projectRoot: path.join(process.cwd(), root || ''),
      processors: [
        ['supplier', supplier],
        ['ingredient', ingredient],
        ['recipe', recipe],
      ],
    })

    // Import files
    let spinner = ora('Importing files')
    const stats = await importer.import(files)
    spinner.succeed('Saved to database')

    // Print summary
    log.info(
      'import',
      `Summary: created=${stats.created}, upserted=${stats.upserted}, ignored=${stats.ignored}, failed=${stats.failed}`
    )

    // Log errors if any occurred
    const errors = importer.getErrors()
    if (errors.length > 0 && !failFast) {
      log.warn('import', `${errors.length} error(s) occurred:`)
      errors.forEach(({ file, error }) => {
        log.warn('import', `  ${path.basename(file)}: ${error}`)
      })
    }
  })
