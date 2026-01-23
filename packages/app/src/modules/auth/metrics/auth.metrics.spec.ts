import { describe, expect, it, jest } from '@jest/globals'

import { AuthMetrics } from './auth.metrics'

describe('AuthMetrics', () => {
  const prom = {
    inc: jest.fn(),
  }

  const metrics = new AuthMetrics(prom as any)

  it('records attempts', () => {
    metrics.attempt('jwt')
    expect(prom.inc).toHaveBeenCalledWith('authAttempts', {
      strategy: 'jwt',
    })
  })

  it('records successes', () => {
    metrics.success('api_key')
    expect(prom.inc).toHaveBeenCalledWith('authSuccess', {
      strategy: 'api_key',
    })
  })

  it('records failures with reason', () => {
    metrics.failure('jwt', 'invalid')
    expect(prom.inc).toHaveBeenCalledWith('authFailures', {
      strategy: 'jwt',
      reason: 'invalid',
    })
  })
})
