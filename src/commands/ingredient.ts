import fs from 'fs/promises'
import path from 'path'

import log from '@harrytwright/logger'
import { Command } from 'commander'
import yaml from 'yaml'

import ora from 'ora'
import { database } from '../datastore/database'
import {
  IngredientImportData,
  isIngredientImport,
  parseImportFile,
} from '../schema'
import { hasChanges } from '../utils/has-changes'
import { isInitialised } from '../utils/is-initialised'
import { slugify } from '../utils/slugify'
import { defaultWorkingDir } from './initialise'

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
  .option(
    '--working [working]',
    'Change the working directory',
    defaultWorkingDir
  )
  .option(
    '-d, --database [name]',
    'Get the default database name',
    'margin.sqlite3'
  )
  .option('--fail-fast', 'Stop on first error instead of continuing', false)
  .action(async (files, { working, database: dbName, failFast }) => {
    if (!(await isInitialised(path.join(working)))) {
      log.error(
        'ingredients.import',
        'margin is not yet initialised. Call `$ margin initialise` first'
      )
      process.exit(409)
    }

    // Track statistics
    const stats = {
      created: 0,
      upserted: 0,
      ignored: 0,
      failed: 0,
    }
    const errors: Array<{ file: string; error: string }> = []

    // Load the data, validate it against zod, and save it into a processed array for later usage
    let spinner = ora('✨Loading ingredients')
    const processed: Array<{ file: string; data: IngredientImportData }> = []

    for (const file of files) {
      try {
        const content = await fs.readFile(file, { encoding: 'utf8' })
        const parsed = yaml.parse(content)
        const data = parseImportFile(parsed)

        if (!isIngredientImport(data)) {
          throw new Error('Not a valid ingredient object')
        }

        log.verbose('importer', '%o', data)
        processed.push({ file, data: data.data })
      } catch (error) {
        stats.failed++
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push({ file, error: errorMsg })

        if (failFast) {
          spinner.fail(`Failed to load ${path.basename(file)}`)
          log.error('importer', `${file}: ${errorMsg}`)
          process.exit(1)
        }

        log.warn('importer', `Skipping ${path.basename(file)}: ${errorMsg}`)
      }
    }

    if (processed.length === 0) {
      spinner.fail('No valid ingredients to import')
      process.exit(1)
    }

    spinner.succeed(`Loaded ${processed.length}/${files.length} ingredients`)

    spinner.start('⚙ Saving ingredients to database')
    const db = database(path.join(working, './data', dbName))

    for (const { file, data: ingredientImportDatum } of processed) {
      try {
        const slug =
          ingredientImportDatum.slug ||
          (await slugify(ingredientImportDatum.name))

        // Default to 'generic' supplier if none specified
        const supplierSlug = ingredientImportDatum.supplierId || 'generic'

        // Check if the ingredient already exists (with supplier info for validation)
        const existing = await db
          .selectFrom('Ingredient')
          .leftJoin('Supplier', 'Ingredient.supplierId', 'Supplier.id')
          .select([
            'Ingredient.id',
            'Ingredient.name',
            'Ingredient.category',
            'Ingredient.purchaseUnit',
            'Ingredient.purchaseCost',
            'Ingredient.conversionRule',
            'Ingredient.notes',
            'Ingredient.lastPurchased',
            'Supplier.slug as supplierSlug',
          ])
          .where('Ingredient.slug', '=', slug)
          .executeTakeFirst()

        // Validate that the supplier hasn't changed (immutable after creation)
        if (existing && existing.supplierSlug !== supplierSlug) {
          throw new Error(
            `Cannot change supplier for ingredient '${slug}' from '${existing.supplierSlug}' to '${supplierSlug}'. ` +
              `Supplier is immutable after creation. Create a new ingredient with a different slug instead.`
          )
        }

        // Check if any mutable fields have changed
        const hasChanged = hasChanges(existing, ingredientImportDatum, {
          name: 'name',
          category: 'category',
          purchaseUnit: 'purchaseUnit',
          purchaseCost: 'purchaseCost',
          conversionRule: 'conversionRate',
          notes: 'notes',
          lastPurchased: 'lastPurchased',
        })

        // Skip if no changes detected
        if (existing && !hasChanged) {
          stats.ignored++
          log.verbose('importer', `Skipping ${slug}: no changes`)
          continue
        }

        // Perform upsert (supplierId only set on insert via subquery, never updated)
        await db
          .insertInto('Ingredient')
          .values((eb) => ({
            slug,
            name: ingredientImportDatum.name,
            category: ingredientImportDatum.category,
            purchaseUnit: ingredientImportDatum.purchaseUnit,
            purchaseCost: ingredientImportDatum.purchaseCost,
            conversionRule: ingredientImportDatum.conversionRate || null,
            supplierId: eb
              .selectFrom('Supplier')
              .select('Supplier.id')
              .where('Supplier.slug', '=', supplierSlug),
            notes: ingredientImportDatum.notes,
            lastPurchased: ingredientImportDatum.lastPurchased,
          }))
          .onConflict((oc) =>
            oc.column('slug').doUpdateSet({
              // Note: supplierId is NOT in this update - immutable after creation
              name: ingredientImportDatum.name,
              category: ingredientImportDatum.category,
              purchaseUnit: ingredientImportDatum.purchaseUnit,
              purchaseCost: ingredientImportDatum.purchaseCost,
              conversionRule: ingredientImportDatum.conversionRate || null,
              notes: ingredientImportDatum.notes,
              lastPurchased: ingredientImportDatum.lastPurchased,
            })
          )
          .executeTakeFirst()

        if (existing) {
          stats.upserted++
          log.verbose('importer', `Updated ${slug}`)
        } else {
          stats.created++
          log.verbose('importer', `Created ${slug}`)
        }
      } catch (error) {
        stats.failed++
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push({ file, error: errorMsg })

        if (failFast) {
          spinner.fail(`Failed to save ${path.basename(file)}`)
          log.error('importer', `${file}: ${errorMsg}`)
          process.exit(1)
        }

        log.warn(
          'importer',
          `Failed to save ${path.basename(file)}: ${errorMsg}`
        )
      }
    }

    spinner.succeed('Saved to database')

    // Print summary
    log.info(
      'importer',
      `Summary: created=${stats.created}, upserted=${stats.upserted}, ignored=${stats.ignored}, failed=${stats.failed}`
    )

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
