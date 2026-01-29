import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'

import { BuilderContext } from '@harrytwright/api/dist/builders/builder'
import { API } from '@harrytwright/api/dist/core'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/sqlite'
import supertest from 'supertest'

import { ConfigService } from '@menubook/core'
import { createDatabase, migrate } from '@menubook/sqlite'
import { EventEmitter } from 'events'
import { cleanup, generateApplet } from '../../jest/testing-suite'
import IngredientServiceImpl from '../services/ingredient.service'
import SupplierServiceImpl from '../services/supplier.service'
import { IngredientsController } from './ingredients.controller'

describe('IngredientsController', () => {
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
        .create(generateApplet(IngredientsController), config)

      await applet.listen()

      // Create a test supplier (ingredients reference suppliers)
      await applet.container
        .get<SupplierServiceImpl>(SupplierServiceImpl)!
        .create('test-supplier', { name: 'Test Supplier' })

      // Create a test ingredient
      await applet.container
        .get<IngredientServiceImpl>(IngredientServiceImpl)!
        .upsert(
          'test-flour',
          {
            slug: 'test-flour',
            name: 'Test Flour',
            category: 'Dry Goods',
            purchase: { cost: 150, unit: '1kg', vat: false },
          },
          'test-supplier'
        )

      const server = applet?.server?.raw
      request = supertest.agent(server!)
    } catch (err) {
      await cleanup(applet)
      return Promise.reject(err)
    }
  })

  afterAll(async () => {
    await applet.container
      .get<IngredientServiceImpl>(IngredientServiceImpl)
      ?.delete('test-flour')
    await applet.container
      .get<SupplierServiceImpl>(SupplierServiceImpl)
      ?.delete('test-supplier')
    await cleanup(applet)
  })

  describe('/api/ingredients', () => {
    describe('GET', () => {
      test('should return a list of ingredients', async () => {
        const response = await request.get('/api/ingredients')

        expect(response.status).toBe(200)
        expect(response.body).toHaveLength(1)
        expect(response.body[0]).toMatchObject({
          name: 'Test Flour',
        })
      })
    })

    describe('POST', () => {
      test('should create an ingredient and return 201', async () => {
        const response = await request.post('/api/ingredients').send({
          name: 'New Sugar',
          slug: 'new-sugar',
          category: 'Dry Goods',
          purchase: { cost: 200, unit: '1kg', vat: false },
          supplier: 'test-supplier',
        })

        expect(response.status).toBe(201)
        expect(response.body).toMatchObject({
          name: 'New Sugar',
          category: 'Dry Goods',
        })

        // Cleanup
        await applet.container
          .get<IngredientServiceImpl>(IngredientServiceImpl)
          ?.delete('new-sugar')
      })

      test('should return 409 on duplicate slug', async () => {
        const response = await request.post('/api/ingredients').send({
          name: 'Test Flour',
          slug: 'test-flour',
          category: 'Dry Goods',
          purchase: { cost: 150, unit: '1kg', vat: false },
        })

        expect(response.status).toBe(409)
        expect(response.body.error.message).toContain('already exists')
      })

      test('should return 404 for non-existent supplier', async () => {
        const response = await request.post('/api/ingredients').send({
          name: 'Test Ingredient',
          slug: 'test-ingredient',
          category: 'Dry Goods',
          purchase: { cost: 100, unit: '1kg', vat: false },
          supplier: 'non-existent-supplier',
        })

        expect(response.status).toBe(404)
        expect(response.body.error.message).toContain('Supplier')
        expect(response.body.error.message).toContain('not found')
      })
    })
  })

  describe('/api/ingredients/:slug', () => {
    describe('GET', () => {
      test('should return an ingredient by slug', async () => {
        const response = await request.get('/api/ingredients/test-flour')

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
          name: 'Test Flour',
          category: 'Dry Goods',
        })
      })

      test('should return 404 for non-existent ingredient', async () => {
        const response = await request.get('/api/ingredients/non-existent')

        expect(response.status).toBe(404)
        expect(response.body.error).toBeDefined()
      })
    })

    describe('PUT', () => {
      test('should update an ingredient and return 200', async () => {
        const response = await request.put('/api/ingredients/test-flour').send({
          name: 'Updated Test Flour',
          category: 'Dry Goods',
          purchase: { cost: 175, unit: '1kg', vat: false },
        })

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
          name: 'Updated Test Flour',
        })

        // Reset for other tests
        await applet.container
          .get<IngredientServiceImpl>(IngredientServiceImpl)!
          .upsert(
            'test-flour',
            {
              slug: 'test-flour',
              name: 'Test Flour',
              category: 'Dry Goods',
              purchase: { cost: 150, unit: '1kg', vat: false },
            },
            'test-supplier'
          )
      })

      test('should return 400 on slug mismatch', async () => {
        const response = await request.put('/api/ingredients/test-flour').send({
          name: 'Test',
          slug: 'different-slug',
          category: 'Dry Goods',
          purchase: { cost: 150, unit: '1kg', vat: false },
        })

        expect(response.status).toBe(400)
        expect(response.body.error.message).toContain('Slug mismatch')
      })

      test('should return 404 for non-existent ingredient', async () => {
        const response = await request
          .put('/api/ingredients/non-existent')
          .send({
            name: 'Test',
            category: 'Dry Goods',
            purchase: { cost: 100, unit: '1kg', vat: false },
          })

        expect(response.status).toBe(404)
        expect(response.body.error).toBeDefined()
      })
    })

    describe('DELETE', () => {
      test('should delete an ingredient and return 204', async () => {
        // Create an ingredient to delete
        await applet.container
          .get<IngredientServiceImpl>(IngredientServiceImpl)!
          .upsert(
            'to-delete',
            {
              slug: 'to-delete',
              name: 'To Delete',
              category: 'Test',
              purchase: { cost: 100, unit: '1kg', vat: false },
            },
            'test-supplier'
          )

        const response = await request.delete('/api/ingredients/to-delete')

        expect(response.status).toBe(204)

        // Verify deletion
        const exists = await applet.container
          .get<IngredientServiceImpl>(IngredientServiceImpl)
          ?.exists('to-delete')
        expect(exists).toBe(false)
      })

      test('should return 404 for non-existent ingredient', async () => {
        const response = await request.delete('/api/ingredients/non-existent')

        expect(response.status).toBe(404)
        expect(response.body.error).toBeDefined()
      })
    })
  })
})
