import type { DatabaseContext } from '@menubook/core'
import { NextFunction, Request, Response } from 'express'
import { getDemoSessionManager } from '../services/demo-session'

const DEMO_ENABLED = process.env.DEMO === 'true'
const SESSION_COOKIE = 'menubook_demo_session'

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      demoDatabase?: DatabaseContext
      demoSessionId?: string
    }
  }
}

export function demoMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!DEMO_ENABLED) {
    return next()
  }

  const sessionManager = getDemoSessionManager()
  if (!sessionManager) {
    return next()
  }

  // Skip for static assets, metrics, and health endpoints
  if (
    req.path.startsWith('/styles') ||
    req.path.startsWith('/assets') ||
    req.path === '/metrics' ||
    req.path === '/health/readiness' ||
    req.path.endsWith('.js') ||
    req.path.endsWith('.css') ||
    req.path.endsWith('.ico')
  ) {
    return next()
  }

  const sessionId = req.cookies?.[SESSION_COOKIE]

  if (sessionId) {
    const database = sessionManager.getSession(sessionId)
    if (database) {
      req.demoDatabase = database
      req.demoSessionId = sessionId
      return next()
    }

    // Session expired - return 410 Gone
    if (req.headers['hx-request'] === 'true') {
      // HTMX request - return HTML for client-side handling
      res.status(410).send(`
        <div id="session-expired-modal" class="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div class="bg-white rounded-lg shadow-xl p-6 max-w-md">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Session Expired</h3>
            <p class="text-gray-600 mb-4">Your demo session has expired. Click below to start a new one.</p>
            <button onclick="window.location.reload()" class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Start New Demo
            </button>
          </div>
        </div>
      `)
      return
    }

    // Regular request - return JSON
    res.status(410).json({
      error: 'Session expired',
      message: 'Your demo session has expired. Refresh to start a new one.',
    })
    return
  }

  // Create new session
  sessionManager
    .createSession()
    .then(({ sessionId: newSessionId, database }) => {
      res.cookie(SESSION_COOKIE, newSessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 60 * 1000, // 30 minutes
        sameSite: 'lax',
      })
      req.demoDatabase = database
      req.demoSessionId = newSessionId
      next()
    })
    .catch(next)
}

export function isDemoEnabled(): boolean {
  return DEMO_ENABLED
}
