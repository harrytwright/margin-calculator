import { Unauthorized } from '@hndlr/errors'
import { NextFunction, Response } from 'express'
import { ProtectedRequest } from '../types/response.json.type'

export function isProtected(
  req: ProtectedRequest<unknown, unknown>,
  res: Response,
  next: NextFunction
) {
  if (!req.auth) {
    return next(
      new Unauthorized('This route is protected, make sure you are logged in')
    )
  }

  return next()
}
