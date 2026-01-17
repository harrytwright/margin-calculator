import type { PathLike } from 'fs'
import fs from 'fs/promises'
import path from 'path'

import log from '@harrytwright/logger'
import { Command } from 'commander'
import prompt from 'prompts'

import { ConfigService } from '@menubook/core'
import { createDatabaseContext, runMigrations } from '../lib/database'
import { spin } from '../utils/spinner'

export const initialise = new Command()
  .name('initialise')
  .description('Initialise the cli')
  .option('--force', 'Force the recreation', false)
  .option('-y, --yes', 'Non-interactive mode, accept defaults', false)
  .option('--vat-inclusive', 'Prices include VAT (UK/EU standard)')
  .option('--vat-exclusive', 'Prices exclude VAT (US standard)')
  .action(async function (opts, cmd) {
    log.silly('cli', { args: cmd.parent?.rawArgs }, cmd.parent?.rawArgs || [])
    log.info('initialise', 'Initialising the cli')

    const {
      location,
      working,
      workspace,
      database: dbPath,
      force,
      yes: nonInteractive,
      vatInclusive,
      vatExclusive,
    } = cmd.optsWithGlobals()

    // Detect CI environment for non-interactive mode
    const isCI = nonInteractive || process.env.CI === 'true' || process.env.NONINTERACTIVE === 'true'

    // Use location if provided, otherwise fall back to working (deprecated)
    const locationDir = location || working
    const workspaceDir = workspace

    // Create system directories (location)
    const { base: locationBase } = await spin(
      createLocationDirectory(locationDir),
      {
        text: '⚙ Creating system directories',
        successText: 'Created system directories',
      }
    )

    // Create workspace directories
    await spin(createWorkspaceDirectory(workspaceDir), {
      text: '⚙ Creating workspace directories',
      successText: 'Created workspace directories',
    })

    // Ask user about pricing preference (or use CLI option / default in non-interactive mode)
    let priceIncludesVat: boolean
    if (vatInclusive) {
      priceIncludesVat = true
    } else if (vatExclusive) {
      priceIncludesVat = false
    } else if (isCI) {
      // Default to VAT-inclusive in non-interactive mode
      priceIncludesVat = true
      log.info('initialise', 'Non-interactive mode: using VAT-inclusive pricing (default)')
    } else {
      const pricingPreference = await prompt({
        type: 'select',
        name: 'priceIncludesVat',
        message: 'How are your product prices typically displayed?',
        hint: 'This setting affects how VAT is handled in recipe pricing',
        choices: [
          {
            value: true,
            title: 'Prices include VAT/tax (UK/EU standard)',
            description:
              'Prices shown to customers already include VAT. Example: £6.00 includes VAT',
          },
          {
            value: false,
            title: 'Prices exclude tax (US standard)',
            description:
              'Sales tax is added at point of sale. Example: $6.00 + tax',
          },
        ],
        initial: 0, // Default to VAT-inclusive (UK/EU)
      })
      priceIncludesVat = pricingPreference.priceIncludesVat
    }

    // Create the config file with user's preference
    await writeDefaultConfiguration(locationBase, force, {
      defaultPriceIncludesVat: priceIncludesVat,
    })

    // Delete the old database if force is enabled
    if (force) {
      let shouldDelete: boolean

      if (isCI) {
        // In non-interactive mode with --force, default to NOT deleting (safer)
        // User can delete manually if needed
        log.info('initialise', 'Non-interactive mode: skipping database deletion (use manual deletion if needed)')
        shouldDelete = false
      } else {
        const databaseDeletion = await prompt({
          type: 'select',
          name: 'delete',
          message:
            'Force delete existing database. This is destructive. Do we proceed?',
          hint: 'Setting to `No` will still run the migration. This is to check if you wish the database to be deleted',
          choices: [
            {
              value: true,
              title: 'Yes',
            },
            { value: false, title: 'No', selected: true },
          ],
        })
        shouldDelete = databaseDeletion.delete
      }

      if (shouldDelete) {
        await fs
          .access(path.join(locationBase, dbPath))
          .then(() => fs.unlink(path.join(locationBase, dbPath)))
          .catch(() => log.verbose('initialise', 'Database does not exist'))

        log.warn('initialise', 'Database deleted')
      }
    }

    // Initialise the database file at location root
    const { context, adapter } = createDatabaseContext({
      database: dbPath,
      locationDir: locationBase,
    })

    await runMigrations(context, adapter, 'up')

    console.log(
      '\nInitialised margin system.\nLocation: ✔ (%s)\nWorkspace: ✔ (%s)',
      locationBase,
      workspaceDir
    )
  })

/**
 * Create location directory structure (system data)
 * Contains: conf/ and database file
 */
async function createLocationDirectory(dir: PathLike) {
  const base = (await fs.mkdir(dir, { recursive: true })) || dir.toString()

  const conf =
    (await fs.mkdir(path.join(dir.toString(), './conf'), {
      recursive: true,
    })) || path.join(dir.toString(), './conf')

  return { base, conf }
}

/**
 * Create workspace directory structure (user YAML files)
 * Contains: suppliers/, ingredients/, recipes/
 */
async function createWorkspaceDirectory(dir: PathLike) {
  const base = (await fs.mkdir(dir, { recursive: true })) || dir.toString()

  // Create subdirectories for YAML files
  await fs.mkdir(path.join(base, 'suppliers'), { recursive: true })
  await fs.mkdir(path.join(base, 'ingredients'), { recursive: true })
  await fs.mkdir(path.join(base, 'recipes'), { recursive: true })

  return { base }
}

// Use `force` for overwriting the previous configuration. Clean the slate as you will.
function writeDefaultConfiguration(
  dir: string,
  force: boolean,
  overrides: any = {}
) {
  return spin(
    async () => {
      const conf = new ConfigService(dir)
      return conf.initialise(force, overrides)
      // // If the file exists and we have force enabled just return early.
      // let prev: {} = {}
      // try {
      //   prev = toml.parse(await fs.readFile(path, { encoding: 'utf8' }))
      // } catch (err) {
      //   log.error('initialise', err)
      // }
      //
      // if (force) {
      //   prev = {
      //     vat: 0.2,
      //     marginTarget: 20,
      //   }
      // } else {
      //   prev = Object.assign(
      //     {
      //       vat: 0.2,
      //       marginTarget: 20,
      //     },
      //     prev
      //   )
      // }
      //
      // return fs.writeFile(
      //   path,
      //   tomlWriter(prev, { newlineAfterSection: true }),
      //   'utf8'
      // )
    },
    {
      text: '⚙ Initialising configuration',
      successText: 'Configuration initialised',
      failText: (err) => `Failed to initialise due to ${err}`,
    }
  )
}
