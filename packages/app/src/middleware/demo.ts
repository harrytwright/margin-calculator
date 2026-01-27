import { registerMiddleware } from '@harrytwright/api/dist/core'
import { Unauthorized } from '@hndlr/errors'
import express from 'express'

import { DemoPersistenceManager } from '../datastore/sqlite.demo'

const SESSION_COOKIE =
  process.env.DEMO_SESSION_COOKIE || 'menubook:demo_session'

// Probably not needed anymore, but good to have, maybe for logging etc
declare global {
  namespace Express {
    interface Request {
      demo?: { session: string }
    }
  }
}

export type MiddlewareReturn = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => void

// Expandable
const ignores = {
  startsWith: ['/-', '/styles', '/assets'],
  endsWith: ['.js', '.css', '.ico'],
  routes: ['/metrics'],
}

const template = `
<div id="session-expired-modal" class="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
  <div class="bg-white rounded-lg shadow-xl p-6 max-w-md">
    <h3 class="text-lg font-semibold text-gray-900 mb-2">Session Expired</h3>
    <p class="text-gray-600 mb-4">Your demo session has expired. Click below to start a new one.</p>
    <button onclick="window.location.reload()" class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
      Start New Demo
    </button>
  </div>
</div>
`

export const demo = registerMiddleware(
  'demo',
  (demo): MiddlewareReturn =>
    async (req, res, next) => {
      if (!Boolean(process.env.DEMO)) return next()

      if (handleSkips(req)) return next()

      const sessionID = req.cookies?.[SESSION_COOKIE]

      if (sessionID) {
        const ctx = demo.get(sessionID)
        if (!!ctx) {
          req.demo = { session: sessionID }
          return demo.run(ctx, next)
        }

        if (req.headers['hx-request'] === 'true') {
          return res.status(410).send(template)
        }

        return next(
          new Unauthorized(
            'Your demo session has expired. Refresh to start a new one.'
          )
        )
      }

      try {
        const session = await demo.create()

        res.cookie(SESSION_COOKIE, session.id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 30 * 60 * 1000, // 30 minutes
          sameSite: 'lax',
        })

        req.demo = { session: session.id }
        return demo.run(session.database, next)
      } catch (error) {
        return next(error)
      }
    },
  DemoPersistenceManager
)

function handleSkips(req: express.Request) {
  return (
    ignores.startsWith.some((prefix) => req.path.startsWith(prefix)) ||
    ignores.endsWith.some((suffix) => req.path.endsWith(suffix)) ||
    ignores.routes.some((route) => req.path === route)
  )
}
