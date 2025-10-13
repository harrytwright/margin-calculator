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
 * Import command
 * */

const importer = new Command()
  .name('import')
  .description('Import recipes inside the database')
  .argument(
    '<files...>',
    'Set the file, or files to be looked up',
    (value, total) => {
      return [...((total || []) as any[]), path.resolve(process.cwd(), value)]
    }
  )
  .option('--root [dir]', 'Set the root directory')
  .option('--fail-fast', 'Stop on first error instead of continuing', false)
  .action(async (files, opts, cmd) => {
    log.warn(
      'recipe.import',
      '⚠️  Warning: `margin recipe import` is deprecated. Use `margin import` instead.'
    )

    log.silly('cli', { args: cmd.parent?.rawArgs }, cmd.parent?.rawArgs || [])

    const { working, database: dbName, failFast, root } = cmd.optsWithGlobals()

    if (!(await isInitialised(path.join(working)))) {
      log.error(
        'ingredients.recipe',
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
 * Calculate command
 * */

const calculate = new Command()
  .name('calculate')
  .description('Calculate cost and margin for one or more recipes')
  .argument('<slugs...>', 'Recipe slugs to calculate')
  .option('--json', 'Output results as JSON', false)
  .action(async (slugs: string[], opts, cmd) => {
    log.silly('cli', { args: cmd.parent?.rawArgs }, cmd.parent?.rawArgs || [])

    const { working, database: dbName, json } = cmd.optsWithGlobals()

    if (!(await isInitialised(path.join(working)))) {
      log.error(
        'recipe.calculate',
        'margin is not yet initialised. Call `$ margin initialise` first'
      )
      process.exit(409)
    }

    const db = database(path.join(working, './data', dbName))

    // Initialize services
    const supplier = new SupplierService(db)
    const ingredient = new IngredientService(db, supplier)
    const recipeService = new RecipeService(db, ingredient)

    // Import Calculator and runner
    const { Calculator } = await import('../lib/calculation/calculator.js')
    const { ConfigService } = await import('../services/config.js')
    const { runCalculations } = await import('../lib/runner.js')

    // Initialize calculator with config
    const config = new ConfigService(working)
    const calculator = new Calculator(recipeService, ingredient, config)

    // Choose reporter based on --json flag
    let reporter
    if (json) {
      const { JSONReporter } = await import(
        '../lib/calculation/reporters/JSONReporter.js'
      )
      reporter = new JSONReporter()
    } else {
      const { DefaultReporter } = await import(
        '../lib/calculation/reporters/DefaultReporter.js'
      )
      reporter = new DefaultReporter()
    }

    // Run calculations
    const results = await runCalculations(
      calculator,
      recipeService,
      slugs,
      reporter
    )

    // Exit with error code if any failures
    const failed = results.results.filter((r: any) => r.failureMessage).length
    if (failed > 0) {
      process.exit(1)
    }
  })

/**
 * Report command
 * */

const report = new Command()
  .name('report')
  .description('Generate a summary report for all recipes')
  .option('--json', 'Output results as JSON', false)
  .action(async (opts, cmd) => {
    log.silly('cli', { args: cmd.parent?.rawArgs }, cmd.parent?.rawArgs || [])

    const { working, database: dbName, json } = cmd.optsWithGlobals()

    if (!(await isInitialised(path.join(working)))) {
      log.error(
        'recipe.report',
        'margin is not yet initialised. Call `$ margin initialise` first'
      )
      process.exit(409)
    }

    const db = database(path.join(working, './data', dbName))

    // Initialize services
    const supplier = new SupplierService(db)
    const ingredient = new IngredientService(db, supplier)
    const recipeService = new RecipeService(db, ingredient)

    // Get all recipe slugs
    const allRecipes = await db.selectFrom('Recipe').select('slug').execute()

    if (allRecipes.length === 0) {
      log.warn('recipe.report', 'No recipes found in database')
      return
    }

    const slugs = allRecipes.map((r) => r.slug)

    // Import Calculator and runner
    const { Calculator } = await import('../lib/calculation/calculator.js')
    const { ConfigService } = await import('../services/config.js')
    const { runCalculations } = await import('../lib/runner.js')

    // Initialize calculator with config
    const config = new ConfigService(working)
    const calculator = new Calculator(recipeService, ingredient, config)

    // Choose reporter based on --json flag
    let reporter
    if (json) {
      const { JSONReporter } = await import(
        '../lib/calculation/reporters/JSONReporter.js'
      )
      reporter = new JSONReporter()
    } else {
      const { SummaryReporter } = await import(
        '../lib/calculation/reporters/SummaryReporter.js'
      )
      reporter = new SummaryReporter()
    }

    // Run calculations
    const results = await runCalculations(
      calculator,
      recipeService,
      slugs,
      reporter
    )

    // Exit with error code if any failures
    const failed = results.results.filter((r: any) => r.failureMessage).length
    if (failed > 0) {
      process.exit(1)
    }
  })

/**
 * Main command
 * */

export const recipe = new Command()
  .name('recipe')
  .description('Handle the recipes within the database')
  .addCommand(importer)
  .addCommand(calculate)
  .addCommand(report)
