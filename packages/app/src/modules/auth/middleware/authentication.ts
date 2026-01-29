import { registerMiddleware } from '@harrytwright/api/dist/core'
import type { Handler, NextFunction, Response } from 'express'

import { ProtectedRequest } from '../../../types/response.json.type'
import { StrategyRegistry } from '../strategies/registry'

export const Authentication = registerMiddleware(
  'auth',
  (registry: StrategyRegistry): Handler => {
    return async (
      req: ProtectedRequest<unknown, unknown>,
      res: Response,
      next: NextFunction
    ) => {
      if (req.auth) return next()

      for (const strategy of registry.list()) {
        if (!strategy.supports(req)) continue

        try {
          const context = await strategy.authenticate(req)
          if (context) {
            req.auth = context
            break
          }
        } catch (error) {
          return next(error as Error)
        }
      }

      next()
    }
  },
  StrategyRegistry
)
