import { Request, Response, NextFunction } from 'express'
import { metricsService } from '../services/metrics'

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip metrics for health and metrics endpoints
  if (req.path === '/metrics' || req.path === '/health/readiness') {
    return next()
  }

  const startTime = Date.now()

  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000
    const route = req.route?.path || req.path
    const method = req.method
    const status = res.statusCode.toString()

    metricsService.httpRequestsTotal.inc({ method, route, status })
    metricsService.httpRequestDuration.observe({ method, route, status }, duration)
  })

  next()
}
