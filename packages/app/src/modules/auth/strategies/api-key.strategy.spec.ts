import { Unauthorized } from '@hndlr/errors'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import type { ProtectedRequest } from '../../../types/response.json.type'
import { Auth as AuthContext } from '../classes/auth'
import { AuthMetrics } from '../metrics/auth.metrics'
import { ApiKeyAuthenticationStrategy } from './api-key.strategy'
import { StrategyRegistry } from './registry'

describe('ApiKeyAuthenticationStrategy', () => {
  let registry: StrategyRegistry
  let metrics: jest.Mocked<AuthMetrics>
  let config: { get: jest.Mock }
  let strategy: ApiKeyAuthenticationStrategy

  beforeEach(() => {
    registry = new StrategyRegistry()
    metrics = {
      attempt: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
    } as unknown as jest.Mocked<AuthMetrics>

    strategy = new ApiKeyAuthenticationStrategy(registry, metrics)

    config = {
      get: jest.fn(),
    }

    // Inject mocked config (decorator normally handles this)
    ;(strategy as any).config = config as any
  })

  const createRequest = (authHeader?: string, extras: any = {}): any =>
    ({
      header: (name: string) => {
        if (name.toLowerCase() === 'authorization') return authHeader
        if (name.toLowerCase() === 'x-api-key') return extras.headerKey
        return undefined
      },
      query: extras.query,
    }) as ProtectedRequest<any, any>

  it('registers itself with the strategy registry', () => {
    expect(registry.list()).toContain(strategy)
  })

  it('supports ApiKey scheme headers', () => {
    const req = createRequest('ApiKey abc123')
    expect(strategy.supports(req)).toBe(true)
  })

  it('supports x-api-key header', () => {
    const req = createRequest(undefined, { headerKey: 'abc123' })
    expect(strategy.supports(req)).toBe(true)
  })

  it('supports api_key query parameter', () => {
    const req = createRequest(undefined, { query: { api_key: 'abc123' } })
    expect(strategy.supports(req)).toBe(true)
  })

  it('authenticates a valid key and records metrics', async () => {
    config.get.mockImplementation((key: any) => {
      if (key === 'auth-api-key') return 'expected'
      if (key === 'auth-api-key-permissions')
        return 'members:read, members:write'
      return null
    })

    const result = await strategy.authenticate(createRequest('ApiKey expected'))

    expect(metrics.attempt).toHaveBeenCalledWith('api_key')
    expect(metrics.success).toHaveBeenCalledWith('api_key')
    expect(metrics.failure).not.toHaveBeenCalled()

    expect(result).toBeInstanceOf(AuthContext)
    expect(result?.permissions).toEqual(['members:read', 'members:write'])
  })

  it('authenticates using query parameter', async () => {
    config.get.mockImplementation((key: any) => {
      if (key === 'auth-api-key') return 'query-key'
      if (key === 'auth-api-key-permissions') return 'api:read'
      return null
    })

    const result = await strategy.authenticate(
      createRequest(undefined, { query: { api_key: 'query-key' } })
    )

    expect(result).toBeInstanceOf(AuthContext)
    expect(result?.permissions).toEqual(['api:read'])
  })

  it('defaults permissions when configuration missing', async () => {
    config.get.mockImplementation((key: any) => {
      if (key === 'auth-api-key') return 'expected'
      if (key === 'auth-api-key-permissions') return null
      return null
    })

    const result = await strategy.authenticate(createRequest('ApiKey expected'))
    expect(result?.permissions).toEqual(['api:*'])
  })

  it('throws when API key auth is not configured', async () => {
    config.get.mockImplementation((key: any) => {
      if (key === 'auth-api-key') return null
      return null
    })

    await expect(
      strategy.authenticate(createRequest('ApiKey provided'))
    ).rejects.toBeInstanceOf(Unauthorized)

    expect(metrics.attempt).toHaveBeenCalledWith('api_key')
    expect(metrics.failure).toHaveBeenCalledWith('api_key', 'misconfigured')
    expect(metrics.success).not.toHaveBeenCalled()
  })

  it('throws when provided key does not match', async () => {
    config.get.mockImplementation((key: any) => {
      if (key === 'auth-api-key') return 'expected'
      if (key === 'auth-api-key-permissions') return 'api:*'
      return null
    })

    await expect(
      strategy.authenticate(createRequest('ApiKey other'))
    ).rejects.toBeInstanceOf(Unauthorized)

    expect(metrics.attempt).toHaveBeenCalledWith('api_key')
    expect(metrics.failure).toHaveBeenCalledWith('api_key', 'invalid')
    expect(metrics.success).not.toHaveBeenCalled()
  })
})
