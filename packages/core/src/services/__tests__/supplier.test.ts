import {
  createDatabase,
  jsonArrayFrom,
  jsonObjectFrom,
  migrate,
} from '@menubook/sqlite'

import type { DatabaseContext } from '../../datastore/context'
import { Importer } from '../../lib/importer'
import { SupplierResolvedImportData } from '../../schema'
import { SupplierService } from '../supplier'

describe('SupplierService', () => {
  let context: DatabaseContext
  let service: SupplierService

  beforeEach(async () => {
    const db = createDatabase(':memory:')
    await migrate(db)

    context = {
      db,
      helpers: { jsonArrayFrom, jsonObjectFrom },
    }

    service = new SupplierService(context)
  })

  afterEach(async () => {
    await context.db.destroy()
  })

  describe('exists', () => {
    test('should return false for non-existent supplier', async () => {
      const exists = await service.exists('asda')
      expect(exists).toBe(false)
    })

    test('should return true for existing supplier', async () => {
      await context.db
        .insertInto('Supplier')
        .values({ slug: 'asda', name: 'Asda' })
        .execute()

      const exists = await service.exists('asda')
      expect(exists).toBe(true)
    })
  })

  describe('findById', () => {
    test('should throw for for non-existent supplier', async () => {
      await expect(service.findById('asda')).rejects.toThrow()
    })

    test('should return supplier data for existing supplier', async () => {
      await context.db
        .insertInto('Supplier')
        .values({ slug: 'asda', name: 'Asda Supermarket' })
        .execute()

      const result = await service.findById('asda')
      expect(result).toMatchObject({
        id: expect.any(Number),
        name: 'Asda Supermarket',
      })
    })
  })

  describe('upsert', () => {
    test('should create new supplier', async () => {
      await service.upsert('tesco', { name: 'Tesco' })

      const supplier = await context.db
        .selectFrom('Supplier')
        .selectAll()
        .where('slug', '=', 'tesco')
        .executeTakeFirst()

      expect(supplier).toMatchObject({
        slug: 'tesco',
        name: 'Tesco',
      })
    })

    test('should update existing supplier', async () => {
      await context.db
        .insertInto('Supplier')
        .values({ slug: 'asda', name: 'Asda Old' })
        .execute()

      await service.upsert('asda', { name: 'Asda New' })

      const supplier = await context.db
        .selectFrom('Supplier')
        .selectAll()
        .where('slug', '=', 'asda')
        .executeTakeFirst()

      expect(supplier?.name).toBe('Asda New')
    })

    test('should not create duplicates on conflict', async () => {
      await service.upsert('asda', { name: 'Asda First' })
      await service.upsert('asda', { name: 'Asda Second' })

      const suppliers = await context.db
        .selectFrom('Supplier')
        .selectAll()
        .where('slug', '=', 'asda')
        .execute()

      expect(suppliers).toHaveLength(1)
      expect(suppliers[0].name).toBe('Asda Second')
    })
  })

  describe('delete', () => {
    test('should return false when deleting non-existent supplier', async () => {
      const deleted = await service.delete('asda')
      expect(deleted).toBe(false)
    })

    test('should return true and delete existing supplier', async () => {
      await context.db
        .insertInto('Supplier')
        .values({ slug: 'asda', name: 'Asda' })
        .execute()

      const deleted = await service.delete('asda')
      expect(deleted).toBe(true)

      const exists = await service.exists('asda')
      expect(exists).toBe(false)
    })

    test('should only delete specified supplier', async () => {
      await context.db
        .insertInto('Supplier')
        .values({ slug: 'asda', name: 'Asda' })
        .execute()
      await context.db
        .insertInto('Supplier')
        .values({ slug: 'tesco', name: 'Tesco' })
        .execute()

      await service.delete('asda')

      const asda = await service.exists('asda')
      const tesco = await service.exists('tesco')

      expect(asda).toBe(false)
      expect(tesco).toBe(true)
    })
  })

  describe('processor', () => {
    let importer: Importer

    beforeEach(() => {
      importer = new Importer(context)
    })

    test('should return "created" for new supplier', async () => {
      const data: SupplierResolvedImportData = {
        slug: 'asda',
        name: 'Asda',
      }

      const result = await service.processor(importer, data, undefined)
      expect(result).toBe('created')

      const supplier = await service.findById('asda')
      expect(supplier?.name).toBe('Asda')
    })

    test('should return "upserted" for updated supplier', async () => {
      await context.db
        .insertInto('Supplier')
        .values({ slug: 'asda', name: 'Asda Old' })
        .execute()

      const data: SupplierResolvedImportData = {
        slug: 'asda',
        name: 'Asda New',
      }

      const result = await service.processor(importer, data, undefined)
      expect(result).toBe('upserted')

      const supplier = await service.findById('asda')
      expect(supplier?.name).toBe('Asda New')
    })

    test('should return "ignored" when no changes detected', async () => {
      await context.db
        .insertInto('Supplier')
        .values({ slug: 'asda', name: 'Asda' })
        .execute()

      const data: SupplierResolvedImportData = {
        slug: 'asda',
        name: 'Asda',
      }

      const result = await service.processor(importer, data, undefined)
      expect(result).toBe('ignored')
    })

    test('should detect changes and upsert', async () => {
      await context.db
        .insertInto('Supplier')
        .values({ slug: 'tesco', name: 'Tesco' })
        .execute()

      const data: SupplierResolvedImportData = {
        slug: 'tesco',
        name: 'Tesco PLC',
      }

      const result = await service.processor(importer, data, undefined)
      expect(result).toBe('upserted')
    })
  })
})
