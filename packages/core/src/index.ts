// Database
export {
  database,
  destroy,
  getMigrationsPath,
  migrate,
  seed,
} from './datastore/database'
export type { DB } from './datastore/types'

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
