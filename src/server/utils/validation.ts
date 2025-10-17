import type { Kysely } from 'kysely'

import type { DB } from '../../datastore/types'

export interface ValidationError {
  field: string
  message: string
}

export class ValidationException extends Error {
  constructor(public errors: ValidationError[]) {
    super('Validation failed')
    this.name = 'ValidationException'
  }
}

/**
 * Validation helpers for API routes
 */
export class Validator {
  constructor(private database: Kysely<DB>) {}

  /**
   * Check if a supplier exists by slug
   */
  async supplierExists(slug: string): Promise<boolean> {
    const result = await this.database
      .selectFrom('Supplier')
      .select('id')
      .where('slug', '=', slug)
      .executeTakeFirst()

    return !!result
  }

  /**
   * Check if an ingredient exists by slug
   */
  async ingredientExists(slug: string): Promise<boolean> {
    const result = await this.database
      .selectFrom('Ingredient')
      .select('id')
      .where('slug', '=', slug)
      .executeTakeFirst()

    return !!result
  }

  /**
   * Check if a recipe exists by slug
   */
  async recipeExists(slug: string): Promise<boolean> {
    const result = await this.database
      .selectFrom('Recipe')
      .select('id')
      .where('slug', '=', slug)
      .executeTakeFirst()

    return !!result
  }

  /**
   * Validate that a value is a positive number
   */
  isPositiveNumber(value: unknown): boolean {
    return typeof value === 'number' && value > 0
  }

  /**
   * Validate that a value is within a range
   */
  isInRange(value: unknown, min: number, max: number): boolean {
    return typeof value === 'number' && value >= min && value <= max
  }

  /**
   * Validate that a string is not empty
   */
  isNonEmptyString(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0
  }

  /**
   * Throw validation exception with errors
   */
  fail(errors: ValidationError[]): never {
    throw new ValidationException(errors)
  }
}
