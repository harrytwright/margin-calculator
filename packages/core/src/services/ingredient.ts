import { NotFound } from '@hndlr/errors'
import { DB, Ingredient, Supplier } from '@menubook/types'
import { Selectable, Transaction } from 'kysely'

import type { CacheAdapter } from '../cache'
import type { DatabaseContext } from '../datastore/context'
import { handleError } from '../datastore/handleError'
import type { ImportOutcome } from '../lib/importer'
import { Importer } from '../lib/importer'
import type {
  IngredientImportData,
  IngredientResolvedImportData,
} from '../schema'
import { hasChanges } from '../utils'
import { SupplierService } from './supplier'

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

export type Prefix<T> = {
  [K in keyof T as `supplier${Capitalize<Extract<K, string>>}`]?: T[K] | null
}

export type DBIngredient = Selectable<Ingredient> & {
  supplierSlug: string | null
}

export type DBIngredientWithSupplier = DBIngredient &
  Prefix<Selectable<Supplier>>

export type TransactionOr<T> = Transaction<DB> | T

export class IngredientService {
  private cache?: CacheAdapter

  constructor(
    private context: DatabaseContext,
    private readonly supplier: SupplierService,
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

  private get database() {
    return this.context.db
  }

  async exists(slug: string, trx?: Transaction<DB>) {
    return !!(await (trx ?? this.database)
      .selectFrom('Ingredient')
      .select('id')
      .where('slug', '=', slug)
      .executeTakeFirst())
  }

  findById(slug: string): Promise<DBIngredient>
  findById(slug: string, trx: Transaction<DB>): Promise<DBIngredient>
  findById(slug: string, withSupplier: true): Promise<DBIngredientWithSupplier>
  findById(slug: string, withSupplier: false): Promise<DBIngredient>
  findById(
    slug: string,
    withSupplier: boolean
  ): Promise<DBIngredient | DBIngredientWithSupplier>
  findById(
    slug: string,
    withSupplier: true,
    trx: Transaction<DB>
  ): Promise<DBIngredientWithSupplier>
  findById(
    slug: string,
    withSupplier: false,
    trx: Transaction<DB>
  ): Promise<DBIngredient>
  findById(
    slug: string,
    withSupplier: boolean,
    trx: Transaction<DB>
  ): Promise<DBIngredient | DBIngredientWithSupplier>
  findById(
    slug: string,
    withSupplier: TransactionOr<boolean> = false,
    trx?: Transaction<DB>
  ): Promise<DBIngredient | DBIngredientWithSupplier> {
    if (withSupplier instanceof Transaction) {
      trx = withSupplier
      withSupplier = false
    }

    return (trx ?? this.database)
      .selectFrom('Ingredient')
      .leftJoin('Supplier', 'Ingredient.supplierId', 'Supplier.id')
      .select([
        'Ingredient.slug',
        'Ingredient.id',
        'Ingredient.name',
        'Ingredient.category',
        'Ingredient.purchaseUnit',
        'Ingredient.purchaseCost',
        'Ingredient.includesVat',
        'Ingredient.conversionRule',
        'Ingredient.notes',
        'Ingredient.lastPurchased',
        'Ingredient.supplierId',
        'Supplier.slug as supplierSlug',
      ])
      .$if(withSupplier, (eb) =>
        eb.select([
          'Supplier.id as supplierId',
          'Supplier.name as supplierName',
          'Supplier.contactName as supplierContactName',
          'Supplier.contactEmail as supplierContactEmail',
          'Supplier.contactPhone as supplierContactPhone',
          'Supplier.notes as supplierNotes',
        ])
      )
      .where('Ingredient.slug', '=', slug)
      .executeTakeFirstOrThrow(handleError({ slug }))
  }

  // Not expandable, at least for now
  find(trx?: Transaction<DB>): Promise<DBIngredient[]> {
    return (trx ?? this.database)
      .selectFrom('Ingredient')
      .leftJoin('Supplier', 'Ingredient.supplierId', 'Supplier.id')
      .select([
        'Ingredient.slug',
        'Ingredient.id',
        'Ingredient.name',
        'Ingredient.category',
        'Ingredient.purchaseUnit',
        'Ingredient.purchaseCost',
        'Ingredient.includesVat',
        'Ingredient.conversionRule',
        'Ingredient.notes',
        'Ingredient.lastPurchased',
        'Ingredient.supplierId',
        'Supplier.slug as supplierSlug',
      ])
      .execute()
  }

  async upsert(
    slug: string,
    data: IngredientImportData | IngredientResolvedImportData,
    supplierSlug: string = 'generic',
    trx?: Transaction<DB>
  ) {
    const query = async (trx: Transaction<DB>) => {
      const result = await trx
        .insertInto('Ingredient')
        .values((eb) => ({
          slug,
          name: data.name,
          category: data.category,
          purchaseUnit: data.purchase.unit,
          purchaseCost: data.purchase.cost,
          includesVat: data.purchase.vat ? 1 : 0,
          conversionRule: data.conversionRate?.trimEnd() || null,
          supplierId: eb
            .selectFrom('Supplier')
            .select('Supplier.id')
            .where('Supplier.slug', '=', supplierSlug),
          notes: data.notes,
          lastPurchased: data.lastPurchased,
        }))
        .onConflict((oc) =>
          oc.column('slug').doUpdateSet({
            // Note: supplierId is NOT in this update - immutable after creation
            name: data.name,
            category: data.category,
            purchaseUnit: data.purchase.unit,
            purchaseCost: data.purchase.cost,
            includesVat: data.purchase.vat ? 1 : 0,
            conversionRule: data.conversionRate?.trimEnd() || null,
            notes: data.notes,
            lastPurchased: data.lastPurchased,
          })
        )
        .executeTakeFirst()

      // Invalidate cache after mutation
      await this.invalidateCache()

      return result
    }

    return trx ? query(trx) : this.database.transaction().execute(query)
  }

  async delete(slug: string, trx?: Transaction<DB>) {
    const query = async (trx: Transaction<DB>) => {
      const result = await trx
        .deleteFrom('Ingredient')
        .where('slug', '=', slug)
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

  async processor(
    importer: Importer,
    data: IngredientResolvedImportData,
    filePath: string | undefined,
    trx?: Transaction<DB>
  ): Promise<ImportOutcome> {
    const query = async (trx: Transaction<DB>) => {
      if (
        data.supplier &&
        !(await this.supplier.exists(data.supplier.slug, trx))
      ) {
        throw new Error(
          `Cannot create ingredient '${data.slug}' with missing '${data.supplier.slug}'. ` +
            `Supplier if defined should be imported in prior to ingredients`
        )
      }

      const supplier = data.supplier?.slug || 'generic'

      // Workaround for the throwing on findById
      let prev: DBIngredient | undefined = undefined
      try {
        prev = await this.findById(data.slug, false, trx)
      } catch (e) {
        if (!(e instanceof NotFound)) throw e
      }

      if (prev && prev.supplierSlug !== supplier) {
        throw new Error(
          `Cannot change supplier for ingredient '${data.slug}' from '${prev.supplierSlug}' to '${supplier}'. ` +
            `Supplier is immutable after creation. Create a new ingredient with a different slug instead.`
        )
      }

      const hasChanged = hasChanges(prev, data, {
        name: 'name',
        category: 'category',
        purchaseUnit: (data) => data.purchase.unit,
        purchaseCost: (data) => data.purchase.cost,
        conversionRule: 'conversionRate',
        notes: 'notes',
        lastPurchased: 'lastPurchased',
      })

      if (prev && !hasChanged) return 'ignored'

      const res = await this.upsert(data.slug, data, supplier, trx)
      if (res.insertId === undefined)
        throw new Error('Failed to upsert ingredient')

      return prev ? 'upserted' : 'created'
    }

    return trx ? query(trx) : this.database.transaction().execute(query)
  }
}
