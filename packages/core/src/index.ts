// Cache adapter
export {
  NoopCache,
  TTLCache,
  getCache,
  getDefaultCache,
  getRegisteredCaches,
  hasCache,
  registerCache,
} from './cache'
export type { CacheAdapter } from './cache'

// Realm configuration
export {
  detectRealm,
  isCloudMode,
  isFileSystemEnabled,
  realmToConfig,
  resolveRealmConfig,
} from './realm'
export type { Realm, RealmConfig, ResolveRealmOptions } from './realm'

// Database adapter
export {
  detectAdapter,
  getAdapter,
  getRegisteredAdapters,
  hasAdapter,
  registerAdapter,
} from './datastore/adapter'
export type { DatabaseAdapter } from './datastore/adapter'

// Database context
export type { DatabaseContext, JsonHelpers } from './datastore/context'

// Re-export types from @menubook/types for convenience
export { RecipeClass, RecipeStage } from '@menubook/types'
export type {
  DB,
  Generated,
  Ingredient,
  Recipe,
  RecipeIngredients,
  Supplier,
  Timestamp,
} from '@menubook/types'

// Services
export {
  ConfigService,
  DashboardService,
  ExportService,
  IngredientService,
  RecipeService,
  SupplierService,
} from './services'
export type { RecipeIngredientsLookup, RecipeWithIngredients } from './services'
export type {
  DBIngredient,
  DBIngredientWithSupplier,
} from './services/ingredient'

// Calculator
export { Calculator } from './lib/calculation/calculator'
export type {
  MarginResult,
  RecipeCostNode,
  RecipeResult,
} from './lib/calculation/types'
export {
  convertUnits,
  parseConversionRule,
  parseUnit,
} from './lib/calculation/units'
export type {
  Custom,
  Default,
  Fraction,
  Range,
  Unit,
} from './lib/calculation/units'

// Importer
export { Importer } from './lib/importer'
export type { ImportOutcome, ImportStats } from './lib/importer'

// Storage
export type {
  StorageMode,
  StorageService,
  WriteData,
  WriteObjectType,
} from './lib/storage'
export { DatabaseOnlyStorage } from './lib/storage/database-only-storage'
export { FileSystemStorage } from './lib/storage/file-system-storage'

// Graph
export * from './lib/graph/algorithms'
export * from './lib/graph/dependency'
export type * from './lib/graph/type'

// File utilities
export { FileWatcher } from './lib/file-watcher'
export type {
  FileWatcherOptions,
  WatcherEntityAction,
  WatcherEntityEvent,
} from './lib/file-watcher'
export { FileWriter } from './lib/file-writer'
export { HashService } from './lib/hash-service'

// Schema validation
export * from './schema'

// Types
export * from './types'

// Utils
export * from './utils/constants'
export { hasChanges } from './utils/has-changes'
export { slugify } from './utils/slugify'
export { tomlWriter } from './utils/toml-writer'
