import type { JwtPayload } from 'jsonwebtoken'

import { Session } from '../interface/session.interface'

import { matcher } from '../../../utils/role-matcher'
// import { customer_scope } from '../scopes/customer'

export enum Type {
  management,
  api_key,
  access_token,
}

const isJWT = (header: string) => {
  const split = header.split('.')
  if (split.length != 3) return false

  try {
    const first = Buffer.from(split.shift()!, 'base64').toString('utf8')
    const header = JSON.parse(first)

    return header.typ?.toLowerCase() === 'jwt'
  } catch (err) /* istanbul ignore next */ {
    return false
  }
}

export class Strategy {
  constructor(
    readonly subject: string,
    readonly permissions: string[],
    readonly attributes: Record<string, unknown> = {}
  ) {}

  canAccess(
    permission: string | string[],
    mustMatch: boolean = false
  ): boolean {
    return matcher(permission, this.permissions, mustMatch)
  }
}

export class APIKeyStrategy extends Strategy {}

export class JWTStrategy extends Strategy {
  /* istanbul ignore next */
  get session(): Session {
    return {
      issuer: this.jwt.iss!,
      subject: this.jwt.sub!,
      expiration: new Date(this.jwt.exp! * 1000),
      session: this.jwt.sessionHandle,
      refreshToken: this.jwt.refreshTokenHash1,
      tenant: this.jwt.tId,
      roles: (this.jwt['st-role'] || { v: [] }).v || [],
      permissions: (this.jwt['st-perm'] || { v: [] }).v || [],
      canAccess(this: Session, permission: string): boolean {
        return matcher(permission, this.permissions)
      },
    }
  }

  constructor(readonly jwt: JwtPayload) {
    const permissions = (jwt['st-perm'] || { v: [] }).v || []
    const roles = (jwt['st-role'] || { v: [] }).v || []

    super(jwt.sub!, permissions, {
      issuer: jwt.iss,
      roles,
      tenant: jwt.tId,
    })
  }
}

export class Auth {
  static isJWT = isJWT

  static fromJWT(jwt: JwtPayload): Auth {
    return new Auth(new JWTStrategy(jwt), Type.management)
  }

  static fromStrategy(strategy: Strategy, type: Type): Auth {
    return new Auth(strategy, type)
  }

  get subject(): string {
    return this.strategy.subject
  }

  get permissions(): string[] {
    return [...this.strategy.permissions]
  }

  get metadata(): Record<string, unknown> {
    return { ...this.strategy.attributes }
  }

  get kind(): Type {
    return this.type
  }

  is(type: Type): boolean {
    return this.type === type
  }

  toSafeObject() {
    return {
      subject: this.subject,
      permissions: this.permissions,
      metadata: this.metadata,
      type: Type[this.type],
    }
  }

  private constructor(
    readonly strategy: Strategy,
    readonly type: Type
  ) {}

  canAccess(
    permission: string | string[],
    mustMatch: boolean = false
  ): boolean {
    return this.strategy.canAccess(permission, mustMatch)
  }
}
