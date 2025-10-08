import {Kysely} from "kysely";

import {DB} from "../datastore/types";
import {IngredientImportData} from "../schema";

export function findById (this: Kysely<DB>, slug: string) {
  return this
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

export function upsert (this: Kysely<DB>, slug: string, data: IngredientImportData, supplierSlug: string = 'generic') {
  return this
    .insertInto('Ingredient')
    .values((eb) => ({
      slug,
      name: data.name,
      category: data.category,
      purchaseUnit: data.purchaseUnit,
      purchaseCost: data.purchaseCost,
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
        purchaseUnit: data.purchaseUnit,
        purchaseCost: data.purchaseCost,
        conversionRule: data.conversionRate || null,
        notes: data.notes,
        lastPurchased: data.lastPurchased,
      })
    )
    .executeTakeFirst()
}

export async function exists (this: Kysely<DB>, slug: string) {
  return !!(await this.selectFrom('Ingredient').where('slug', '=', slug).executeTakeFirst())
}
