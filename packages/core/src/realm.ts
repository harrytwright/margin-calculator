/**
 * Realm configuration for cloud vs local deployments.
 *
 * - `cloud`: Database-only storage, no filesystem operations, no file watching
 * - `local`: Filesystem storage enabled, file watching enabled
 *
 * The realm can be set via:
 * 1. CLI flags (`--file-system`, `--no-file-system`, `--standalone`)
 * 2. Environment variable (`REALM=cloud|local`)
 * 3. Default (`local`)
 */

import type { StorageMode } from './lib/storage'

/** Deployment realm type */
export type Realm = 'cloud' | 'local'

/** Configuration derived from realm */
export interface RealmConfig {
  /** The resolved realm */
  realm: Realm
  /** Storage mode for data persistence */
  storageMode: StorageMode
  /** Whether file watching should be enabled */
  watchFiles: boolean
}

/**
 * Detect the realm from the REALM environment variable.
 *
 * @returns 'cloud' if REALM=cloud, otherwise 'local'
 */
export function detectRealm(): Realm {
  const env = process.env.REALM?.toLowerCase()
  if (env === 'cloud') return 'cloud'
  return 'local'
}

/**
 * Convert a realm to its default configuration.
 *
 * @param realm - The realm to convert
 * @returns Storage mode and watch settings for the realm
 */
export function realmToConfig(realm: Realm): Omit<RealmConfig, 'realm'> {
  if (realm === 'cloud') {
    return { storageMode: 'database-only', watchFiles: false }
  }
  return { storageMode: 'fs', watchFiles: true }
}

/** Options for resolving realm configuration */
export interface ResolveRealmOptions {
  /** Explicit --file-system flag value (true, false, or undefined if not set) */
  fileSystem?: boolean
  /** Whether --standalone mode is enabled */
  standalone?: boolean
  /** Legacy --storage option value */
  storage?: StorageMode
  /** Explicit --watch or --no-watch flag */
  watch?: boolean
}

/**
 * Resolve the final realm configuration from CLI options and environment.
 *
 * Precedence (highest to lowest):
 * 1. --standalone (forces database-only, no watch)
 * 2. --file-system / --no-file-system
 * 3. --storage (legacy, deprecated)
 * 4. REALM environment variable
 * 5. Default (local)
 *
 * @param options - CLI options that may override the default realm
 * @returns The resolved realm configuration
 */
export function resolveRealmConfig(
  options: ResolveRealmOptions = {}
): RealmConfig {
  // Start with environment-based realm
  const envRealm = detectRealm()

  // --standalone takes highest precedence (forces database-only mode)
  if (options.standalone) {
    return {
      realm: envRealm,
      storageMode: 'database-only',
      watchFiles: false,
    }
  }

  // --file-system or --no-file-system
  if (options.fileSystem === false) {
    return {
      realm: envRealm,
      storageMode: 'database-only',
      watchFiles: options.watch ?? false,
    }
  }

  if (options.fileSystem === true) {
    return {
      realm: 'local',
      storageMode: 'fs',
      watchFiles: options.watch ?? true,
    }
  }

  // Legacy --storage option (deprecated)
  if (options.storage) {
    const config = realmToConfig(envRealm)
    return {
      realm: envRealm,
      storageMode: options.storage,
      watchFiles: options.watch ?? config.watchFiles,
    }
  }

  // Default: use realm from environment
  const config = realmToConfig(envRealm)
  return {
    realm: envRealm,
    ...config,
    watchFiles: options.watch ?? config.watchFiles,
  }
}

/**
 * Check if filesystem operations are allowed in the given realm configuration.
 *
 * @param config - Realm configuration to check
 * @returns true if filesystem operations are allowed
 */
export function isFileSystemEnabled(config: RealmConfig): boolean {
  return config.storageMode === 'fs'
}

/**
 * Check if we're running in cloud mode.
 *
 * @param config - Realm configuration to check
 * @returns true if running in cloud mode
 */
export function isCloudMode(config: RealmConfig): boolean {
  return config.realm === 'cloud'
}
