// This is the manager for the Demo persistence, uses sqlite3 :memory: databases
// stored inside a TTLCache for session usage. With a 30min session, once they have
//  gone, they have gone. To be injected into the request route though a middleware

import { AsyncLocalStorage } from 'async_hooks'

import { register } from '@harrytwright/api/dist/core'
import log from '@harrytwright/logger'
import { ServiceUnavailable } from '@hndlr/errors'
import { TTLCache } from '@isaacs/ttlcache'
import type { DatabaseContext } from '@menubook/core'
import { createDatabase, jsonArrayFrom, jsonObjectFrom } from '@menubook/sqlite'
import { createId } from '@paralleldrive/cuid2'

import { Prometheus } from '../modules/metrics'

interface Session {
  id: string
  database: DatabaseContext
  createdAt: number
}

@register('singleton')
export class DemoPersistenceManager {
  // 30-min sessions, 100 concurrent sessions. Seems logical for now, can always adjust if needed
  sessions = new TTLCache<string, Session>({
    ttl: 30 * 60 * 1000,
    max: 100,
    dispose: async (session, _, reason) => {
      log.info(
        'demo:manager',
        { session: session.id, reason },
        'Disposing of session'
      )

      try {
        await session.database.db.destroy()
      } catch (err) {
        log.error('demo:manager', err, 'Failed to destroy session')
      }

      this.metrics.sessionExpiredTotal.inc()
      this.metrics.activeSessions.set(this.sessions.size)
    },
  })

  private readonly storage = new AsyncLocalStorage<DatabaseContext>()

  constructor(private readonly metrics: Prometheus) {}

  run<T>(ctx: DatabaseContext, fn: () => T | Promise<T>): T | Promise<T> {
    return this.storage.run(ctx, fn)
  }

  ctx(): DatabaseContext | undefined {
    return this.storage.getStore()
  }

  get(sessionId: string): DatabaseContext | undefined {
    // Might as well update the sessions here.
    this.metrics.activeSessions.set(this.sessions.size)
    return this.sessions.get(sessionId)?.database ?? undefined
  }

  // Should we purge or handle the max ourselves? Think we handle ourselves
  create(): Promise<Omit<Session, 'createdAt'>> {
    if (this.sessions.size === 100)
      throw new ServiceUnavailable(
        'All sessions are in use, please try again later'
      )

    const session = createId()
    const database = {
      db: createDatabase(':memory:'),
      helpers: {
        jsonArrayFrom,
        jsonObjectFrom,
      },
    }

    this.sessions.set(session, {
      id: session,
      database,
      createdAt: Date.now(),
    })

    this.metrics.sessionCreatedTotal.inc()
    this.metrics.activeSessions.set(this.sessions.size)

    return Promise.resolve({ id: session, database })
  }

  async destroy(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      this.sessions.delete(sessionId)
    } else {
      log.info(
        'demo:manager',
        { session: sessionId },
        'Session not found, ignoring destroy request'
      )
    }
  }
}
