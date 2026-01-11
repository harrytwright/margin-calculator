import type { CacheAdapter } from '../cache'
import type { DatabaseContext } from '../datastore/context'
import type { ImportOutcome } from '../lib/importer'
import type {
  IngredientImportData,
  IngredientResolvedImportData,
} from '../schema'

import { Importer } from '../lib/importer'
import { hasChanges } from '../utils/has-changes'
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

  async exists(slug: string) {
    return !!(await this.database
      .selectFrom('Ingredient')
      .select('id')
      .where('slug', '=', slug)
      .executeTakeFirst())
  }

  findById(slug: string) {
    return this.database
      .selectFrom('Ingredient')
      .leftJoin('Supplier', 'Ingredient.supplierId', 'Supplier.id')
      .select([
        'Ingredient.id',
        'Ingredient.name',
        'Ingredient.category',
        'Ingredient.purchaseUnit',
        'Ingredient.purchaseCost',
        'Ingredient.includesVat',
        'Ingredient.conversionRule',
        'Ingredient.notes',
        'Ingredient.lastPurchased',
        'Supplier.slug as supplierSlug',
      ])
      .where('Ingredient.slug', '=', slug)
      .executeTakeFirst()
  }

  async upsert(
    slug: string,
    data: IngredientImportData | IngredientResolvedImportData,
    supplierSlug: string = 'generic'
  ) {
    const result = await this.database
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

  async delete(slug: string) {
    const result = await this.database
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

  async processor(
    importer: Importer,
    data: IngredientResolvedImportData,
    filePath: string | undefined
  ): Promise<ImportOutcome> {
    // Check if the data has a supplier, if it has been passed it must have imported first. Otherwise SQL will throw...
    if (data.supplier && !(await this.supplier.exists(data.supplier.slug))) {
      throw new Error(
        `Cannot create ingredient '${data.slug}' with missing '${data.supplier.slug}'. ` +
          `Supplier if defined should be imported in prior to ingredients`
      )
    }

    // If no supplier is defined, we rock with the generic default
    const supplier = data.supplier?.slug || 'generic'

    // Load up the previous data if it exists
    const prev = await this.findById(data.slug)

    // Supplier is immutable, new supplied versions must have a new value
    if (prev && prev.supplierSlug !== supplier) {
      throw new Error(
        `Cannot change supplier for ingredient '${data.slug}' from '${prev.supplierSlug}' to '${supplier}'. ` +
          `Supplier is immutable after creation. Create a new ingredient with a different slug instead.`
      )
    }

    // Check if any mutable fields have changed
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

    await this.upsert(data.slug, data, supplier)

    return prev ? 'upserted' : 'created'
  }
}
