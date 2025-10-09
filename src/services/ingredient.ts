import { Kysely } from 'kysely'

import type { DB } from '../datastore/types'
import type { ImportResult } from '../lib/importer'
import type {
  IngredientImportData,
  IngredientResolvedImportData,
} from '../schema'

import { Importer } from '../lib/importer'
import { hasChanges } from '../utils/has-changes'
import { SupplierService } from './supplier'

export class IngredientService {
  constructor(
    private database: Kysely<DB>,
    private readonly supplier: SupplierService
  ) {}

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
        'Ingredient.conversionRule',
        'Ingredient.notes',
        'Ingredient.lastPurchased',
        'Supplier.slug as supplierSlug',
      ])
      .where('Ingredient.slug', '=', slug)
      .executeTakeFirst()
  }

  upsert(
    slug: string,
    data: IngredientImportData | IngredientResolvedImportData,
    supplierSlug: string = 'generic'
  ) {
    return this.database
      .insertInto('Ingredient')
      .values((eb) => ({
        slug,
        name: data.name,
        category: data.category,
        purchaseUnit: data.purchase.unit,
        purchaseCost: data.purchase.cost,
        conversionRule: data.conversionRate || null,
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
          conversionRule: data.conversionRate || null,
          notes: data.notes,
          lastPurchased: data.lastPurchased,
        })
      )
      .executeTakeFirst()
  }

  async delete(slug: string) {
    const result = await this.database
      .deleteFrom('Ingredient')
      .where('slug', '=', slug)
      .executeTakeFirst()

    return result.numDeletedRows > 0n
  }

  async processor(
    importer: Importer,
    data: IngredientResolvedImportData,
    filePath: string | undefined
  ): Promise<ImportResult> {
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
