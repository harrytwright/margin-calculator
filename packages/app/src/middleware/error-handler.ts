import log from '@harrytwright/logger'
import erred from '@hndlr/erred'
import { Conflict, HTTPError } from '@hndlr/errors'
import * as Sentry from '@sentry/node'
import type { Request } from 'express'

import { errorHandler } from '../modules/auth/middleware/error.handler'

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

const middleware = Sentry.expressErrorHandler()

const sentry = (err: HTTPError, req: Request) => {
  if (!Sentry.isInitialized()) return

  middleware(err, req, {} as any, () => {})
}

const handler = erred({
  default500: true,
  stack: Boolean(process.env['FLAG_STACK']) || !isProduction(),
  integrations: [sentry, (err, _, res) => log.error('error:handler', err)],
})

handler.use(errorHandler)

handler.use(function (error: Error & Record<string, any>, req) {
  if (!error.code) {
    return undefined
  }

  switch (error.code) {
    case 'ER_DUP_ENTRY':
    case 'ER_DUP_ENTRY_WITH_KEY_NAME':
      const CONSTRAINT_REGEX = /Duplicate entry '(.+)' for key '(.+)'/
      const constraintMatch = CONSTRAINT_REGEX.exec(error.sqlMessage)

      if (!constraintMatch) return undefined

      const constraintParts = constraintMatch[2].split('.')
      const table = constraintParts[0],
        constraint = constraintParts[1]

      const message = `The resource you are trying to ${
        req.method.toLowerCase() === 'post' ? 'create' : 'update'
      } conflicts with an existing resource.`
      const reason = `The ${table} failed to pass '${constraint}'`

      return Object.assign(new Conflict(message), {
        meta: { reason, sql: error.sqlMessage },
      })
  }

  return undefined
})

export default handler
