import type {
  IngredientImportData,
  RecipeImportData,
  SupplierImportData,
} from '../schema'

export type StorageMode = 'fs' | 'database-only'
export type WriteObjectType = 'ingredient' | 'recipe' | 'supplier'

type WriteDataMap = {
  ingredient: IngredientImportData
  recipe: RecipeImportData
  supplier: SupplierImportData
}

export type WriteData<T extends WriteObjectType> = WriteDataMap[T]

/**
 * Storage service interface for persisting entity data.
 * Implementations can store data in different backends (filesystem, database-only, etc.)
 */
export interface StorageService {
  /**
   * Write entity data to storage
   * @param type - Entity type
   * @param slug - Entity slug
   * @param data - Entity data
   * @param workingDir - Working directory (for filesystem storage)
   * @param existingPath - Optional existing file path (for updates)
   * @returns Path to the written file (or empty string for database-only)
   */
  write<T extends WriteObjectType>(
    type: T,
    slug: string,
    data: WriteData<T>,
    workingDir: string,
    existingPath?: string
  ): Promise<string>

  /**
   * Delete entity data from storage
   * @param filePath - Path to the file to delete
   */
  deleteFile(filePath: string): Promise<void>

  /**
   * Get the storage mode
   */
  getMode(): StorageMode
}
