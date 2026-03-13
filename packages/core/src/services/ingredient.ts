import {
  DatabaseContext,
  DB,
  IDType,
  Ingredient,
  IngredientCost,
  NewIngredient,
  NewIngredientCost,
  NewPricing,
  Pricing,
  Supplier,
  TransactionOr,
  UpdateIngredient,
} from '@menubook/shared'
import { Transaction } from 'kysely'

import type { CacheAdapter } from '../cache'
import { handleError } from '../datastore/handleError'
import { hasChanges } from '../utils'
import { parseWithSchema } from '../validation'
import {
  ingredientCreateSchema,
  ingredientPricingInputSchema,
  ingredientSupplierRefSchema,
  ingredientUpdateSchema,
} from '../validation/zod'

/** Cache key patterns for invalidation */
const CACHE_PATTERNS = {
  /** Invalidate all margin calculations */
  margin: 'margin:*',
  /** Invalidate all dashboard stats */
  dashboard: 'dashboard:*',
} as const

export interface IngredientServiceOptions {
  /** Cache adapter for invalidation on mutations */
  cache?: CacheAdapter
}

export type IngredientPricing = Omit<
  IngredientCost,
  'ingredientId' | 'pricingId'
> &
  Omit<Pricing, 'id'>

export type IngredientWithPricing = Ingredient & {
  cost: IngredientPricing
  supplierSlug?: string
}

export type IngredientWithHistory = IngredientWithPricing & {
  historicalPricing: IngredientPricing[]
}

export type IngredientWithHistoryAndSupplier = IngredientWithHistory & {
  supplier: Supplier
}

export class IngredientService {
  private cache?: CacheAdapter

  constructor(
    private context: DatabaseContext,
    options: IngredientServiceOptions = {}
  ) {
    this.cache = options.cache
  }

  /**
   * Invalidate cache entries affected by ingredient changes.
   * Called automatically on upsert/delete.
   */
  private async invalidateCache(): Promise<void> {
    if (!this.cache) return
    await Promise.all([
      this.cache.invalidatePattern(CACHE_PATTERNS.margin),
      this.cache.invalidatePattern(CACHE_PATTERNS.dashboard),
    ])
  }

  get database() {
    return this.context.db
  }

  get transaction() {
    return this.database.transaction()
  }

  // The CLI will set a global value, bar the UI command, to say whether this is running as a CLI/TUI or not
  get isInCLIMode() {
    // @ts-ignore
    return globalThis[Symbol.for('isCLI')] === true
  }

  find(trx?: Transaction<DB>): Promise<IngredientWithPricing[]> {
    const base = trx ?? this.database
    const jsonObjectFrom = this.context.helpers.jsonObjectFrom

    return base
      .selectFrom('Ingredient')
      .selectAll('Ingredient')
      .innerJoin('Supplier', 'Ingredient.supplierId', 'Supplier.id')
      .select('Supplier.slug as supplierSlug')
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('IngredientCost')
            .select([
              'IngredientCost.id',
              'IngredientCost.unit',
              'IngredientCost.vat',
              'IngredientCost.validFrom',
              'IngredientCost.validTo',
            ])
            .leftJoin('Pricing', 'IngredientCost.pricingId', 'Pricing.id')
            .select(['Pricing.cost as cost', 'Pricing.currency as currency'])
            .where('IngredientCost.validTo', 'is', null)
            .whereRef('Ingredient.id', '=', 'IngredientCost.ingredientId')
        )
          .$notNull()
          .$castTo<IngredientPricing>() // Annoying, but seems to work? Not seen this before w/ date being a cunt
          .as('cost')
      )
      .execute()
  }

  findById(slug: IDType): Promise<IngredientWithHistory>
  findById(slug: IDType, trx: Transaction<DB>): Promise<IngredientWithHistory>
  findById(
    slug: IDType,
    withSupplier: true
  ): Promise<IngredientWithHistoryAndSupplier>
  findById(slug: IDType, withSupplier: false): Promise<IngredientWithHistory>
  findById(
    slug: IDType,
    withSupplier: boolean
  ): Promise<IngredientWithHistory | IngredientWithHistoryAndSupplier>
  findById(
    slug: IDType,
    withSupplier: true,
    trx: Transaction<DB>
  ): Promise<IngredientWithHistoryAndSupplier>
  findById(
    slug: IDType,
    withSupplier: false,
    trx: Transaction<DB>
  ): Promise<IngredientWithHistory>
  findById(
    slug: IDType,
    withSupplier: boolean,
    trx: Transaction<DB>
  ): Promise<IngredientWithHistory | IngredientWithHistoryAndSupplier>
  findById(
    slug: IDType,
    withSupplierOrTrx: TransactionOr<boolean> = false,
    trx?: Transaction<DB>
  ): Promise<IngredientWithHistory | IngredientWithHistoryAndSupplier> {
    if (withSupplierOrTrx instanceof Transaction) {
      trx = withSupplierOrTrx
      withSupplierOrTrx = false
    }

    const base = trx ?? this.database
    const jsonObjectFrom = this.context.helpers.jsonObjectFrom
    const jsonArrayFrom = this.context.helpers.jsonArrayFrom

    return base
      .selectFrom('Ingredient')
      .selectAll('Ingredient')
      .innerJoin('Supplier', 'Ingredient.supplierId', 'Supplier.id')
      .select('Supplier.slug as supplierSlug')
      .select((eb) => [
        jsonObjectFrom(
          eb
            .selectFrom('IngredientCost')
            .select([
              'IngredientCost.id',
              'IngredientCost.unit',
              'IngredientCost.vat',
              'IngredientCost.validFrom',
              'IngredientCost.validTo',
            ])
            .innerJoin('Pricing', 'IngredientCost.pricingId', 'Pricing.id')
            .select(['Pricing.cost as cost', 'Pricing.currency as currency'])
            .where('IngredientCost.validTo', 'is', null)
            .whereRef('Ingredient.id', '=', 'IngredientCost.ingredientId')
        )
          .$notNull()
          .$castTo<IngredientPricing>() // Annoying, but seems to work? Not seen this before w/ date being a cunt
          .as('cost'),
        jsonArrayFrom(
          eb
            .selectFrom('IngredientCost')
            .select([
              'IngredientCost.id',
              'IngredientCost.unit',
              'IngredientCost.vat',
              'IngredientCost.validFrom',
              'IngredientCost.validTo',
            ])
            .leftJoin('Pricing', 'IngredientCost.pricingId', 'Pricing.id')
            .select(['Pricing.cost as cost', 'Pricing.currency as currency'])
            .where('IngredientCost.validTo', 'is not', null)
            .whereRef('Ingredient.id', '=', 'IngredientCost.ingredientId')
        )
          .$castTo<IngredientPricing[]>()
          .as('historicalPricing'),
      ])
      .$if(withSupplierOrTrx, (qb) =>
        qb.select((eb) => [
          jsonObjectFrom(
            eb
              .selectFrom('Supplier')
              .select([
                'Supplier.id',
                'Supplier.name',
                'Supplier.slug',
                'Supplier.notes',
              ])
              .whereRef('Supplier.id', '=', 'Ingredient.supplierId')
          ).as('supplier'),
        ])
      )
      .where(
        typeof slug === 'string' ? 'Ingredient.slug' : 'Ingredient.id',
        '=',
        slug
      )
      .executeTakeFirstOrThrow(
        handleError({ [typeof slug === 'string' ? 'slug' : 'id']: slug })
      )
  }

  // Split prior, due to the complexities of the schema. Supplier, generic, is a seeded value from now on, defaulted
  // to `1` in the database.
  create(
    args: NewIngredient,
    supplier: string | number,
    costing: Omit<NewIngredientCost, 'ingredientId' | 'pricingId'> & NewPricing,
    trx?: Transaction<DB>
  ) {
    const validatedArgs = parseWithSchema(
      ingredientCreateSchema,
      args,
      'Invalid ingredient data'
    )
    const validatedSupplier = parseWithSchema(
      ingredientSupplierRefSchema,
      supplier,
      'Invalid supplier reference'
    )
    const validatedCosting = parseWithSchema(
      ingredientPricingInputSchema,
      costing,
      'Invalid ingredient pricing data'
    )

    const query = async (trx: Transaction<DB>) => {
      const exists = await this.exists(validatedArgs.slug, trx)

      if (exists)
        throw Object.assign(
          new Error(
            `Ingredient with slug '${validatedArgs.slug}' already exists`
          ),
          { code: 'ERR_CONFLICT_409' }
        )

      const value = await trx
        .insertInto('Ingredient')
        .values(({ selectFrom }) => ({
          ...validatedArgs,
          supplierId:
            typeof validatedSupplier === 'number'
              ? validatedSupplier
              : selectFrom('Supplier')
                  .select('id')
                  .where('slug', '=', validatedSupplier),
        }))
        .executeTakeFirst()

      if (!value.insertId)
        throw Object.assign(new Error('Failed to insert ingredient'), {
          code: 'ERR_INTERNAL_SERVER_ERROR_500',
        })

      await this.updatePricingHistory(
        Number(value.insertId),
        validatedCosting,
        trx
      )

      return this.findById(validatedArgs.slug, false, trx)
    }

    return trx ? query(trx) : this.transaction.execute(query)
  }

  // The update function here is less complex than the creation, only handles the updating of the core ingredient.
  // `costing` should be done via the `updatePricingHistory` function.
  update(slug: string, args: UpdateIngredient, trx?: Transaction<DB>) {
    const validatedArgs = parseWithSchema(
      ingredientUpdateSchema,
      args,
      'Invalid ingredient update'
    )

    const query = async (trx: Transaction<DB>) => {
      const prev = await this.findById(slug, false, trx)

      // This is enabled in the webapp, but not the CLI, due to hard coded references. Can be amended
      // in the future if we allow the CLI to change references within the file system.
      if (
        this.isInCLIMode &&
        hasChanges(prev, validatedArgs, {
          supplierId: 'supplierId',
        })
      ) {
        throw new Error('CLI cannot change the supplier of an ingredient.')
      }

      // Slug cannot be changed. Immutable after creation, would break the CLI if done, will
      // keep this the same for the UI tool.
      if (
        validatedArgs.slug &&
        hasChanges(prev, validatedArgs, { slug: 'slug' })
      )
        throw Object.assign(
          new Error(`Cannot change slug of ingredient '${prev.slug}'`),
          { code: 'ERR_BAD_REQUEST_400' }
        )

      const value = await trx
        .updateTable('Ingredient')
        .set(validatedArgs)
        .where('slug', '=', slug)
        .executeTakeFirst()

      if (!value.numUpdatedRows)
        throw Object.assign(new Error('Failed to update ingredient'), {
          code: 'ERR_INTERNAL_SERVER_ERROR_500',
        })

      return this.findById(slug, false, trx)
    }

    return trx ? query(trx) : this.transaction.execute(query)
  }

  async delete(slug: IDType, trx?: Transaction<DB>) {
    const query = async (trx: Transaction<DB>) => {
      const result = await trx
        .deleteFrom('Ingredient')
        .where(typeof slug === 'string' ? 'slug' : 'id', '=', slug)
        .executeTakeFirst()

      const deleted = result.numDeletedRows > 0n

      // Invalidate cache after deletion
      if (deleted) {
        await this.invalidateCache()
      }

      return deleted
    }

    return trx ? query(trx) : this.database.transaction().execute(query)
  }

  async updatePricingHistory(
    ingredientId: number,
    costing: Omit<NewIngredientCost, 'ingredientId' | 'pricingId'> & NewPricing,
    trx?: Transaction<DB>
  ): Promise<IngredientPricing> {
    const validatedCosting = parseWithSchema(
      ingredientPricingInputSchema,
      costing,
      'Invalid ingredient pricing data'
    )

    const query = async (trx: Transaction<DB>) => {
      const [cost, pricing] = splitCostingToTables(validatedCosting)

      const time = new Date()

      // Handle previous costing history, in theory their should only 1 active costing
      await trx
        .updateTable('IngredientCost')
        .set({
          validTo: this.context.type === 'postgres' ? time : time.toISOString(),
        })
        .where((eb) =>
          eb.and([
            eb('ingredientId', '=', ingredientId),
            eb('validTo', 'is', null),
          ])
        )
        .executeTakeFirst()

      // Set the `pricing` first, then the `costing`. Assume the currency has been validated before getting
      // to this stage. Not sure what to return tbh, probably just the new pricing?
      let value = await trx
        .insertInto('Pricing')
        .values({
          ...pricing, // @ts-ignore Have to do it this way to prevent issues with Sqlite
          cost:
            this.context.type === 'postgres'
              ? pricing.cost
              : BigInt(pricing.cost),
        })
        .executeTakeFirst()

      if (!value.insertId)
        throw Object.assign(new Error('Failed to insert pricing'), {
          code: 'ERR_INTERNAL_SERVER_ERROR_500',
        })

      value = await trx
        .insertInto('IngredientCost')
        .values({
          ...cost, // @ts-ignore Have to do it this way to prevent issues with Sqlite
          vat: this.context.type === 'postgres' ? cost.vat : +cost.vat,
          validFrom:
            this.context.type === 'postgres' ? time : time.toISOString(),
          pricingId: Number(value.insertId),
          ingredientId,
        })
        .executeTakeFirst()

      if (!value.insertId)
        throw Object.assign(new Error('Failed to insert costing'), {
          code: 'ERR_INTERNAL_SERVER_ERROR_500',
        })

      return this.__unsafe_findMostRecentCosting(ingredientId, trx)
    }

    return trx ? query(trx) : this.transaction.execute(query)
  }

  async __unsafe_findMostRecentCosting(
    ingredientId: number,
    trx?: Transaction<DB>
  ): Promise<IngredientPricing> {
    return (trx ?? this.database)
      .selectFrom('IngredientCost')
      .innerJoin('Pricing', 'IngredientCost.pricingId', 'Pricing.id')
      .select([
        'IngredientCost.id',
        'IngredientCost.unit',
        'IngredientCost.vat',
        'IngredientCost.validFrom',
        'IngredientCost.validTo',
        'Pricing.cost',
        'Pricing.currency',
      ])
      .where((eb) =>
        eb.and([
          eb('IngredientCost.ingredientId', '=', ingredientId),
          eb('IngredientCost.validTo', 'is', null),
        ])
      )
      .executeTakeFirstOrThrow(handleError({ ingredientId }))
  }

  async exists(slug: string, trx?: Transaction<DB>) {
    return !!(await (trx ?? this.database)
      .selectFrom('Ingredient')
      .select('id')
      .where('slug', '=', slug)
      .executeTakeFirst())
  }

}

function splitCostingToTables(
  data: Omit<NewIngredientCost, 'ingredientId' | 'pricingId'> & NewPricing
): [Omit<NewIngredientCost, 'ingredientId' | 'pricingId'>, NewPricing] {
  const { cost, currency, ...rest } = data

  return [rest, { cost, currency }]
}
