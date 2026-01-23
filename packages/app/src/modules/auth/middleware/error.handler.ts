import log from '@harrytwright/logger'
import { Plugin } from '@hndlr/erred'
import { Forbidden, InternalServerError } from '@hndlr/errors'
import {
  JsonWebTokenError,
  NotBeforeError,
  TokenExpiredError,
  VerifyErrors,
} from 'jsonwebtoken'

/* istanbul ignore next */
export const errorHandler: Plugin = (err, req) => {
  log.verbose(
    'auth:error-handler',
    'Processing error [%s] isJWTError? %s',
    err.message,
    isJWTError(err)
  )
  if (!isJWTError(err)) return undefined

  if (err instanceof TokenExpiredError) {
    return Object.assign(
      new Forbidden(`JWT expired at ${err.expiredAt.toDateString()}`),
      {
        stack: err.stack,
      }
    )
  } else if (err instanceof NotBeforeError) {
    return Object.assign(
      new Forbidden(
        `Current time is before the nbf claim: ${err.date.toDateString()}`
      ),
      {
        stack: err.stack,
      }
    )
  } else {
    return Object.assign(new InternalServerError(err.message, [err.inner]), {
      stack: err.stack,
    })
  }
}

function isJWTError(err: Error): err is VerifyErrors {
  return err instanceof JsonWebTokenError
}
