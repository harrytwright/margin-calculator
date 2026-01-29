import { Config } from '@harrytwright/cli-config'
import log from '@harrytwright/logger'
import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'

import { AppConfig } from '../../config'
import { BaseSentryConfig } from './config'

/**
 * Everything ran here is before `API.load(config).listen()`
 * */

// This file is not tested at all, and in theory should be ignored, by coverage as all it does
// is just injects sentry when needed

/* istanbul ignore next */
export function sentryModule(config: Config<AppConfig & BaseSentryConfig>) {
  if (!config.loaded) throw new Error('Must be called after `config.load()`')

  if (!config.get('sentry-dsn')) {
    log.info(
      'sentry',
      'This installation of %s will not have sentry enabled',
      config.get('name')
    )
    log.info('sentry', 'In order to enable sentry pass your DSN via the CLI')
    return
  }

  log.info(
    'sentry',
    { dsn: config.get('sentry-dsn') },
    'This installation of %s has sentry enabled',
    config.get('name')
  )
  log.warn(
    'sentry',
    'Please note this is in development, issues with this module should be raised to the maintainers'
  )

  // Lazy initialisation of this after config is loaded
  Sentry.init({
    // Set the DSN dynamically, since this is a microservice and can be used by many different projects of mine
    // I need this to be dynamic, and also allow me not to set it if I don't want to
    dsn: config.get('sentry-dsn'),

    // Add extra integrations
    integrations: [
      // Add our Profiling integration
      nodeProfilingIntegration(),
    ],

    // Add Tracing by setting tracesSampleRate
    // We recommend adjusting this value in production
    tracesSampleRate: config.get('sentry-sample-rate') || 1.0,

    // Set sampling rate for profiling
    // This is relative to tracesSampleRate
    profilesSampleRate: 1.0,

    // Set the environment from the config
    environment: config.get('node-env'),
  })

  return
}
