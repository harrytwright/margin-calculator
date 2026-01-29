import {
  createDatabase,
  jsonArrayFrom,
  jsonObjectFrom,
  migrate,
} from '@menubook/sqlite'

import type { DatabaseContext } from '../../datastore/context'
import { Importer } from '../../lib/importer'
import { IngredientResolvedImportData } from '../../schema'
import { IngredientService } from '../ingredient'
import { SupplierService } from '../supplier'

describe('IngredientService', () => {
  let context: DatabaseContext
  let service: IngredientService
  let supplierService: SupplierService
  let supplierId: number

  beforeEach(async () => {
    const db = createDatabase(':memory:')
    await migrate(db)

    context = {
      db,
      helpers: { jsonArrayFrom, jsonObjectFrom },
    }

    supplierService = new SupplierService(context)
    service = new IngredientService(context, supplierService)

    // Create generic supplier (used as default)
    await context.db
      .insertInto('Supplier')
      .values({ slug: 'generic', name: 'Generic Supplier' })
      .execute()

    // Create a test supplier
    const supplier = await context.db
      .insertInto('Supplier')
      .values({ slug: 'asda', name: 'Asda' })
      .returning('id')
      .executeTakeFirst()
    supplierId = supplier!.id
  })

  afterEach(async () => {
    await context.db.destroy()
  })

  describe('exists', () => {
    test('should return false for non-existent ingredient', async () => {
      const exists = await service.exists('ham')
      expect(exists).toBe(false)
    })

    test('should return true for existing ingredient', async () => {
      await context.db
        .insertInto('Ingredient')
        .values({
          slug: 'ham',
          name: 'Ham',
          category: 'meat',
          purchaseUnit: '1kg',
          purchaseCost: 599,
          includesVat: 0,
          supplierId,
        })
        .execute()

      const exists = await service.exists('ham')
      expect(exists).toBe(true)
    })
  })

  describe('findById', () => {
    test('should return undefined for non-existent ingredient', async () => {
      const result = await service.findById('ham')
      expect(result).toBeUndefined()
    })

    test('should return ingredient data with supplier info', async () => {
      await context.db
        .insertInto('Ingredient')
        .values({
          slug: 'ham',
          name: 'Sliced Ham',
          category: 'meat',
          purchaseUnit: '1kg',
          purchaseCost: 599,
          includesVat: 0,
          supplierId,
          notes: 'Premium quality',
        })
        .execute()

      const result = await service.findById('ham')
      expect(result).toMatchObject({
        id: expect.any(Number),
        name: 'Sliced Ham',
        category: 'meat',
        purchaseUnit: '1kg',
        purchaseCost: 599,
        includesVat: 0,
        supplierSlug: 'asda',
        notes: 'Premium quality',
      })
    })

    test('should handle ingredient without notes', async () => {
      await context.db
        .insertInto('Ingredient')
        .values({
          slug: 'cheese',
          name: 'Cheese',
          category: 'dairy',
          purchaseUnit: '200g',
          purchaseCost: 250,
          includesVat: 0,
          supplierId,
        })
        .execute()

      const result = await service.findById('cheese')
      expect(result?.notes).toBeNull()
    })
  })

  describe('upsert', () => {
    test('should create new ingredient', async () => {
      const data: IngredientResolvedImportData = {
        slug: 'ham',
        name: 'Ham',
        category: 'meat',
        purchase: {
          unit: '1kg',
          cost: 599,
          vat: false,
        },
      }

      await service.upsert('ham', data, 'asda')

      const ingredient = await context.db
        .selectFrom('Ingredient')
        .selectAll()
        .where('slug', '=', 'ham')
        .executeTakeFirst()

      expect(ingredient).toMatchObject({
        slug: 'ham',
        name: 'Ham',
        category: 'meat',
        purchaseUnit: '1kg',
        purchaseCost: 599,
        includesVat: 0,
        supplierId,
      })
    })

    test('should update existing ingredient', async () => {
      await context.db
        .insertInto('Ingredient')
        .values({
          slug: 'ham',
          name: 'Old Ham',
          category: 'meat',
          purchaseUnit: '500g',
          purchaseCost: 300,
          includesVat: 0,
          supplierId,
        })
        .execute()

      const data: IngredientResolvedImportData = {
        slug: 'ham',
        name: 'New Ham',
        category: 'meat',
        purchase: {
          unit: '1kg',
          cost: 599,
          vat: false,
        },
      }

      await service.upsert('ham', data, 'asda')

      const ingredient = await context.db
        .selectFrom('Ingredient')
        .selectAll()
        .where('slug', '=', 'ham')
        .executeTakeFirst()

      expect(ingredient).toMatchObject({
        name: 'New Ham',
        purchaseUnit: '1kg',
        purchaseCost: 599,
        includesVat: 0,
      })
    })

    test('should preserve supplierId on update', async () => {
      const anotherSupplier = await context.db
        .insertInto('Supplier')
        .values({ slug: 'tesco', name: 'Tesco' })
        .returning('id')
        .executeTakeFirst()

      await context.db
        .insertInto('Ingredient')
        .values({
          slug: 'cheese',
          name: 'Cheese',
          category: 'dairy',
          purchaseUnit: '200g',
          purchaseCost: 250,
          includesVat: 0,
          supplierId: anotherSupplier!.id,
        })
        .execute()

      const data: IngredientResolvedImportData = {
        slug: 'cheese',
        name: 'Updated Cheese',
        category: 'dairy',
        purchase: {
          unit: '250g',
          cost: 300,
          vat: false,
        },
      }

      // Try to update with different supplier - should be ignored in upsert
      await service.upsert('cheese', data, 'asda')

      const ingredient = await context.db
        .selectFrom('Ingredient')
        .selectAll()
        .where('slug', '=', 'cheese')
        .executeTakeFirst()

      // supplierId should remain unchanged (immutable)
      expect(ingredient?.supplierId).toBe(anotherSupplier!.id)
      expect(ingredient?.name).toBe('Updated Cheese')
    })

    test('should handle conversion rules', async () => {
      const data: IngredientResolvedImportData = {
        slug: 'bread',
        name: 'Bread',
        category: 'bakery',
        purchase: {
          unit: '1 loaf',
          cost: 120,
          vat: false,
        },
        conversionRate: '1 loaf = 16 slices',
      }

      await service.upsert('bread', data, 'asda')

      const ingredient = await service.findById('bread')
      expect(ingredient?.conversionRule).toBe('1 loaf = 16 slices')
    })
  })

  describe('delete', () => {
    test('should return false when deleting non-existent ingredient', async () => {
      const deleted = await service.delete('ham')
      expect(deleted).toBe(false)
    })

    test('should return true and delete existing ingredient', async () => {
      await context.db
        .insertInto('Ingredient')
        .values({
          slug: 'ham',
          name: 'Ham',
          category: 'meat',
          purchaseUnit: '1kg',
          purchaseCost: 599,
          includesVat: 0,
          supplierId,
        })
        .execute()

      const deleted = await service.delete('ham')
      expect(deleted).toBe(true)

      const exists = await service.exists('ham')
      expect(exists).toBe(false)
    })
  })

  describe('processor', () => {
    let importer: Importer

    beforeEach(() => {
      importer = new Importer(context)
    })

    test('should return "created" for new ingredient', async () => {
      const data: IngredientResolvedImportData = {
        slug: 'ham',
        name: 'Ham',
        category: 'meat',
        purchase: {
          unit: '1kg',
          cost: 599,
          vat: false,
        },
        supplier: { slug: 'asda' },
      }

      const result = await service.processor(importer, data, undefined)
      expect(result).toBe('created')

      const ingredient = await service.findById('ham')
      expect(ingredient?.name).toBe('Ham')
    })

    test('should return "upserted" for updated ingredient', async () => {
      await context.db
        .insertInto('Ingredient')
        .values({
          slug: 'ham',
          name: 'Old Ham',
          category: 'meat',
          purchaseUnit: '500g',
          purchaseCost: 300,
          includesVat: 0,
          supplierId,
        })
        .execute()

      const data: IngredientResolvedImportData = {
        slug: 'ham',
        name: 'New Ham',
        category: 'meat',
        purchase: {
          unit: '1kg',
          cost: 599,
          vat: false,
        },
        supplier: { slug: 'asda' },
      }

      const result = await service.processor(importer, data, undefined)
      expect(result).toBe('upserted')
    })

    test('should return "ignored" when no changes detected', async () => {
      await context.db
        .insertInto('Ingredient')
        .values({
          slug: 'ham',
          name: 'Ham',
          category: 'meat',
          purchaseUnit: '1kg',
          purchaseCost: 599,
          includesVat: 0,
          supplierId,
        })
        .execute()

      const data: IngredientResolvedImportData = {
        slug: 'ham',
        name: 'Ham',
        category: 'meat',
        purchase: {
          unit: '1kg',
          cost: 599,
          vat: false,
        },
        supplier: { slug: 'asda' },
      }

      const result = await service.processor(importer, data, undefined)
      expect(result).toBe('ignored')
    })

    test('should use generic supplier when not specified', async () => {
      const data: IngredientResolvedImportData = {
        slug: 'ham',
        name: 'Ham',
        category: 'meat',
        purchase: {
          unit: '1kg',
          cost: 599,
          vat: false,
        },
      }

      const result = await service.processor(importer, data, undefined)
      expect(result).toBe('created')

      const ingredient = await context.db
        .selectFrom('Ingredient')
        .innerJoin('Supplier', 'Ingredient.supplierId', 'Supplier.id')
        .select('Supplier.slug as supplierSlug')
        .where('Ingredient.slug', '=', 'ham')
        .executeTakeFirst()

      expect(ingredient?.supplierSlug).toBe('generic')
    })

    test('should throw error when supplier does not exist', async () => {
      const data: IngredientResolvedImportData = {
        slug: 'ham',
        name: 'Ham',
        category: 'meat',
        purchase: {
          unit: '1kg',
          cost: 599,
          vat: false,
        },
        supplier: { slug: 'non-existent' },
      }

      await expect(
        service.processor(importer, data, undefined)
      ).rejects.toThrow(/missing 'non-existent'/)
    })

    test('should throw error when changing supplier on existing ingredient', async () => {
      await context.db
        .insertInto('Supplier')
        .values({ slug: 'tesco', name: 'Tesco' })
        .execute()

      await context.db
        .insertInto('Ingredient')
        .values({
          slug: 'ham',
          name: 'Ham',
          category: 'meat',
          purchaseUnit: '1kg',
          purchaseCost: 599,
          includesVat: 0,
          supplierId,
        })
        .execute()

      const data: IngredientResolvedImportData = {
        slug: 'ham',
        name: 'Ham',
        category: 'meat',
        purchase: {
          unit: '1kg',
          cost: 599,
          vat: false,
        },
        supplier: { slug: 'tesco' },
      }

      await expect(
        service.processor(importer, data, undefined)
      ).rejects.toThrow(/Cannot change supplier/)
    })

    test('should detect changes in purchase details', async () => {
      await context.db
        .insertInto('Ingredient')
        .values({
          slug: 'cheese',
          name: 'Cheese',
          category: 'dairy',
          purchaseUnit: '200g',
          purchaseCost: 250,
          includesVat: 0,
          supplierId,
        })
        .execute()

      const data: IngredientResolvedImportData = {
        slug: 'cheese',
        name: 'Cheese',
        category: 'dairy',
        purchase: {
          unit: '200g',
          cost: 300, // Changed cost
          vat: false,
        },
        supplier: { slug: 'asda' },
      }

      const result = await service.processor(importer, data, undefined)
      expect(result).toBe('upserted')
    })
  })
})
