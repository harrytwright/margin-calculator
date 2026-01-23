import { register } from '@harrytwright/api/dist/core'

import { Prometheus } from '../../metrics'

type StrategyLabel = 'jwt' | 'api_key' | string

@register('singleton')
export class AuthMetrics {
  constructor(private readonly metrics: Prometheus) {}

  attempt(strategy: StrategyLabel) {
    this.metrics.inc('authAttempts', { strategy })
  }

  success(strategy: StrategyLabel) {
    this.metrics.inc('authSuccess', { strategy })
  }

  failure(strategy: StrategyLabel, reason: string) {
    this.metrics.inc('authFailures', { strategy, reason })
  }
}
