/**
 * Cache adapter interface.
 * Each cache implementation (Memory, Redis) must implement this interface.
 */
export interface CacheAdapter {
  /**
   * Get a value from the cache.
   *
   * @param key - Cache key
   * @returns The cached value or null if not found/expired
   */
  get<T>(key: string): Promise<T | null>

  /**
   * Set a value in the cache.
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlMs - Time-to-live in milliseconds (optional, uses default if not specified)
   */
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>

  /**
   * Delete a specific key from the cache.
   *
   * @param key - Cache key to delete
   */
  delete(key: string): Promise<void>

  /**
   * Invalidate all keys matching a glob pattern.
   *
   * @param pattern - Glob pattern (e.g., 'margin:*', 'recipe:*')
   */
  invalidatePattern(pattern: string): Promise<void>

  /**
   * Clear all cached values.
   */
  clear(): Promise<void>

  /**
   * Check if a key exists in the cache (and is not expired).
   *
   * @param key - Cache key
   * @returns True if the key exists and is not expired
   */
  has(key: string): Promise<boolean>
}

// Cache adapter registry
const caches = new Map<string, CacheAdapter>()

/**
 * Register a cache adapter.
 *
 * @param name - Adapter name ('memory', 'redis', 'noop')
 * @param cache - The cache adapter implementation
 */
export function registerCache(name: string, cache: CacheAdapter): void {
  caches.set(name, cache)
}

/**
 * Get a registered cache adapter by name.
 *
 * @param name - Adapter name
 * @returns The cache adapter
 * @throws Error if adapter is not registered
 */
export function getCache(name: string): CacheAdapter {
  const cache = caches.get(name)
  if (!cache) {
    const available = [...caches.keys()].join(', ') || 'none'
    throw new Error(
      `Cache adapter '${name}' not registered. Available adapters: ${available}.`
    )
  }
  return cache
}

/**
 * Check if a cache adapter is registered.
 *
 * @param name - Adapter name
 * @returns True if the adapter is registered
 */
export function hasCache(name: string): boolean {
  return caches.has(name)
}

/**
 * Get a list of registered cache adapter names.
 */
export function getRegisteredCaches(): string[] {
  return [...caches.keys()]
}

/**
 * Get the default cache adapter.
 * Returns 'memory' if registered, otherwise the first registered adapter.
 *
 * @returns The default cache adapter or null if none registered
 */
export function getDefaultCache(): CacheAdapter | null {
  if (caches.has('memory')) {
    return caches.get('memory')!
  }
  const first = caches.keys().next()
  return first.done ? null : caches.get(first.value)!
}
