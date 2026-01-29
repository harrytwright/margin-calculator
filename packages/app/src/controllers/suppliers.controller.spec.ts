import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'

import { BuilderContext } from '@harrytwright/api/dist/builders/builder'
import { API } from '@harrytwright/api/dist/core'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/sqlite'
import supertest from 'supertest'

import { ConfigService } from '@menubook/core'
import { createDatabase, migrate } from '@menubook/sqlite'
import { EventEmitter } from 'events'
import { cleanup, generateApplet } from '../../jest/testing-suite'
import SupplierServiceImpl from '../services/supplier.service'
import { SuppliersController } from './suppliers.controller'

describe('SuppliersController', () => {
  let applet: BuilderContext
  let request: supertest.Agent

  beforeAll(async () => {
    try {
      const { config } = await import('../config')
      config.load()

      const database = createDatabase()
      await migrate(database, 'up')

      applet = API.register('database', {
        db: database,
        helpers: {
          jsonArrayFrom,
          jsonObjectFrom,
        },
      })
        .register('events', new EventEmitter())
        .register('globalConfig', new ConfigService('./tmp/dir'))
        .create(generateApplet(SuppliersController), config)

      await applet.listen()

      await applet.container
        .get<SupplierServiceImpl>(SupplierServiceImpl)!
        .create('demo-001', { name: 'Demo Supplier' })

      const server = applet?.server?.raw
      request = supertest.agent(server!)
    } catch (err) {
      await cleanup(applet)
      return Promise.reject(err)
    }
  })

  afterAll(async () => {
    await applet.container
      .get<SupplierServiceImpl>(SupplierServiceImpl)
      ?.delete('demo-001')
    await cleanup(applet)
  })

  describe('/api/suppliers', () => {
    describe('GET', () => {
      test('should return a list of suppliers', async () => {
        const response = await request.get('/api/suppliers')

        expect(response.status).toBe(200)
        expect(response.body).toHaveLength(1)
      })
    })

    describe('POST', () => {
      test('should create a supplier and return 201', async () => {
        const response = await request
          .post('/api/suppliers')
          .send({ name: 'New Supplier', slug: 'new-supplier' })

        expect(response.status).toBe(201)
        expect(response.body).toMatchObject({
          name: 'New Supplier',
          slug: 'new-supplier',
        })

        // Cleanup
        await applet.container
          .get<SupplierServiceImpl>(SupplierServiceImpl)
          ?.delete('new-supplier')
      })

      test('should return 409 on duplicate slug', async () => {
        const response = await request
          .post('/api/suppliers')
          .send({ name: 'Demo Supplier', slug: 'demo-001' })

        expect(response.status).toBe(409)
        expect(response.body.error.message).toContain('already exists')
      })
    })
  })

  describe('/api/suppliers/:slug', () => {
    describe('GET', () => {
      test('should return a supplier by slug', async () => {
        const response = await request.get('/api/suppliers/demo-001')

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
          slug: 'demo-001',
          name: 'Demo Supplier',
        })
      })

      test('should return 404 for non-existent supplier', async () => {
        const response = await request.get('/api/suppliers/non-existent')

        expect(response.status).toBe(404)
        expect(response.body.error).toBeDefined()
      })
    })

    describe('PUT', () => {
      test('should update a supplier and return 200', async () => {
        const response = await request
          .put('/api/suppliers/demo-001')
          .send({ name: 'Updated Demo Supplier' })

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
          slug: 'demo-001',
          name: 'Updated Demo Supplier',
        })

        // Reset for other tests
        await applet.container
          .get<SupplierServiceImpl>(SupplierServiceImpl)
          ?.upsert('demo-001', { slug: 'demo-001', name: 'Demo Supplier' })
      })

      test('should return 400 on slug mismatch', async () => {
        const response = await request
          .put('/api/suppliers/demo-001')
          .send({ name: 'Test', slug: 'different-slug' })

        expect(response.status).toBe(400)
        expect(response.body.error.message).toContain('Slug mismatch')
      })

      test('should return 404 for non-existent supplier', async () => {
        const response = await request
          .put('/api/suppliers/non-existent')
          .send({ name: 'Test' })

        expect(response.status).toBe(404)
        expect(response.body.error.message).toContain('not found')
      })
    })

    describe('DELETE', () => {
      test('should delete a supplier and return 204', async () => {
        // Create a supplier to delete
        await applet.container
          .get<SupplierServiceImpl>(SupplierServiceImpl)!
          .create('to-delete', { name: 'To Delete' })

        const response = await request.delete('/api/suppliers/to-delete')

        expect(response.status).toBe(204)

        // Verify deletion
        const exists = await applet.container
          .get<SupplierServiceImpl>(SupplierServiceImpl)
          ?.exists('to-delete')
        expect(exists).toBe(false)
      })

      test('should return 404 for non-existent supplier', async () => {
        const response = await request.delete('/api/suppliers/non-existent')

        expect(response.status).toBe(404)
        expect(response.body.error.message).toContain('not found')
      })
    })
  })
})
