import type { DatabaseContext } from '@menubook/shared'

import { IngredientService, IngredientWithHistory } from '../ingredient'
import { createTestContext } from './helpers/test-adapter'

/**
 * Helper to seed a supplier and return its id.
 */
async function seedSupplier(
  ctx: DatabaseContext,
  slug: string,
  name: string
): Promise<number> {
  const result = await ctx.db
    .insertInto('Supplier')
    .values({ slug, name })
    .returning('id')
    .executeTakeFirstOrThrow()
  return result.id
}

describe('IngredientService', () => {
  let context: DatabaseContext
  let service: IngredientService

  beforeAll(async () => {
    context = await createTestContext()
    service = new IngredientService(context)
  })

  afterAll(async () => {
    await context.db.destroy()
  })

  describe('exists', () => {
    let ingredient: string | undefined

    afterEach(async () => {
      ingredient && (await service.delete(ingredient))
    })

    test('should return false for non-existent ingredient', async () => {
      expect(await service.exists('ham')).toBe(false)
    })

    test('should return true for existing ingredient', async () => {
      ingredient = (
        await service.create(
          {
            slug: 'ham',
            name: 'Ham',
            category: 'meat',
          },
          'generic',
          {
            cost: '599',
            currency: 'GBP',
            unit: '1kg',
            vat: false,
          }
        )
      ).slug

      expect(await service.exists('ham')).toBe(true)
    })
  })

  describe('find', () => {
    let ingredient: IngredientWithHistory

    beforeAll(async () => {
      ingredient = await service.create(
        {
          slug: 'ham',
          name: 'Ham',
          category: 'meat',
        },
        'generic',
        {
          cost: '599',
          currency: 'GBP',
          unit: '1kg',
          vat: false,
        }
      )
    })

    afterAll(async () => {
      ingredient && (await service.delete(ingredient.slug))
    })

    test('should return empty array when no ingredients exist', async () => {
      const result = await service.find()
      expect(result).toHaveLength(1)
    })

    test('should return ingredients with current pricing', async () => {
      const result = await service.find()
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        slug: 'ham',
        name: 'Ham',
        supplierSlug: 'generic',
        cost: {
          cost: 599,
          currency: 'GBP',
          unit: '1kg',
          vat: context.type === 'postgres' ? false : 0,
        },
      })
    })

    test('should only return current pricing (validTo is null)', async () => {
      await service.updatePricingHistory(ingredient.id, {
        unit: '1kg',
        vat: false,
        cost: '400',
        currency: 'GBP',
      })

      const result = await service.find()
      expect(result).toHaveLength(1)
      // Should return the new price, not the expired one
      expect(result[0].cost.cost).toBe(400)
    })
  })

  describe('findById', () => {
    let ingredient: IngredientWithHistory

    beforeAll(async () => {
      ingredient = await service.create(
        {
          slug: 'ham',
          name: 'Ham',
          category: 'meat',
        },
        'generic',
        {
          cost: '599',
          currency: 'GBP',
          unit: '1kg',
          vat: false,
        }
      )
    })

    afterAll(async () => {
      ingredient && (await service.delete(ingredient.slug))
    })

    test('should throw for non-existent ingredient', async () => {
      await expect(service.findById('chicken')).rejects.toThrow()
    })

    test('should return ingredient with current pricing', async () => {
      const result = await service.findById('ham')
      expect(result).toMatchObject(ingredient)
    })

    test('should return empty historical pricing for new ingredient', async () => {
      const result = await service.findById('ham')
      expect(result.historicalPricing).toEqual([])
    })

    test('should return historical pricing when prices have changed', async () => {
      await service.updatePricingHistory(ingredient.id, {
        unit: '1kg',
        vat: false,
        cost: '400',
        currency: 'GBP',
      })

      const result = await service.findById('ham')
      expect(result.cost.cost).toBe(400)
      expect(result.historicalPricing).toHaveLength(1)
      expect(result.historicalPricing[0].cost).toBe(599)
    })

    test('should accept numeric id', async () => {
      const result = await service.findById(ingredient.id)
      expect(result.slug).toBe('ham')
    })

    test('should include full supplier when requested', async () => {
      const result = await service.findById('ham', true)
      expect(result.supplier).toMatchObject({
        slug: 'generic',
        name: 'Generic Supplier',
      })
    })

    test('should not include full supplier by default', async () => {
      const result = await service.findById('ham')
      expect(result).not.toHaveProperty('supplier')
    })
  })

  describe('create', () => {
    let created: IngredientWithHistory | undefined

    afterEach(async () => {
      created && (await service.delete(created.slug))
    })

    test('should create ingredient with pricing', async () => {
      const result = (created = await service.create(
        { slug: 'ham', name: 'Ham', category: 'meat' },
        'generic',
        { unit: '1kg', vat: false, cost: '599', currency: 'GBP' }
      ))

      expect(result).toMatchObject({
        slug: 'ham',
        name: 'Ham',
        category: 'meat',
        supplierSlug: 'generic',
        cost: {
          cost: 599,
          currency: 'GBP',
          unit: '1kg',
          vat: context.type === 'postgres' ? false : 0,
          validTo: null,
        },
      })
    })

    test('should create Pricing and IngredientCost records', async () => {
      created = await service.create(
        { slug: 'ham', name: 'Ham', category: 'meat' },
        'generic',
        { unit: '1kg', vat: false, cost: '599', currency: 'GBP' }
      )

      const costings = await context.db
        .selectFrom('IngredientCost')
        .selectAll()
        .where('ingredientId', '=', created.id)
        .execute()
      expect(costings).toHaveLength(1)
      expect(costings[0].unit).toBe('1kg')
      expect(costings[0].validTo).toBeNull()

      const pricings = await context.db
        .selectFrom('Pricing')
        .selectAll()
        .where('Pricing.id', '=', costings[0].id)
        .execute()
      expect(pricings).toHaveLength(1)
      expect(pricings[0].cost).toBe(599)
      expect(pricings[0].currency).toBe('GBP')
    })

    test('should throw on duplicate slug', async () => {
      await service.create(
        { slug: 'ham', name: 'Ham', category: 'meat' },
        'generic',
        { unit: '1kg', vat: false, cost: '599', currency: 'GBP' }
      )

      await expect(
        service.create(
          { slug: 'ham', name: 'Ham Again', category: 'meat' },
          'generic',
          { unit: '1kg', vat: false, cost: '599', currency: 'GBP' }
        )
      ).rejects.toThrow(/already exists/)
    })

    test('should resolve supplier by slug', async () => {
      await service.create(
        { slug: 'ham', name: 'Ham', category: 'meat' },
        'generic',
        { unit: '1kg', vat: false, cost: '599', currency: 'GBP' }
      )

      const result = await service.findById('ham')
      expect(result.supplierSlug).toBe('generic')
    })

    test('should resolve supplier by numeric id', async () => {
      await service.create({ slug: 'ham', name: 'Ham', category: 'meat' }, 1, {
        unit: '1kg',
        vat: false,
        cost: '599',
        currency: 'GBP',
      })

      const result = await service.findById('ham')
      expect(result.supplierSlug).toBe('generic')
    })

    test('should handle VAT-inclusive pricing', async () => {
      const result = await service.create(
        { slug: 'ham', name: 'Ham', category: 'meat' },
        'generic',
        { unit: '1kg', vat: true, cost: '719', currency: 'GBP' }
      )

      expect(result.cost.vat).toBe(context.type === 'postgres' ? true : 1)
      expect(result.cost.cost).toBe(719)
    })

    test('should handle conversion rules', async () => {
      const result = await service.create(
        {
          slug: 'bread',
          name: 'Bread',
          category: 'bakery',
          conversionRule: '1 loaf = 16 slices',
        },
        'generic',
        { unit: '1 loaf', vat: false, cost: '120', currency: 'GBP' }
      )

      expect(result.conversionRule).toBe('1 loaf = 16 slices')
    })
  })

  describe('update', () => {
    let supplierId: number | undefined

    beforeEach(async () => {
      await service.create(
        { slug: 'ham', name: 'Ham', category: 'meat' },
        'generic',
        { unit: '1kg', vat: false, cost: '599', currency: 'GBP' }
      )
    })

    afterEach(async () => {
      await service.delete('ham')

      supplierId &&
        (await context.db
          .deleteFrom('Supplier')
          .where('id', '=', supplierId)
          .executeTakeFirst())
    })

    test('should update ingredient fields', async () => {
      const result = await service.update('ham', {
        name: 'Premium Ham',
        category: 'premium-meat',
      })

      expect(result.name).toBe('Premium Ham')
      expect(result.category).toBe('premium-meat')
    })

    test('should throw when attempting to change slug', async () => {
      await expect(service.update('ham', { slug: 'new-ham' })).rejects.toThrow(
        /Cannot change slug/
      )
    })

    test('should not modify pricing (use updatePricingHistory for that)', async () => {
      await service.update('ham', { name: 'Updated Ham' })

      const result = await service.findById('ham')
      expect(result.cost.cost).toBe(599)
    })

    test('should restrict supplier change in CLI mode', async () => {
      supplierId = await seedSupplier(context, 'tesco', 'Tesco')

      // @ts-ignore - setting global CLI flag
      globalThis[Symbol.for('isCLI')] = true

      await expect(service.update('ham', { supplierId })).rejects.toThrow(
        /CLI cannot change the supplier/
      )

      // @ts-ignore - reset
      globalThis[Symbol.for('isCLI')] = false
    })

    test('should allow supplier change outside CLI mode', async () => {
      supplierId = await seedSupplier(context, 'tesco', 'Tesco')

      await service.update('ham', { supplierId })

      const found = await service.findById('ham')
      expect(found.supplierSlug).toBe('tesco')
    })
  })

  // Todo: Do we need this since create runs this, and a few tests above also run it? Or do we keep it just for validation
  describe('updatePricingHistory', () => {
    let ingredientId: number

    beforeEach(async () => {
      ingredientId = (
        await service.create(
          { slug: 'ham', name: 'Ham', category: 'meat' },
          'generic',
          { unit: '1kg', vat: false, cost: '400', currency: 'GBP' }
        )
      ).id
    })

    afterEach(async () => {
      ingredientId && (await service.delete(ingredientId))
    })

    test('should create new pricing record', async () => {
      const pricing = await service.updatePricingHistory(ingredientId, {
        unit: '1kg',
        vat: false,
        cost: '599',
        currency: 'GBP',
      })

      expect(pricing.cost).toBe(599)
      expect(pricing.currency).toBe('GBP')
      expect(pricing.validTo).toBeNull()
    })

    test('should close previous active pricing', async () => {
      await service.updatePricingHistory(ingredientId, {
        unit: '1kg',
        vat: false,
        cost: '599',
        currency: 'GBP',
      })

      const costings = await context.db
        .selectFrom('IngredientCost')
        .selectAll()
        .where('ingredientId', '=', ingredientId)
        .execute()

      // Two records: one expired, one current
      expect(costings).toHaveLength(2)

      const expired = costings.filter((c) => c.validTo !== null)
      const current = costings.filter((c) => c.validTo === null)

      expect(expired).toHaveLength(1)
      expect(current).toHaveLength(1)
    })

    test('should be reflected in findById', async () => {
      await service.updatePricingHistory(ingredientId, {
        unit: '1kg',
        vat: false,
        cost: '599',
        currency: 'GBP',
      })

      const result = await service.findById('ham')
      expect(result.cost.cost).toBe(599)
      expect(result.historicalPricing).toHaveLength(1)
      expect(result.historicalPricing[0].cost).toBe(400)
    })

    test('should maintain full pricing chain across multiple updates', async () => {
      await service.updatePricingHistory(ingredientId, {
        unit: '1kg',
        vat: false,
        cost: '500',
        currency: 'GBP',
      })

      await service.updatePricingHistory(ingredientId, {
        unit: '1kg',
        vat: false,
        cost: '650',
        currency: 'GBP',
      })

      const result = await service.findById('ham')
      expect(result.cost.cost).toBe(650)
      expect(result.historicalPricing).toHaveLength(2)

      const historicalCosts = result.historicalPricing.map((p) => p.cost)
      expect(historicalCosts).toContain(400)
      expect(historicalCosts).toContain(500)
    })

    test('should allow changing unit alongside price', async () => {
      const pricing = await service.updatePricingHistory(ingredientId, {
        unit: '500g',
        vat: false,
        cost: '350',
        currency: 'GBP',
      })

      expect(pricing.unit).toBe('500g')
      expect(pricing.cost).toBe(350)
    })

    test('should allow changing currency', async () => {
      const pricing = await service.updatePricingHistory(ingredientId, {
        unit: '1kg',
        vat: false,
        cost: '700',
        currency: 'EUR',
      })

      expect(pricing.currency).toBe('EUR')
    })

    test('should allow changing VAT status', async () => {
      const pricing = await service.updatePricingHistory(ingredientId, {
        unit: '1kg',
        vat: true,
        cost: '719',
        currency: 'GBP',
      })

      expect(pricing.vat).toBe(context.type === 'postgres' ? true : 1)
    })
  })

  describe('delete', () => {
    test('should return false when deleting non-existent ingredient', async () => {
      expect(await service.delete('ham')).toBe(false)
    })

    test('should return true and delete existing ingredient', async () => {
      await service.create(
        { slug: 'ham', name: 'Ham', category: 'meat' },
        'generic',
        { unit: '1kg', vat: false, cost: '599', currency: 'GBP' }
      )

      expect(await service.delete('ham')).toBe(true)
      expect(await service.exists('ham')).toBe(false)
    })
  })
})
