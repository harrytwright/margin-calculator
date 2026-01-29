import { Forbidden, Unauthorized } from '@hndlr/errors'

import {
  NextFunction,
  ProtectedRequest,
  ServerResponse,
} from '../../../types/response.json.type'

// works like <resource>:<action>:<attribute>
// so for the average user it would be users:read:own which would allow them to read their own user details
export function authorisation(
  permission: string | string[],
  allowUnprotected: boolean = false,
  mustMatch: boolean = false
) {
  if (permission.length === 0)
    throw new SyntaxError('permission must have a length greater than 0')

  return (
    req: ProtectedRequest<any, any>,
    res: ServerResponse<any>,
    next: NextFunction
  ) => {
    if (!req.auth && !allowUnprotected)
      return next(new Unauthorized(`${req.url} requires authentication`))

    if (
      (req.auth && req.auth.canAccess(permission, mustMatch)) ||
      allowUnprotected
    )
      return next()

    return next(new Forbidden('Current user has invalid permissions'))
  }
}
