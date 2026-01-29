import { register } from '@harrytwright/api/dist/core'
import log from '@harrytwright/logger'
import { BadRequest } from '@hndlr/errors'
import type { JwtPayload } from 'jsonwebtoken'

import type { ProtectedRequest } from '../../../types/response.json.type'
import { Auth as AuthContext } from '../classes/auth'
import { AuthMetrics } from '../metrics/auth.metrics'
import { Auth as AuthModule } from '../module'

import type { AuthenticationStrategy } from './registry'
import { StrategyRegistry } from './registry'

@register('singleton')
export class JwtAuthenticationStrategy implements AuthenticationStrategy {
  constructor(
    private readonly auth: AuthModule,
    private readonly registry: StrategyRegistry,
    private readonly metrics: AuthMetrics
  ) {
    this.registry.add(this)
  }

  supports(req: ProtectedRequest<any, any, any, any>): boolean {
    const authHeader = req.header?.('authorization')
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return true
    }

    return Boolean(req.cookies?.sAccessToken)
  }

  async authenticate(
    req: ProtectedRequest<any, any, any, any>
  ): Promise<AuthContext | undefined> {
    const token =
      this.extractBearer(req) ??
      (typeof req.cookies?.sAccessToken === 'string'
        ? req.cookies!.sAccessToken
        : undefined)

    if (!token) return undefined

    this.metrics.attempt('jwt')

    if (!AuthContext.isJWT(token)) {
      log.warn(
        'auth:middleware',
        'Passed non JWT header, will attempt to validate either way'
      )
    }

    const decoded = await this.verify(token)
    if (!decoded) {
      return undefined
    }

    if (typeof decoded === 'string') {
      this.metrics.failure('jwt', 'malformed')
      throw new BadRequest('Invalid JWT')
    }

    this.metrics.success('jwt')
    return AuthContext.fromJWT(decoded)
  }

  private extractBearer(
    req: ProtectedRequest<any, any, any, any>
  ): string | undefined {
    const authHeader = req.header?.('authorization')
    if (!authHeader) return undefined

    const parts = authHeader.split(' ')
    if (parts.length !== 2 || parts[0] !== 'Bearer') return undefined

    return parts[1]
  }

  private verify(token: string): Promise<JwtPayload | string | null> {
    return new Promise((resolve) => {
      this.auth.verify(token, (error, decoded) => {
        if (error) {
          log.error('auth:middleware', error, 'Failed to verify JWT')
          log.warn(
            'auth:middleware',
            'Continuing, errors will propagate later if we need to throw'
          )

          if (AuthContext.isJWT(token)) {
            log.warn(
              'auth:middleware',
              { token },
              'Authentication token is JWT, might not be valid for this server'
            )
          }

          this.metrics.failure('jwt', 'verification_failed')
          return resolve(null)
        }

        resolve(decoded ?? null)
      })
    })
  }
}
