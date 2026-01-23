import { controller, path } from '@harrytwright/api/dist/core'
import express from 'express'

import { Prometheus } from '../module'

import type {
  NextFunction,
  ServerRequest,
} from '../../../types/response.json.type'

@controller('/metrics')
export class MetricsController {
  constructor(private readonly prometheus: Prometheus) {}

  @path('/')
  getMetrics(
    req: ServerRequest<unknown, any>,
    res: express.Response<string>,
    next: NextFunction
  ) {
    return this.prometheus.handler(res)
  }
}
