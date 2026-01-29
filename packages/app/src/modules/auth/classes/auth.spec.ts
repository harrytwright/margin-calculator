import { describe, expect, it } from '@jest/globals'

import { Auth, JWTStrategy, Strategy, Type } from './auth'

describe('Auth', () => {
  it('exposes metadata and safe object for strategy-based auth', () => {
    const strategy = new Strategy('service-client', ['api:*'], {
      source: 'test',
    })

    const auth = Auth.fromStrategy(strategy, Type.api_key)

    expect(auth.subject).toBe('service-client')
    expect(auth.permissions).toEqual(['api:*'])
    expect(auth.metadata).toEqual({ source: 'test' })
    expect(auth.kind).toBe(Type.api_key)
    expect(auth.is(Type.api_key)).toBe(true)
    expect(auth.is(Type.management)).toBe(false)

    expect(auth.toSafeObject()).toEqual({
      subject: 'service-client',
      permissions: ['api:*'],
      metadata: { source: 'test' },
      type: 'api_key',
    })
  })

  it('maps JWT metadata into strategy attributes', () => {
    const jwt = {
      sub: 'user-123',
      iss: 'self',
      exp: Math.floor(Date.now() / 1000) + 60,
      'st-perm': { v: ['users:read'] },
      'st-role': { v: ['admin'] },
      tId: 'tenant-01',
      sessionHandle: 'session',
      refreshTokenHash1: 'refresh',
    } as any

    const auth = Auth.fromJWT(jwt)

    expect(auth.subject).toBe('user-123')
    expect(auth.permissions).toEqual(['users:read'])
    expect(auth.metadata).toEqual({
      issuer: 'self',
      roles: ['admin'],
      tenant: 'tenant-01',
    })
    expect(auth.kind).toBe(Type.management)

    const session = (auth.strategy as JWTStrategy).session
    expect(session.subject).toBe('user-123')
    expect(session.permissions).toEqual(['users:read'])
  })
})
