import type { DatabaseContext } from '@menubook/core'
import { randomUUID } from 'crypto'
import { metricsService } from './metrics'

interface Session {
  id: string
  database: DatabaseContext
  createdAt: number
  lastAccess: number
}

const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes
const MAX_SESSIONS = 100
const CLEANUP_INTERVAL_MS = 60 * 1000 // 1 minute

export class DemoSessionManager {
  private sessions = new Map<string, Session>()
  private cleanupInterval: NodeJS.Timeout | null = null
  private createDatabaseFn: () => Promise<DatabaseContext>

  constructor(createDatabaseFn: () => Promise<DatabaseContext>) {
    this.createDatabaseFn = createDatabaseFn
  }

  start(): void {
    this.startCleanup()
  }

  async createSession(): Promise<{
    sessionId: string
    database: DatabaseContext
  }> {
    // Evict oldest if at capacity
    if (this.sessions.size >= MAX_SESSIONS) {
      await this.evictOldest()
    }

    const sessionId = randomUUID()
    const database = await this.createDatabaseFn()

    const session: Session = {
      id: sessionId,
      database,
      createdAt: Date.now(),
      lastAccess: Date.now(),
    }

    this.sessions.set(sessionId, session)
    metricsService.sessionCreatedTotal.inc()
    metricsService.activeSessions.set(this.sessions.size)

    return { sessionId, database }
  }

  getSession(sessionId: string): DatabaseContext | null {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return null
    }

    // Check if expired
    if (Date.now() - session.lastAccess > SESSION_TTL_MS) {
      this.destroySession(sessionId)
      return null
    }

    // Update last access
    session.lastAccess = Date.now()
    return session.database
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      try {
        await session.database.db.destroy()
      } catch {
        // Ignore errors on cleanup
      }
      this.sessions.delete(sessionId)
      metricsService.sessionExpiredTotal.inc()
      metricsService.activeSessions.set(this.sessions.size)
    }
  }

  private async evictOldest(): Promise<void> {
    let oldest: Session | null = null
    for (const session of this.sessions.values()) {
      if (!oldest || session.lastAccess < oldest.lastAccess) {
        oldest = session
      }
    }
    if (oldest) {
      await this.destroySession(oldest.id)
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [id, session] of this.sessions.entries()) {
        if (now - session.lastAccess > SESSION_TTL_MS) {
          this.destroySession(id)
        }
      }
    }, CLEANUP_INTERVAL_MS)
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    for (const sessionId of this.sessions.keys()) {
      await this.destroySession(sessionId)
    }
  }

  getSessionCount(): number {
    return this.sessions.size
  }
}

// Singleton instance - will be initialized in server startup when DEMO=true
let demoSessionManager: DemoSessionManager | null = null

export function initDemoSessionManager(
  createDatabaseFn: () => Promise<DatabaseContext>
): DemoSessionManager {
  if (!demoSessionManager) {
    demoSessionManager = new DemoSessionManager(createDatabaseFn)
    demoSessionManager.start()
  }
  return demoSessionManager
}

export function getDemoSessionManager(): DemoSessionManager | null {
  return demoSessionManager
}
