import express from 'express'

import { Auth } from '../modules/auth/classes/auth'

export type JSONResponse<X> = {
  data: X
  meta?: any
}

export type ServerResponse<
  X,
  L extends Record<string, any> = {},
> = express.Response<JSONResponse<X>, L>

export type RawServerRequest<P, R, B = unknown, Q = unknown> = express.Request<
  P,
  R,
  B,
  Q
> & { id?: string }

export type ServerRequest<P, R, B = unknown, Q = unknown> = RawServerRequest<
  P,
  JSONResponse<R>,
  B,
  Q
>

export type ProtectedRequest<P, R, B = unknown, Q = unknown> = ServerRequest<
  P,
  R,
  B,
  Q
> & { auth?: Auth }

export type NextFunction = express.NextFunction
