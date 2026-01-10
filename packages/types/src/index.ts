/**
 * @menubook/types - Shared TypeScript types for Menu Book packages
 *
 * These types are auto-generated from the Prisma schema using prisma-kysely.
 * To regenerate: `pnpm generate` from the monorepo root.
 */

// Kysely utility types
export type { ColumnType, GeneratedAlways } from 'kysely'

// Re-export all generated types
export {
  // Helper types
  type Generated,
  type Timestamp,
  // Enums (exported as both const objects and types)
  RecipeStage,
  RecipeClass,
  // Database model types
  type Ingredient,
  type Recipe,
  type RecipeIngredients,
  type Supplier,
  // Database schema
  type DB,
} from './generated'
