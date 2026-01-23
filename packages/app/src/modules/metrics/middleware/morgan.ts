import { registerMiddleware } from '@harrytwright/api/dist/core'

import { Prometheus } from '../module'

import { morgan as defaultMorgan } from '../../../middleware/morgan'

// Overwrite the original morgan, using its context to infer request details
//
// Could look at stripping that out all together as its own middleware, using a callback to log, or send metrics.
export const morgan = registerMiddleware(
  'morgan',
  function (prometheus) {
    /* istanbul ignore next */
    return defaultMorgan(require('@harrytwright/logger'), (ctx, _, res) => {
      // Ignore these values when reporting the metric
      // @ts-ignore
      if (res.get('X-REASON-NOT-FOUND') === 'route') {
        prometheus.http404Route
          .labels(ctx.mountpath || ctx.path || ctx.url)
          .inc()
        return
      }

      // Use `ctx.mountpath` to keep label cardinality low: no IDs/URLs/etc, just express path expression
      prometheus.httpReq
        .labels(
          ctx.method,
          ctx.mountpath || ctx.path || ctx.url,
          ctx.status || '500'
        )
        .inc()

      ctx['response-time'] &&
        prometheus.httpDuration
          .labels(ctx.method, ctx.mountpath || ctx.path || ctx.url)
          .observe(parseFloat(ctx['response-time']) / 1000)
    })
  },
  Prometheus
)
