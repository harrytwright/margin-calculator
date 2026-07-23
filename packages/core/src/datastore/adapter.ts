import type { DatabaseAdapter } from '@menubook/shared'

// Adapter registry
const adapters = new Map<string, DatabaseAdapter>()

/**
 * Register a database adapter.
 *
 * @param name - Adapter name ('sqlite' or 'postgres')
 * @param adapter - The adapter implementation
 */
export function registerAdapter(name: string, adapter: DatabaseAdapter): void {
  adapters.set(name, adapter)
}

/**
 * Get a registered adapter by name.
 *
 * @param name - Adapter name
 * @returns The adapter
 * @throws Error if adapter is not registered
 */
export function getAdapter(name: string): DatabaseAdapter {
  const adapter = adapters.get(name)
  if (!adapter) {
    const available = [...adapters.keys()].join(', ') || 'none'
    throw new Error(
      `Database adapter '${name}' not registered. Available adapters: ${available}. ` +
        `Make sure to install and register either @menubook/sqlite or @menubook/postgres.`
    )
  }
  return adapter
}

/**
 * Check if an adapter is registered.
 *
 * @param name - Adapter name
 * @returns True if the adapter is registered
 */
export function hasAdapter(name: string): boolean {
  return adapters.has(name)
}

/**
 * Detect the appropriate adapter from a connection string.
 *
 * @param connectionString - Database connection string or file path
 * @returns 'postgres' for PostgreSQL URLs, 'sqlite' otherwise
 */
export function detectAdapter(connectionString: string): 'sqlite' | 'postgres' {
  if (
    connectionString.startsWith('postgresql://') ||
    connectionString.startsWith('postgres://')
  ) {
    return 'postgres'
  }
  return 'sqlite'
}

/**
 * Get a list of registered adapter names.
 */
export function getRegisteredAdapters(): string[] {
  return [...adapters.keys()]
}
