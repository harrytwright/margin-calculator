import fs from 'fs/promises'
import path from 'path'

import log from '@harrytwright/logger'
import { Command } from 'commander'
import yaml from 'yaml'

import ora from 'ora'
import { database } from '../datastore/database'
import {
  SupplierImportData,
  isSupplierImport,
  parseImportFile,
} from '../schema'
import { findById, upsert } from '../services/supplier'
import { hasChanges } from '../utils/has-changes'
import { isInitialised } from '../utils/is-initialised'
import { slugify } from '../utils/slugify'
import { defaultWorkingDir } from './initialise'

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
        'suppliers.import',
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
    let spinner = ora('✨Loading suppliers')
    const processed: Array<{ file: string; data: SupplierImportData }> = []

    for (const file of files) {
      try {
        const content = await fs.readFile(file, { encoding: 'utf8' })
        const parsed = yaml.parse(content)
        const data = parseImportFile(parsed)

        if (!isSupplierImport(data)) {
          throw new Error('Not a valid supplier object')
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
      spinner.fail('No valid suppliers to import')
      process.exit(1)
    }

    spinner.succeed(`Loaded ${processed.length}/${files.length} suppliers`)

    spinner.start('⚙ Saving suppliers to database')
    const db = database(path.join(working, './data', dbName))

    for (const { file, data: supplierImportDatum } of processed) {
      try {
        const slug =
          supplierImportDatum.slug || (await slugify(supplierImportDatum.name))

        // Check if the supplier already exists
        const existing = await findById.call(db, slug)

        // Check if any fields have changed
        const hasChanged = hasChanges(existing, supplierImportDatum, {
          name: 'name',
        })

        // Skip if no changes detected
        if (existing && !hasChanged) {
          stats.ignored++
          log.verbose('importer', `Skipping ${slug}: no changes`)
          continue
        }

        // Perform upsert
        await upsert.call(db, slug, supplierImportDatum)

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

export const supplier = new Command()
  .name('supplier')
  .description('Handle the suppliers within the database')
  .addCommand(importer)
