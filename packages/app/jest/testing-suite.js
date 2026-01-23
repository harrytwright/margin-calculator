'use strict'
// Very, very, jammy, but it works lmao
var __decorate =
  (this && this.__decorate) ||
  function (decorators, target, key, desc) {
    var c = arguments.length,
      r =
        c < 3
          ? target
          : desc === null
            ? (desc = Object.getOwnPropertyDescriptor(target, key))
            : desc,
      d
    if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function')
      r = Reflect.decorate(decorators, target, key, desc)
    else
      for (var i = decorators.length - 1; i >= 0; i--)
        if ((d = decorators[i]))
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r
    return (c > 3 && r && Object.defineProperty(target, key, r), r)
  }
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.TestingSuite = void 0
exports.generateApplet = generateApplet
exports.errorMessageShouldBe = errorMessageShouldBe
exports.handle = handle
exports.flatten = flatten
exports.fatten = fatten
exports.handleFlow = handleFlow
exports.sleep = sleep
exports.sign = sign
exports.cleanup = cleanup
exports.supertestLogger = supertestLogger
exports.testDebugLog = testDebugLog
/* istanbul ignore next */
require('./mocks/logger')
const globals_1 = require('@jest/globals')
const util_1 = __importDefault(require('util'))
const builder_1 = require('@harrytwright/api/dist/builders/builder')
const core_1 = require('@harrytwright/api/dist/core')
const jsonwebtoken_1 = __importDefault(require('jsonwebtoken'))
const supertest_1 = __importDefault(require('supertest'))
const container_1 = require('@harrytwright/api/dist/core/injection/container')
const injection_1 = require('@harrytwright/api/dist/injection')
const kysely_datastore_1 = require('../src/datastore/kysely.datastore')
const error_handler_1 = __importDefault(
  require('../src/middleware/error-handler')
)
const auth_module_1 = require('../src/modules/auth/auth.module')
const authentication_1 = require('../src/modules/auth/middleware/authentication')
const bull_handler_1 = require('../src/modules/bull-mq/client/bull.handler')
const rabbitmq_client_1 = require('../src/modules/events/client/rabbitmq.client')
const inflight_1 = require('../src/modules/prometheus/middleware/inflight')
const wrapper_1 = require('../src/modules/sentry/middleware/wrapper')
const abort_1 = require('../src/utils/abort')
const setup_log_1 = __importDefault(require('../src/utils/setup-log'))
var testing_suite_1 = require('@harrytwright/api/dist/test/testing-suite')
Object.defineProperty(exports, 'TestingSuite', {
  enumerable: true,
  get: function () {
    return testing_suite_1.__unsafe_TestingSuite
  },
})
// Add logging here if we need it
let _logger
const debug = (msg, ...items) => {
  if (_logger !== undefined) return _logger(msg, ...items)
  _logger = require('util').debug('testing-suite')
}
/* istanbul ignore next */
function generateApplet(controller) {
  // Try and keep this as close to real as possible
  let App = class App {}
  App = __decorate(
    [
      (0, core_1.http)(),
      (0, core_1.useController)(controller),
      (0, core_1.useMiddleware)(inflight_1.inflight),
      (0, core_1.useMiddleware)((0, wrapper_1.expressRequestHandler)()),
      (0, core_1.useMiddleware)(authentication_1.Authentication),
      core_1.BodyParser.json({
        type: ['application/*+json', 'application/json'],
      }),
      (0, core_1.NotFound)(),
      (0, core_1.useErrorHandler)(error_handler_1.default),
    ],
    App
  )
  return App
}
/* istanbul ignore next */
function errorMessageShouldBe(message) {
  return function (res) {
    ;(0, globals_1.expect)(res.body).toBeDefined()
    ;(0, globals_1.expect)(res.body.error).toBeDefined()
    if (message instanceof RegExp) {
      ;(0, globals_1.expect)(res.body.error.message).toMatch(message)
    } else {
      ;(0, globals_1.expect)(res.body.error.message).toStrictEqual(message)
    }
  }
}
async function handle(fn, callback) {
  if (!fn) {
    return Promise.resolve(callback(undefined))
  }
  try {
    const value = await fn
    ;(0, globals_1.expect)(value).toBeUndefined()
  } catch (err) {
    if ('matcherResult' in err) throw err
    return callback(err)
  }
}
const hasOwnProperty = (obj, property) =>
  Object.prototype.hasOwnProperty.call(obj, property)
function flatten(obj, deliminator = '.') {
  const result = {}
  for (const key in obj) {
    if (!hasOwnProperty(obj, key)) continue
    if (typeof obj[key] === 'object' && !!obj[key]) {
      const child = flatten(obj[key])
      for (const childKey in child) {
        if (!hasOwnProperty(child, childKey)) continue
        result[key + deliminator + childKey] = child[childKey]
      }
    } else {
      result[key] = obj[key]
    }
  }
  return result
}
function fatten(obj, deliminator = '.') {
  const result = {}
  for (const flattenedKey in obj) {
    const keys = flattenedKey.split(deliminator)
    keys.reduce(function (r, e, j) {
      return (
        r[e] ||
        (r[e] = isNaN(Number(keys[j + 1]))
          ? keys.length - 1 === j
            ? obj[flattenedKey]
            : {}
          : [])
      )
    }, result)
  }
  return result
}
const interpolationRegex = /\${{\s?([^{}]+)\s?}}/g
async function handleFlow(
  workflow,
  base,
  runnerCtx,
  hooks,
  builder = core_1.API
) {
  let applet
  let ctx
  let request
  let authHeader
  ;(0, globals_1.beforeAll)(async () => {
    const started = new Date()
    const aYearFromNow = new Date(started)
    aYearFromNow.setDate(aYearFromNow.getDate() + 1)
    aYearFromNow.setFullYear(aYearFromNow.getFullYear() + 1)
    const aMonthFromNow = new Date(started)
    aMonthFromNow.setDate(aMonthFromNow.getDate() + 1)
    aMonthFromNow.setMonth(aMonthFromNow.getMonth() + 1)
    try {
      ctx = {
        suite: {
          now: Math.floor(started.getTime() / 1000),
          monthFromNow: Math.floor(aMonthFromNow.getTime() / 1000),
          yearFromNow: Math.floor(aYearFromNow.getTime() / 1000),
        },
        runner: runnerCtx,
        cookies: {},
        exports: {},
        env: process.env,
      }
      const { config } = await import('../src/config')
      if (!config.loaded) config.load()
      ctx['config'] = config
      ;(0, setup_log_1.default)(config)
      if (typeof base !== 'string') {
        applet = builder.create(base, config)
        await applet?.listen()
      }
      const privateKey = process.env['TEST_JWT_PRIVATE_KEY']
      if (privateKey) {
        const priv = await auth_module_1.Auth.parseKSAKey(privateKey)
        debug('Running with a private key for signing - %s', priv)
        authHeader = await sign(ctx.runner.jwt, priv)
      } else if (config.get('token-api-key')) {
        // Create a new admin style JWT, so ignore the one from the runnerCtx
        authHeader = await (
          await fetch('http://localhost:15678/tokens', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-KEY': config.get('token-api-key'),
            },
            body: JSON.stringify(ctx.runner.jwt),
          })
        ).text()
      } else {
        throw new Error('Cannot run tests without a private key or api-key')
      }
      debug('Created an auth header - %o', authHeader)
      const server = applet?.server?.raw
      request = supertest_1.default.agent(server || base)
      hooks?.before && (await hooks?.before(applet, ctx, config))
    } catch (err) {
      // Log this out to stderr, ignore debug as we need to see this
      _errorLogger(err)
      await cleanup(applet)
      return Promise.reject(err)
    }
  })
  ;(0, globals_1.afterAll)(async () => {
    await (applet ? cleanup(applet) : {})
    hooks?.after && (await hooks?.after(applet, ctx))
  })
  for (const flow of workflow) {
    debug('Creating %s', flow.name ?? `${flow.method} - ${flow.route}`)
    ;(0, globals_1.test)(
      flow.name ?? `${flow.method} - ${flow.route}`,
      async function () {
        return handler(flow, ctx, request)
      },
      flow.timeout ? flow.timeout + 1000 : 5000
    )
  }
  async function handler(flow, ctx, request) {
    // Allow for other hosts to be used during the flow, may we need to call an external service etc
    const curr = flow.host ? supertest_1.default.agent(flow.host) : request
    if (flow.wait) {
      debug('Waiting %sms', flow.wait)
      await sleep(flow.wait)
    }
    // Get the method
    const method = flow.method.toLowerCase()
    debug('Running %o with %o', flow.name || flow.route, {
      ...ctx,
      config: 'AppConfig',
      env: 'process.env',
    })
    const route = parseInterpolation(flow.route, { ...ctx })
    debug('Creating %s request for %s', flow.method, route)
    // Generate the `request.(get|post|put|*)`
    let req = curr[method](route)
    // Add the body
    if (flow.body) {
      const body = parseBody(flow.body, { ...ctx })
      debug('Sending %o', body)
      req = req.send(body)
    }
    // Move over any headers
    //
    // Maybe add checks here to see if they're valid or not??
    if (flow.headers) {
      debug('Adding headers %o', flow.headers)
      for (const [header, value] of Object.entries(flow.headers)) {
        req = req.set(header, parseInterpolation(value, { ...ctx }))
      }
    }
    // This is not ideal, but will work for now, jwt technically can be created w/ a DI as it only depends
    // on config, in the test file, but would need describe to be async
    if (flow.auth) {
      const authIsString = typeof flow.auth === 'string'
      if (!authHeader && !authIsString)
        throw new Error('Unable to find an auth header')
      req = req.auth(
        authIsString ? parseInterpolation(flow.auth, { ...ctx }) : authHeader,
        { type: 'bearer' }
      )
    }
    let res
    try {
      res = await req
      debug('Received %j', /text\/.*/.test(res.type) ? res.text : res.body)
    } catch (err) {
      debug('Threw %o', err)
      throw err
    }
    if (res.headers['st-access-token'] && !authHeader) {
      authHeader = res.headers['st-access-token']
    }
    if (flow.tests) {
      for (const [test, value] of Object.entries(flow.tests)) {
        switch (test) {
          case 'status':
            ;(0, globals_1.expect)(res.status).toEqual(value)
            break
          case 'content-type':
            ;(0, globals_1.expect)(res.type).toEqual(value)
            break
          case 'body':
            ;(0, globals_1.expect)(res.body).toMatchObject(
              parseBody(value, { ...ctx })
            )
            break
          case 'not-body':
            ;(0, globals_1.expect)(res.body).not.toMatchObject(
              parseBody(value, { ...ctx })
            )
            break
          default:
            throw new Error('Not yet implemented')
        }
      }
    }
    if (flow.exports) {
      for (const [key, value] of Object.entries(flow.exports)) {
        switch (value) {
          case 'status':
            ctx.exports[key] = res.status
            break
          case 'body':
            ctx.exports[key] = /text\/.*/.test(res.type) ? res.text : res.body
            break
          default:
            if (typeof value !== 'string' && 'path' in value) {
              if (value.regex) {
                const data = require('lodash.get')(res.body, value.path)
                const regex = new RegExp(`(?<${key}>${value.regex})`)
                debug('exporting %s with %o from %s', key, regex, value.path)
                const groups = data.match(regex)?.groups || {
                  [key]: value.default,
                }
                ctx.exports[key] = groups[key]
              } else {
                ctx.exports[key] =
                  require('lodash.get')(res, value.path) || value.default
              }
            } else {
              ctx.exports[key] = require('lodash.get')(res, value)
            }
        }
      }
    }
  }
}
function parseBody(body, context) {
  if (Array.isArray(body)) return body.map((el) => parseBody(el, context))
  if (typeof body === 'string') {
    return parseInterpolation(body, context)
  }
  const flattened = flatten(body)
  for (const [key, value] of Object.entries(flattened)) {
    flattened[key] = parseInterpolation(value, context)
  }
  return fatten(flattened)
}
function parseInterpolation(value, context) {
  if (!interpolationRegex.test(value) || typeof value !== 'string') return value
  interpolationRegex.lastIndex = 0
  const itr = value.replaceAll(interpolationRegex, '%s')
  const matches = Array.from(value.matchAll(interpolationRegex))
    .map((el) => el[1].trim()) // Need to trim
    .map((el) => {
      const path = el.split('.')
      if (path[0] === 'config' && context.config) {
        return context.config.get(path[1])
      }
      return require('lodash.get')(context, path)
    })
  debug('interpolating %o with %o', value, matches)
  return util_1.default.format(itr, ...matches)
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
function sign(payload, priv) {
  // const header = { alg: 'RS256' };
  const opts = {}
  const isPrivKey = (0, auth_module_1.isValidPrivateKey)(priv)
  if (isPrivKey) opts.header = { alg: 'RS256' }
  return new Promise((resolve, reject) => {
    jsonwebtoken_1.default.sign(payload, priv, opts, (error, encoded) => {
      if (error) return reject(error)
      resolve(encoded)
    })
  })
}
async function cleanup(applet, container) {
  if (!container && applet && applet instanceof builder_1.BuilderContext) {
    container = applet.container
    await applet?.server?.close()
    applet?.server?.removeAllListeners()
  } else if (
    !container &&
    applet &&
    (applet instanceof injection_1.Container ||
      applet instanceof container_1.Container ||
      'get' in applet)
  ) {
    container = applet
  }
  const closers = []
  try {
    const database = container?.get(kysely_datastore_1.KyselyDatastore)
    if (database) {
      closers.push(database?.destroy())
    }
  } catch (err) {}
  try {
    // RabbitmqClient
    const events = container?.get(rabbitmq_client_1.RabbitmqClient)
    if (events) {
      closers.push(events.destroy())
    }
  } catch (err) {}
  try {
    // Abort
    const bullmq = container?.get(bull_handler_1.BullHandler)
    if (bullmq) {
      closers.push(bullmq.close(true))
    }
  } catch (err) {}
  try {
    // Abort
    const abort = container?.get(abort_1.Abort)
    if (abort) {
      closers.push(abort.abort('clean_up'))
    }
  } catch (err) {}
  if (closers.length === 0) return Promise.resolve()
  // These are the given values, used by everything
  return Promise.allSettled(closers)
}
function supertestLogger(res) {
  console.log('%j', res.body)
}
function testDebugLog(msg, ...args) {
  if (process.env.NODE_ENV === 'test') {
    console.trace(msg, ...args)
  }
}
function _errorLogger(error) {
  console.error(error)
  console.debug(error)
  if (error instanceof AggregateError) {
    error.errors.map((err) => console.error(err))
  }
  if ('cause' in error) {
    _errorLogger(error.cause)
  }
}
//# sourceMappingURL=testing-suite.js.map
