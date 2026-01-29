import { Kysely, sql } from 'kysely'

/**
 * Migration to convert purchaseCost from pounds (Decimal/real) to pence (integer).
 *
 * SQLite doesn't support ALTER COLUMN, so we:
 * 1. Convert existing data in place using UPDATE (SQLite is flexible with types)
 * 2. The column remains 'real' in SQLite but will store integer pence values
 *
 * Note: The Prisma schema defines this as Int, but SQLite's type affinity
 * means the column can still store the converted integer values correctly.
 */

// `any` is required here since migrations should be frozen in time.
export async function up(db: Kysely<any>): Promise<void> {
  // Convert purchaseCost from pounds (e.g., 2.14) to pence (e.g., 214)
  // CAST to INTEGER with rounding to handle floating point precision issues
  await sql`UPDATE Ingredient SET purchaseCost = CAST(ROUND(purchaseCost * 100) AS INTEGER)`.execute(
    db
  )
}

// `any` is required here since migrations should be frozen in time.
export async function down(db: Kysely<any>): Promise<void> {
  // Convert purchaseCost from pence back to pounds
  await sql`UPDATE Ingredient SET purchaseCost = purchaseCost / 100.0`.execute(
    db
  )
}
