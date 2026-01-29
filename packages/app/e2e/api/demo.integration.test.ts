import { describe } from '@jest/globals'

import { API } from '@harrytwright/api/dist/core'
import { ConfigService } from '@menubook/core'
import { createDatabase, migrate } from '@menubook/sqlite'
import { EventEmitter } from 'events'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/sqlite'

import { App } from '../../src/app'

import { handleFlow, WorkFlow, WorkFlows } from '../../jest/testing-suite'

/**
 * Parse the cookie value from a Set-Cookie header.
 * The Set-Cookie header looks like: "name=value; HttpOnly; Max-Age=1800; Path=/; ..."
 * We only need the "name=value" part for the Cookie request header.
 */
function parseCookieValue(setCookieHeader: string): string {
  // Split on ';' and take the first part which is the name=value
  return setCookieHeader.split(';')[0].trim()
}

describe('App', () => {
  const workflow: WorkFlows = <WorkFlows>require('./workflow.json')

  describe('demoIsolation', function () {
    const database = createDatabase()

    // Map of session name (A, B, etc.) to cookie value (name=value only)
    const sessions = new Map<string, string>()

    handleFlow(
      workflow['demoIsolation']!,
      App,
      {},
      {
        before: async () => {
          await migrate(database, 'up')
        }, // @ts-ignore
        beforeEach: async (
          req,
          flow: WorkFlow & { session?: string },
          agent
        ) => {
          // For session isolation, we need to manage cookies explicitly
          if (flow.session) {
            if (sessions.has(flow.session)) {
              // Use the saved cookie for this session
              req.set('Cookie', sessions.get(flow.session)!)
            } else {
              // New session - use the X-Demo-New-Session header to force
              // creation of a new session, bypassing supertest's cookie jar
              req.set('X-Demo-New-Session', 'true')
            }
          }
          return req
        },
        afterEach: async (req, res, flow: WorkFlow & { session?: string }) => {
          if (flow.session && res.headers['set-cookie']) {
            // Parse just the cookie value (name=value) from the full Set-Cookie header
            const cookieValue = parseCookieValue(res.headers['set-cookie'][0])
            sessions.set(flow.session, cookieValue)
          }
        },
      },
      API.register('database', {
        db: database,
        helpers: {
          jsonArrayFrom,
          jsonObjectFrom,
        },
      })
        .register('events', new EventEmitter())
        .register('globalConfig', new ConfigService('./tmp/dir')),
      false
    )
  })
})
