import type { CacheAdapter } from './adapter'

/**
 * No-operation cache implementation.
 *
 * Useful for:
 * - Disabling caching in development/testing
 * - Environments where caching is not desired
 * - As a fallback when no cache is configured
 *
 * All operations are no-ops: get always returns null, set/delete/clear do nothing.
 *
 * @example
 * ```typescript
 * // Disable caching
 * registerCache('noop', new NoopCache())
 * const cache = getCache('noop')
 *
 * await cache.set('key', 'value') // Does nothing
 * await cache.get('key') // Returns null
 * ```
 */
export class NoopCache implements CacheAdapter {
  async get<T>(_key: string): Promise<T | null> {
    return null
  }

  async set<T>(_key: string, _value: T, _ttlMs?: number): Promise<void> {
    // No-op
  }

  async delete(_key: string): Promise<void> {
    // No-op
  }

  async invalidatePattern(_pattern: string): Promise<void> {
    // No-op
  }

  async clear(): Promise<void> {
    // No-op
  }

  async has(_key: string): Promise<boolean> {
    return false
  }
}
