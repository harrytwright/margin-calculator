import { controller, path } from '@harrytwright/api/dist/core'
import express from 'express'

import { HeathcheckService } from '../services/healthcheck.service'

@controller('/-/health')
export class HealthcheckController {
  constructor(private readonly service: HeathcheckService) {}

  @path('/')
  async getHealth(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const health = await this.service.health()
    return res.status(200).json({
      ...health,
      status: Object.keys(health.error).length === 0 ? 'healthy' : 'unhealthy',
    })
  }

  @path('/readiness')
  async getReadiness(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const isReady = await this.service.readiness()
    return res.status(isReady ? 200 : 503).send(isReady)
  }
}
