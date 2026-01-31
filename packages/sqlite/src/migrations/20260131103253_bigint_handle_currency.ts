/**
 * Work like stripe, store costing as bigint.
 *
 * Will add a new cost table, which is 1-1 with the ingredient or recipe, via `costId` value.
 *
 * export type Cost = {
 *   id: number;
 *   cost: bigint;
 *   currency: char(3);
 * }
 *
 * With this we could in the future allow for one item to have multiple costs, depending on currency.
 *
 * But this application is mainly for small to medium businesses who don't have access to large addons for things
 * like sage or their accounting software, so might not need to make those changes in the future.
 * */

import type { Kysely } from 'kysely'

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  // up migration code goes here...
  // note: up migrations are mandatory. you must implement this function.
  // For more info, see: https://kysely.dev/docs/migrations
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
  // down migration code goes here...
  // note: down migrations are optional. you can safely delete this function.
  // For more info, see: https://kysely.dev/docs/migrations
}
