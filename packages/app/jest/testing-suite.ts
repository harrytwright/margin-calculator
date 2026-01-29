// Very, very, jammy, but it works lmao

/* istanbul ignore next */

import './mocks/logger'

import { afterAll, beforeAll, expect, test } from '@jest/globals'

import util from 'util'

import { BuilderContext } from '@harrytwright/api/dist/builders/builder'
import { Constructable } from '@harrytwright/api/dist/common/interfaces'
import {
  API,
  BodyParser,
  http,
  NotFound,
  useController,
  useErrorHandler,
  useMiddleware,
} from '@harrytwright/api/dist/core'
import { Config } from '@harrytwright/cli-config'
import JsonWebToken from 'jsonwebtoken'
import supertest from 'supertest'

import { Container } from '@harrytwright/api/dist/core/injection/container'
import { Container as BaseContainer } from '@harrytwright/api/dist/injection'
import { ServiceIdentifier } from '@harrytwright/api/dist/injection/types/service-identifier.type'
import { AppConfig } from '../src/config'
// import { KyselyDatastore } from '../src/datastore/kysely.datastore'
import handler from '../src/middleware/error-handler'
import { Authentication } from '../src/modules/auth/middleware/authentication'
import { Auth, isValidPrivateKey } from '../src/modules/auth/module'
// import { BullHandler } from '../src/modules/bull-mq/client/bull.handler'
// import { RabbitmqClient } from '../src/modules/events/client/rabbitmq.client'
import { DatabaseContext } from '@menubook/core'
import { inflight } from '../src/modules/metrics/middleware/inflight'
import { expressRequestHandler } from '../src/modules/sentry/middleware/wrapper'
import { Abort } from '../src/utils/abort'
import setupLog from '../src/utils/setup-log'

export { __unsafe_TestingSuite as TestingSuite } from '@harrytwright/api/dist/test/testing-suite'
export type { ITestingSuite } from '@harrytwright/api/dist/test/testing-suite'

// Add logging here if we need it
let _logger: (msg: string, ...items: any[]) => unknown
const debug = (msg: string, ...items: any[]) => {
  if (_logger !== undefined) return _logger(msg, ...items)

  _logger = require('util').debug('testing-suite')
}

/* istanbul ignore next */
export function generateApplet(controller: Constructable<any>) {
  // Try and keep this as close to real as possible
  @http()
  @useController(controller)
  @useMiddleware(inflight)
  @useMiddleware(expressRequestHandler())
  @useMiddleware(Authentication)
  @BodyParser.json({ type: ['application/*+json', 'application/json'] })
  @NotFound()
  @useErrorHandler(handler)
  class App {}

  return App
}

/* istanbul ignore next */
export function errorMessageShouldBe(message: any) {
  return function (res: supertest.Response) {
    expect(res.body).toBeDefined()
    expect(res.body.error).toBeDefined()

    if (message instanceof RegExp) {
      expect(res.body.error.message).toMatch(message)
    } else {
      expect(res.body.error.message).toStrictEqual(message)
    }
  }
}

export async function handle<A extends any>(
  fn: Promise<A> | undefined,
  callback: (err?: Error) => void
): Promise<void> {
  if (!fn) {
    return Promise.resolve(callback(undefined))
  }

  try {
    const value = await fn!
    expect(value).toBeUndefined()
  } catch (err: any) {
    if ('matcherResult' in err) throw err
    return callback(err)
  }
}

const hasOwnProperty = (obj: object, property: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(obj, property)

export function flatten(obj: Record<any, any>, deliminator: string = '.') {
  const result: Record<any, any> = {}

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
export function fatten(obj: Record<any, any>, deliminator: string = '.') {
  const result: Record<any, any> = {}
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

export type Methods = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export type Exporter = {
  path: string

  regex?: string

  default?: string
}

export interface WorkFlow {
  route: string
  method: Methods
  body?: any
  auth?: boolean | string
  headers?: Record<string, any>
  tests?: { [key: 'status' | 'content-type' | 'body' | string]: any }[]
  exports?: Record<string, string | Exporter>
  name?: string
  host?: string
  wait?: number
  timeout?: number
}

export type WorkFlows = {
  [key: string]: WorkFlow[]
}

export type Hook = (
  applet: BuilderContext | undefined,
  ctx: Record<string, Record<string, any>>,
  config?: Config<AppConfig>
) => Promise<void>

export type BeforeEachHook = (
  req: ReturnType<supertest.Agent[Lowercase<Methods>]>,
  flow: WorkFlow,
  agent: supertest.Agent
) => Promise<ReturnType<supertest.Agent[Lowercase<Methods>]>>

export type AfterEachHook = (
  req: ReturnType<supertest.Agent[Lowercase<Methods>]>,
  res: supertest.Response,
  flow: WorkFlow,
  ctx: Record<string, Record<string, any>>
) => Promise<void>

export interface Hooks {
  before?: Hook
  after?: Hook
  beforeEach?: BeforeEachHook
  afterEach?: AfterEachHook
}

export async function handleFlow(
  workflow: WorkFlow[],
  base: string | Constructable<any>,
  runnerCtx: Record<string, any>,
  hooks?: Hooks,
  builder: typeof API = API,
  auth: boolean = true
) {
  let applet: BuilderContext | undefined
  let ctx: Record<string, Record<string, any>>
  let request: supertest.Agent
  let authHeader: string

  beforeAll(async () => {
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
      setupLog(config)

      if (typeof base !== 'string') {
        applet = builder.create(base, config)
        await applet?.listen()
      }

      const privateKey = process.env['TEST_JWT_PRIVATE_KEY']
      if (privateKey) {
        const priv = await Auth.parseKSAKey(privateKey)
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
        if (auth)
          throw new Error('Cannot run tests without a private key or api-key')
        else debug('Skipping auth header creation as auth is disabled')
      }
      debug('Created an auth header - %o', authHeader)

      const server = applet?.server?.raw
      request = supertest.agent(server || (base as string))

      hooks?.before && (await hooks?.before(applet, ctx, config))
    } catch (err) {
      // Log this out to stderr, ignore debug as we need to see this
      _errorLogger(err)

      await cleanup(applet)
      return Promise.reject(err)
    }
  })

  afterAll(async () => {
    await (applet ? cleanup(applet) : {})
    hooks?.after && (await hooks?.after(applet, ctx))
  })

  for (const flow of workflow) {
    debug('Creating %s', flow.name ?? `${flow.method} - ${flow.route}`)

    test(
      flow.name ?? `${flow.method} - ${flow.route}`,
      async function () {
        return handler(flow, ctx, request)
      },
      flow.timeout ? flow.timeout + 1000 : 5000
    )
  }

  async function handler(
    flow: WorkFlow,
    ctx: Record<string, Record<string, any>>,
    request: supertest.Agent
  ) {
    // Allow for other hosts to be used during the flow, may we need to call an external service etc
    const curr = flow.host ? supertest.agent(flow.host) : request

    if (flow.wait) {
      debug('Waiting %sms', flow.wait)
      await sleep(flow.wait)
    }

    // Get the method
    const method = <Lowercase<Methods>>flow.method.toLowerCase()

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
    if (auth && flow.auth) {
      const authIsString = typeof flow.auth === 'string'

      if (!authHeader && !authIsString)
        throw new Error('Unable to find an auth header')

      req = req.auth(
        authIsString
          ? parseInterpolation(flow.auth as string, { ...ctx })
          : authHeader,
        { type: 'bearer' }
      )
    } else if (flow.auth && !auth) {
      throw new Error(
        'Mismatch config. Auth set for runner, but suite set to false'
      )
    }

    let res: supertest.Response
    try {
      // @ts-ignore
      req = (await hooks?.beforeEach?.(req, flow, curr)) || req

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
            expect(res.status).toEqual(value)
            break
          case 'content-type':
            expect(res.type).toEqual(value)
            break
          case 'body':
            expect(res.body).toMatchObject(
              parseBody(value, { ...ctx }) as Record<string, any>
            )
            break
          case 'not-body':
            expect(res.body).not.toMatchObject(
              parseBody(value, { ...ctx }) as Record<string, any>
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
                const data = <string>require('lodash.get')(res.body, value.path)
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

    await (hooks?.afterEach?.(req, res, flow, ctx) || Promise.resolve())
  }
}

function parseBody(
  body: Array<Record<string, any>> | Record<string, any> | string,
  context: Record<string, any>
): Array<Record<string, any>> | Record<string, any> | string {
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

function parseInterpolation(value: any, context: Record<string, any>) {
  if (!interpolationRegex.test(value) || typeof value !== 'string') return value
  interpolationRegex.lastIndex = 0

  const itr = value.replaceAll(interpolationRegex, '%s')
  const matches = Array.from(value.matchAll(interpolationRegex))
    .map((el) => el[1].trim()) // Need to trim
    .map((el) => {
      const path = el.split('.')
      if (path[0] === 'config' && context.config) {
        return (<Config<AppConfig>>context.config).get(path[1])
      }

      return require('lodash.get')(context, path)
    })

  debug('interpolating %o with %o', value, matches)
  return util.format(itr, ...matches)
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function sign(payload: object, priv: string): Promise<string> {
  // const header = { alg: 'RS256' };
  const opts: Record<any, any> = {}

  const isPrivKey = isValidPrivateKey(priv)
  if (isPrivKey) opts.header = { alg: 'RS256' }

  return new Promise((resolve, reject) => {
    JsonWebToken.sign(payload, priv, opts, (error, encoded) => {
      if (error) return reject(error)

      resolve(encoded!)
    })
  })
}

export async function cleanup(
  applet?:
    | BuilderContext
    | BaseContainer
    | Container
    | { get: <T>(v: ServiceIdentifier) => T | undefined },
  container?:
    | BaseContainer
    | Container
    | { get: <T>(v: ServiceIdentifier) => T | undefined }
) {
  if (!container && applet && applet instanceof BuilderContext) {
    container = applet.container
    await applet?.server?.close()

    applet?.server?.removeAllListeners()
  } else if (
    !container &&
    applet &&
    (applet instanceof BaseContainer ||
      applet instanceof Container ||
      'get' in applet)
  ) {
    container = applet
  }

  const closers = []

  try {
    const database = container?.get<DatabaseContext>('database')

    if (database) {
      closers.push(database?.db.destroy())
    }
  } catch (err) {}

  // try {
  //   // RabbitmqClient
  //   const events = container?.get<RabbitmqClient>(RabbitmqClient)
  //
  //   if (events) {
  //     closers.push((<RabbitmqClient>events).destroy())
  //   }
  // } catch (err) {}
  //
  // try {
  //   // Abort
  //   const bullmq = container?.get<BullHandler>(BullHandler)
  //
  //   if (bullmq) {
  //     closers.push(bullmq.close(true))
  //   }
  // } catch (err) {}

  try {
    // Abort
    const abort = container?.get<Abort>(Abort)

    if (abort) {
      closers.push(abort.abort('clean_up'))
    }
  } catch (err) {}

  if (closers.length === 0) return Promise.resolve()

  // These are the given values, used by everything
  return Promise.allSettled(closers)
}

export function supertestLogger(res: supertest.Response) {
  console.log('%j', res.body)
}

export function testDebugLog(msg: any, ...args: any[]) {
  if (process.env.NODE_ENV === 'test') {
    console.trace(msg, ...args)
  }
}

function _errorLogger(error: any) {
  console.error(error)
  console.debug(error)

  if (error instanceof AggregateError) {
    error.errors.map((err) => console.error(err))
  }

  if ('cause' in error) {
    _errorLogger(error.cause)
  }
}
