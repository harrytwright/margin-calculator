import { getIsolationScope } from '@sentry/node'
import { IncomingMessage, ServerResponse } from 'http'

// Wrap the sentry handler here, all I don't offer is the `ensure` call
export function expressRequestHandler() {
  return function sentryRequestMiddleware(
    request: IncomingMessage,
    _res: ServerResponse,
    next: () => void
  ): void {
    // Ensure we use the express-enhanced request here, instead of the plain HTTP one
    getIsolationScope().setSDKProcessingMetadata({ request })

    next()
  }
}
