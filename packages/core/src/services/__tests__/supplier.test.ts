import type { DatabaseContext } from '@menubook/shared'

import { SupplierService } from '../supplier'
import { createTestContext } from './helpers/test-adapter'

describe('SupplierService', () => {
  let context: DatabaseContext
  let service: SupplierService

  beforeEach(async () => {
    context = await createTestContext()
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

    test('should return true for existing supplier by slug', async () => {
      await context.db
        .insertInto('Supplier')
        .values({ slug: 'asda', name: 'Asda' })
        .execute()

      expect(await service.exists('asda')).toBe(true)
    })

    test('should return true for existing supplier by id', async () => {
      const result = await context.db
        .insertInto('Supplier')
        .values({ slug: 'asda', name: 'Asda' })
        .returning('id')
        .executeTakeFirstOrThrow()

      expect(await service.exists(result.id)).toBe(true)
    })
  })

  describe('find', () => {
    test('should return empty array when no suppliers exist', async () => {
      const result = await service.find()
      expect(result).toEqual([])
    })

    test('should return all suppliers', async () => {
      await context.db
        .insertInto('Supplier')
        .values([
          { slug: 'asda', name: 'Asda' },
          { slug: 'tesco', name: 'Tesco' },
        ])
        .execute()

      const result = await service.find()
      expect(result).toHaveLength(2)
    })

    test('should include contact when allowJoins is true', async () => {
      const supplier = await context.db
        .insertInto('Supplier')
        .values({ slug: 'asda', name: 'Asda' })
        .returning('id')
        .executeTakeFirstOrThrow()

      await context.db
        .insertInto('SupplierContact')
        .values({
          supplierId: supplier.id,
          name: 'John Smith',
          email: 'john@asda.com',
          phone: '01onal',
        })
        .execute()

      const result = await service.find({ allowJoins: true })
      expect(result).toHaveLength(1)
      expect(result[0].contact).toMatchObject({
        name: 'John Smith',
        email: 'john@asda.com',
      })
    })

    test('should exclude contact when allowJoins is false', async () => {
      await context.db
        .insertInto('Supplier')
        .values({ slug: 'asda', name: 'Asda' })
        .execute()

      const result = await service.find({ allowJoins: false })
      expect(result).toHaveLength(1)
      expect(result[0]).not.toHaveProperty('contact')
    })
  })

  describe('findById', () => {
    test('should throw for non-existent supplier', async () => {
      await expect(service.findById('asda')).rejects.toThrow()
    })

    test('should return supplier with contact by slug', async () => {
      const supplier = await context.db
        .insertInto('Supplier')
        .values({ slug: 'asda', name: 'Asda Supermarket' })
        .returning('id')
        .executeTakeFirstOrThrow()

      await context.db
        .insertInto('SupplierContact')
        .values({
          supplierId: supplier.id,
          name: 'John Smith',
          email: 'john@asda.com',
        })
        .execute()

      const result = await service.findById('asda')
      expect(result).toMatchObject({
        slug: 'asda',
        name: 'Asda Supermarket',
        contact: {
          name: 'John Smith',
          email: 'john@asda.com',
        },
      })
    })

    test('should return supplier by numeric id', async () => {
      const supplier = await context.db
        .insertInto('Supplier')
        .values({ slug: 'asda', name: 'Asda' })
        .returning('id')
        .executeTakeFirstOrThrow()

      const result = await service.findById(supplier.id)
      expect(result.slug).toBe('asda')
    })

    test('should return null contact when no contact exists', async () => {
      await context.db
        .insertInto('Supplier')
        .values({ slug: 'asda', name: 'Asda' })
        .execute()

      const result = await service.findById('asda')
      expect(result.contact).toBeNull()
    })
  })

  describe('create', () => {
    test('should create supplier without contact', async () => {
      const result = await service.create({ slug: 'asda', name: 'Asda' })

      expect(result).toMatchObject({
        slug: 'asda',
        name: 'Asda',
        contact: null,
      })
    })

    test('should create supplier with contact', async () => {
      const result = await service.create({
        slug: 'asda',
        name: 'Asda',
        contact: {
          name: 'John Smith',
          email: 'john@asda.com',
          phone: '01onal',
        },
      })

      expect(result).toMatchObject({
        slug: 'asda',
        name: 'Asda',
        contact: {
          name: 'John Smith',
          email: 'john@asda.com',
        },
      })
    })

    test('should throw on duplicate slug', async () => {
      await service.create({ slug: 'asda', name: 'Asda' })

      await expect(
        service.create({ slug: 'asda', name: 'Asda Again' })
      ).rejects.toThrow(/already exists/)
    })

    test('should return the created supplier via findById', async () => {
      await service.create({
        slug: 'tesco',
        name: 'Tesco',
        contact: { name: 'Jane Doe' },
      })

      const found = await service.findById('tesco')
      expect(found.name).toBe('Tesco')
      expect(found.contact?.name).toBe('Jane Doe')
    })
  })

  describe('update', () => {
    let slug: string

    beforeAll(async () => {
      slug = 'asda'
    })

    afterEach(async () => {
      await (slug && service.delete(slug))
    })

    test('should update supplier name', async () => {
      await service.create({ slug, name: 'Asda Old' })

      const result = await service.update('asda', { name: 'Asda New' })
      expect(result.name).toBe('Asda New')
    })

    test('should throw when attempting to change slug', async () => {
      await service.create({ slug, name: 'Asda' })

      await expect(
        service.update('asda', { slug: 'asda-new' })
      ).rejects.toThrow(/Cannot change slug/)
    })

    test('should create contact when supplier has none', async () => {
      await service.create({ slug, name: 'Asda' })

      const result = await service.update('asda', {
        contact: { name: 'New Contact', email: 'new@asda.com' },
      })

      expect(result.contact).toMatchObject({
        name: 'New Contact',
        email: 'new@asda.com',
      })
    })

    test('should update existing contact details', async () => {
      await service.create({
        slug,
        name: 'Asda',
        contact: { name: 'Old Contact', email: 'old@asda.com' },
      })

      const result = await service.update('asda', {
        contact: { name: 'New Contact', email: 'new@asda.com' },
      })

      expect(result.contact).toMatchObject({
        name: 'New Contact',
        email: 'new@asda.com',
      })
    })

    test('should not update contact when contact data unchanged', async () => {
      await service.create({
        slug,
        name: 'Asda',
        contact: { name: 'John', email: 'john@asda.com', phone: '0100' },
      })

      // Same contact data, different supplier name
      const result = await service.update('asda', {
        name: 'Asda Updated',
        contact: { name: 'John', email: 'john@asda.com', phone: '0100' },
      })

      expect(result.name).toBe('Asda Updated')
      expect(result.contact?.name).toBe('John')
    })

    test('should accept numeric id', async () => {
      const created = await service.create({ slug, name: 'Asda' })

      const result = await service.update(created.id, { name: 'Asda Updated' })
      expect(result.name).toBe('Asda Updated')
    })

    test('should restrict changes in CLI mode', async () => {
      // @ts-ignore - setting global CLI flag
      globalThis[Symbol.for('isCLI')] = true

      await service.create({ slug, name: 'Asda' })

      await expect(
        service.update('asda', { name: 'Asda Changed' })
      ).rejects.toThrow(/CLI cannot make changes/)

      // @ts-ignore - reset
      globalThis[Symbol.for('isCLI')] = false
    })
  })

  describe('upsert', () => {
    let slug: string

    beforeEach(async () => {
      slug = 'asda'
    })

    afterEach(async () => {
      await (slug && service.delete(slug))
    })

    test('should create new supplier', async () => {
      slug = 'tesco'
      await service.upsert(slug, { name: 'Tesco', slug })

      const supplier = await service.findById('tesco')
      expect(supplier.name).toBe('Tesco')
    })

    test('should update existing supplier on conflict', async () => {
      await service.upsert(slug, { name: 'Asda First', slug })
      await service.upsert(slug, { name: 'Asda Second', slug })

      const suppliers = await context.db
        .selectFrom('Supplier')
        .selectAll()
        .where('slug', '=', 'asda')
        .execute()

      expect(suppliers).toHaveLength(1)
      expect(suppliers[0].name).toBe('Asda Second')
    })

    test('should upsert contact alongside supplier', async () => {
      await service.upsert(slug, {
        slug,
        name: 'Asda',
        contact: { name: 'John' },
      })

      const result = await service.findById('asda')
      expect(result.contact?.name).toBe('John')

      // Upsert again with updated contact
      await service.upsert(slug, {
        slug,
        name: 'Asda',
        contact: { name: 'Jane' },
      })

      const updated = await service.findById('asda')
      expect(updated.contact?.name).toBe('Jane')
    })
  })

  describe('delete', () => {
    test('should return false when deleting non-existent supplier', async () => {
      expect(await service.delete('asda')).toBe(false)
    })

    test('should return true and delete existing supplier', async () => {
      await service.create({ slug: 'asda', name: 'Asda' })

      expect(await service.delete('asda')).toBe(true)
      expect(await service.exists('asda')).toBe(false)
    })

    test('should only delete specified supplier', async () => {
      await service.create({ slug: 'asda', name: 'Asda' })
      await service.create({ slug: 'tesco', name: 'Tesco' })

      await service.delete('asda')

      expect(await service.exists('asda')).toBe(false)
      expect(await service.exists('tesco')).toBe(true)
    })
  })
})
