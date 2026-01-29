import { registerMiddleware } from '@harrytwright/api/dist/core'

import onFinished from 'on-finished'

import { Prometheus } from '../module'

import { NextFunction, Request, Response } from 'express'

// Overwrite the original morgan, using its context to infer request details
//
// Could look at stripping that out all together as its own middleware, using a callback to log, or send metrics.
export const inflight = registerMiddleware(
  'inflight',
  function (prometheus) {
    /* istanbul ignore next */
    return (req: Request, res: Response, next: NextFunction) => {
      prometheus.httpInFlight.inc()

      onFinished(res, () => {
        prometheus.httpInFlight.dec()
      })

      next()
    }
  },
  Prometheus
)
