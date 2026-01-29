import { BadRequest } from '@hndlr/errors'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import type { ProtectedRequest } from '../../../types/response.json.type'
import { Auth as AuthContext } from '../classes/auth'
import { AuthMetrics } from '../metrics/auth.metrics'
import { Auth as AuthModule } from '../module'
import { JwtAuthenticationStrategy } from './jwt.strategy'
import { StrategyRegistry } from './registry'

describe('JwtAuthenticationStrategy', () => {
  let registry: StrategyRegistry
  let metrics: jest.Mocked<AuthMetrics>
  let authModule: { verify: jest.Mock }
  let strategy: JwtAuthenticationStrategy

  beforeEach(() => {
    registry = new StrategyRegistry()
    metrics = {
      attempt: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
    } as unknown as jest.Mocked<AuthMetrics>

    authModule = {
      verify: jest.fn(),
    }

    strategy = new JwtAuthenticationStrategy(
      authModule as unknown as AuthModule,
      registry,
      metrics
    )
  })

  const createRequest = (
    header?: string,
    cookies?: Record<string, any>
  ): ProtectedRequest<any, any> =>
    ({
      header: (key: string) =>
        key.toLowerCase() === 'authorization' ? header : undefined,
      cookies,
    }) as any

  it('registers itself with the strategy registry', () => {
    expect(registry.list()).toContain(strategy)
  })

  it('supports bearer token headers', () => {
    const req = createRequest('Bearer token-123')
    expect(strategy.supports(req)).toBe(true)
  })

  it('supports access token cookies', () => {
    const req = createRequest(undefined, { sAccessToken: 'token-abc' })
    expect(strategy.supports(req)).toBe(true)
  })

  it('returns undefined for unsupported requests', async () => {
    const req = createRequest(undefined, {})
    expect(strategy.supports(req)).toBe(false)
    await expect(strategy.authenticate(req)).resolves.toBeUndefined()
    expect(metrics.attempt).not.toHaveBeenCalled()
  })

  it('authenticates valid JWTs and records metrics', async () => {
    const payload = {
      sub: 'user-123',
      iss: 'self',
      exp: Math.floor(Date.now() / 1000) + 100,
      'st-perm': { v: ['users:read'] },
      'st-role': { v: ['admin'] },
    }

    authModule.verify.mockImplementation((...args: any[]) => {
      const cb = args[1]
      cb(null, payload)
    })

    const result = await strategy.authenticate(createRequest('Bearer token'))

    expect(metrics.attempt).toHaveBeenCalledWith('jwt')
    expect(metrics.success).toHaveBeenCalledWith('jwt')
    expect(metrics.failure).not.toHaveBeenCalled()

    expect(result).toBeInstanceOf(AuthContext)
    expect(result?.subject).toBe('user-123')
    expect(result?.permissions).toEqual(['users:read'])
  })

  it('returns undefined and records failure when verification fails', async () => {
    authModule.verify.mockImplementation((...args: any[]) => {
      const cb = args[1]
      cb(new Error('boom'), undefined)
    })

    const result = await strategy.authenticate(createRequest('Bearer token'))

    expect(metrics.attempt).toHaveBeenCalledWith('jwt')
    expect(metrics.failure).toHaveBeenCalledWith('jwt', 'verification_failed')
    expect(metrics.success).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it('throws BadRequest when decoded value is not a payload', async () => {
    authModule.verify.mockImplementation((...args: any[]) => {
      const cb = args[1]
      cb(null, 'not-an-object')
    })

    await expect(
      strategy.authenticate(createRequest('Bearer token'))
    ).rejects.toBeInstanceOf(BadRequest)

    expect(metrics.failure).toHaveBeenCalledWith('jwt', 'malformed')
  })
})
