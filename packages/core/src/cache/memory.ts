import type { CacheAdapter } from './adapter'

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

/**
 * In-memory cache implementation with TTL support.
 *
 * Features:
 * - Configurable default TTL
 * - Per-key TTL override
 * - Glob pattern invalidation
 * - Automatic cleanup of expired entries on access
 *
 * @example
 * ```typescript
 * const cache = new TTLCache(5 * 60 * 1000) // 5 minute default TTL
 *
 * await cache.set('recipe:burger', { cost: 5.00 })
 * await cache.set('recipe:pizza', { cost: 8.00 }, 10 * 60 * 1000) // 10 min TTL
 *
 * const burger = await cache.get('recipe:burger')
 *
 * await cache.invalidatePattern('recipe:*') // Clear all recipe cache
 * ```
 */
export class TTLCache implements CacheAdapter {
  private store = new Map<string, CacheEntry<any>>()
  private defaultTTL: number

  /**
   * Create a new TTLCache instance.
   *
   * @param defaultTTLMs - Default time-to-live in milliseconds (default: 5 minutes)
   */
  constructor(defaultTTLMs: number = 5 * 60 * 1000) {
    this.defaultTTL = defaultTTLMs
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key)
    if (!entry) {
      return null
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }

    return entry.value as T
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTTL)
    this.store.set(key, { value, expiresAt })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const regex = this.globToRegex(pattern)

    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key)
      }
    }
  }

  async clear(): Promise<void> {
    this.store.clear()
  }

  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key)
    if (!entry) {
      return false
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return false
    }

    return true
  }

  /**
   * Get the number of entries in the cache (including potentially expired ones).
   * Useful for debugging and testing.
   */
  get size(): number {
    return this.store.size
  }

  /**
   * Clean up expired entries.
   * Called automatically on get/has, but can be called manually for maintenance.
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key)
      }
    }
  }

  /**
   * Convert a glob pattern to a regex.
   * Supports:
   * - `*` matches any characters except `:` (for namespaced keys like `recipe:*`)
   * - `**` matches any characters including `:`
   *
   * @param pattern - Glob pattern
   * @returns RegExp
   */
  private globToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*\*/g, '.*') // ** matches anything
      .replace(/\*/g, '[^:]*') // * matches anything except :

    return new RegExp(`^${escaped}$`)
  }
}
