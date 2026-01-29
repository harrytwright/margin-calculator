import { Inject, register } from '@harrytwright/api/dist/core'
import { Config } from '@harrytwright/cli-config'
import { Unauthorized } from '@hndlr/errors'

import type { AppConfig } from '../../../config'
import type { ProtectedRequest } from '../../../types/response.json.type'
import {
  APIKeyStrategy,
  Auth as AuthContext,
  Type as AuthType,
} from '../classes/auth'
import { AuthMetrics } from '../metrics/auth.metrics'

import type { AuthenticationStrategy } from './registry'
import { StrategyRegistry } from './registry'

@register('singleton')
export class ApiKeyAuthenticationStrategy implements AuthenticationStrategy {
  @Inject('config')
  config: Config<AppConfig>

  constructor(
    private readonly registry: StrategyRegistry,
    private readonly metrics: AuthMetrics
  ) {
    this.registry.add(this)
  }

  supports(req: ProtectedRequest<any, any, any, any>): boolean {
    return Boolean(this.extractApiKey(req))
  }

  async authenticate(
    req: ProtectedRequest<any, any, any, any>
  ): Promise<AuthContext | undefined> {
    const provided = this.extractApiKey(req)
    if (!provided) return undefined

    this.metrics.attempt('api_key')

    const expected = this.config.get('auth-api-key')
    if (!expected) {
      this.metrics.failure('api_key', 'misconfigured')
      throw new Unauthorized('API key authentication is not configured')
    }

    if (provided !== expected) {
      this.metrics.failure('api_key', 'invalid')
      throw new Unauthorized('Invalid API key provided')
    }

    this.metrics.success('api_key')

    const permissions = this.parsePermissions(
      this.config.get('auth-api-key-permissions')
    )

    return AuthContext.fromStrategy(
      new APIKeyStrategy('api-key', permissions),
      AuthType.api_key
    )
  }

  private extractApiKey(
    req: ProtectedRequest<any, any, any, any>
  ): string | undefined {
    const authHeader = req.header?.('authorization')
    if (typeof authHeader === 'string') {
      const [scheme, value] = authHeader.split(' ')
      if (scheme === 'ApiKey' && value) {
        return value
      }
    }

    const headerKey = req.header?.('x-api-key')
    if (typeof headerKey === 'string') return headerKey

    const queryKey = (req.query as Record<string, any> | undefined)?.['api_key']
    if (typeof queryKey === 'string') return queryKey

    return undefined
  }

  private parsePermissions(configValue: string | null): string[] {
    if (!configValue) return ['api:*']

    return configValue
      .split(',')
      .map((permission) => permission.trim())
      .filter(Boolean)
  }
}
