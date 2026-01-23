import { ConfigService, DatabaseContext } from '@menubook/core'
import type { EventEmitter } from 'events'

import { App } from './app'

export type ServerConfig = {
  // Where the configuration files are stored
  location: string
  // The database context, if DEMO=true is passed, this is ignored
  database: DatabaseContext
  // Should the browser be opened automatically, defaults to true
  openBrowser?: boolean
  // The passed event emitter, if not passed a new one is created
  // Note: 1.0.0, this should be removed in favour of RabbitMQ or BullMQ
  event?: EventEmitter
}

export async function main(conf: ServerConfig) {
  // Load any .env files
  require('./env')

  const path = require('path')

  // This is needed loading of the config
  const { name, version } = require(
    path.resolve(process.cwd(), './package.json')
  )
  process.title = name

  // Get the logger and pause it for now
  const log = require('@harrytwright/logger')
  log.pause()

  // Log some very basic info
  log.verbose('cli', { agv: safeArgs(process.argv) }, safeArgs(process.argv))
  log.info('using', '%s@%s', name, version)
  log.info('using', 'node@%s', process.version)

  // Load the configuration
  const { config } = require('./config')
  config.load()

  // Log the default values to the console
  log.info(
    'init',
    { port: config.get('port'), pid: process.pid },
    '%s starting',
    name
  )

  // Set up the logging and resume, and sentry, this is done here as it is
  // separate to the rest of the application, w/o any DI
  require('./utils/setup-log').default(config)
  require('./modules/sentry/module').sentryModule(config)

  const { API } = require('@harrytwright/api/dist/core')

  const [applet] = await API.register(App)
    .register('globalConfig', new ConfigService(conf.location))
    .register('database', conf.database)
    .load(config)
    .listen()

  log.notice('service', '%s listening @ http://localhost:%s', name, applet.port)
  log.resume('service', 'Press CTRL+C to exit')

  if (conf.openBrowser) {
    try {
      const open = (await import('open')).default
      await open(`http://localhost:${applet.port}`)
    } catch (error) {
      log.error('service', error, 'Failed to open browser')
    }
  }

  return {
    close: async () => {
      log.info('service', 'Shutting down...')
      await applet.close()
      log.info('', 'goodbye!')
    },
  }
}

export default main

/**
 * Redact any important info i.e passwords from args for logging
 *
 * TODO: work on...
 *
 * @param {[string]} args
 * */
function safeArgs(args: string[]) {
  const mut = [...args]
  for (let i = 0; i < mut.length; i++) {
    const key = mut[i]
    if (/(password|username)/.test(key) && !mut[i + 1].startsWith('--')) {
      mut[i + 1] = 'redacted'
    }
  }
  return mut
}
