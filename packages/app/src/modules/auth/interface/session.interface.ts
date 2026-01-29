/**
 * While technically as this is an independant API which can be accessible via internal API's
 * it is not a session, but it feels the more correct way to describe it
 * */

export interface Session {
  issuer: string

  subject: string

  expiration: Date

  session?: string

  refreshToken?: string

  roles: string[]

  permissions: string[]

  tenant?: string

  canAccess(permission: string): boolean
}
