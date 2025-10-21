import log from '@harrytwright/logger'

import type {
  StorageMode,
  StorageService,
  WriteData,
  WriteObjectType,
} from '../storage'

/**
 * Database-only storage implementation.
 * Does not write files to disk - the database is the single source of truth.
 * Used in standalone/containerized deployments where file persistence is not needed.
 */
export class DatabaseOnlyStorage implements StorageService {
  async write<T extends WriteObjectType>(
    type: T,
    slug: string,
    _data: WriteData<T>,
    _workingDir: string,
    _existingPath?: string
  ): Promise<string> {
    log.verbose(
      'storage',
      `Database-only mode: Skipping file write for ${type} '${slug}'`
    )
    return '' // No file path in database-only mode
  }

  async deleteFile(filePath: string): Promise<void> {
    log.verbose(
      'storage',
      `Database-only mode: Skipping file deletion for '${filePath}'`
    )
    // No-op in database-only mode
  }

  getMode(): StorageMode {
    return 'database-only'
  }
}
