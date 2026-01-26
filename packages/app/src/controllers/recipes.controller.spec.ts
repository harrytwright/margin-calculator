import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'

import { BuilderContext } from '@harrytwright/api/dist/builders/builder'
import { API } from '@harrytwright/api/dist/core'
import supertest from 'supertest'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/sqlite'

import { cleanup, generateApplet } from '../../jest/testing-suite'
import { RecipesController } from './recipes.controller'
import { createDatabase, migrate } from '@menubook/sqlite'
import { EventEmitter } from 'events'
import { ConfigService } from '@menubook/core'
import SupplierServiceImpl from '../services/supplier.service'
import IngredientServiceImpl from '../services/ingredient.service'
import RecipeServiceImpl from '../services/recipe.service'

describe('RecipesController', () => {
  let applet: BuilderContext
  let request: supertest.Agent

  beforeAll(async () => {
    try {
      const { config } = await import('../config')
      config.load()

      const database = createDatabase()
      await migrate(database, 'up')

      applet = API
        .register('database', {
          db: database,
          helpers: {
            jsonArrayFrom,
            jsonObjectFrom,
          },
        })
        .register('events', new EventEmitter())
        .register('globalConfig', new ConfigService('./tmp/dir'))
        .create(generateApplet(RecipesController), config)

      await applet.listen()

      // Create test supplier
      await applet.container
        .get<SupplierServiceImpl>(SupplierServiceImpl)!
        .create('test-supplier', { name: 'Test Supplier' })

      // Create test ingredient
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

      // Create test recipe
      const recipeService = applet.container.get<RecipeServiceImpl>(
        RecipeServiceImpl
      )!
      const recipeId = await recipeService.upsert('test-bread', {
        slug: 'test-bread',
        name: 'Test Bread',
        stage: 'development',
        class: 'menu_item',
        costing: { price: 500, margin: 30, vat: true },
        ingredients: [
          { slug: 'test-flour', type: 'ingredient', with: { unit: '500g' } },
        ],
      })
      if (recipeId) {
        await recipeService.upsertIngredients(recipeId, {
          slug: 'test-bread',
          name: 'Test Bread',
          stage: 'development',
          class: 'menu_item',
          costing: { price: 500, margin: 30, vat: true },
          ingredients: [
            { slug: 'test-flour', type: 'ingredient', with: { unit: '500g' } },
          ],
        })
      }

      const server = applet?.server?.raw
      request = supertest.agent(server!)
    } catch (err) {
      await cleanup(applet)
      return Promise.reject(err)
    }
  })

  afterAll(async () => {
    await applet.container
      .get<RecipeServiceImpl>(RecipeServiceImpl)
      ?.delete('test-bread')
    await applet.container
      .get<IngredientServiceImpl>(IngredientServiceImpl)
      ?.delete('test-flour')
    await applet.container
      .get<SupplierServiceImpl>(SupplierServiceImpl)
      ?.delete('test-supplier')
    await cleanup(applet)
  })

  describe('/api/recipes', () => {
    describe('GET', () => {
      test('should return a list of recipes', async () => {
        const response = await request.get('/api/recipes')

        expect(response.status).toBe(200)
        expect(response.body).toHaveLength(1)
        expect(response.body[0]).toMatchObject({
          name: 'Test Bread',
        })
      })
    })

    describe('POST', () => {
      test('should create a recipe with costing.price and return 201', async () => {
        const response = await request.post('/api/recipes').send({
          name: 'New Recipe',
          slug: 'new-recipe',
          stage: 'development',
          class: 'menu_item',
          costing: { price: 800, margin: 25, vat: true },
          ingredients: [{ slug: 'test-flour', unit: '200g' }],
        })

        expect(response.status).toBe(201)
        expect(response.body).toMatchObject({
          name: 'New Recipe',
          stage: 'development',
          class: 'menu_item',
        })

        // Cleanup
        await applet.container
          .get<RecipeServiceImpl>(RecipeServiceImpl)
          ?.delete('new-recipe')
      })

      test('should return 409 on duplicate slug', async () => {
        const response = await request.post('/api/recipes').send({
          name: 'Test Bread',
          slug: 'test-bread',
          stage: 'development',
          class: 'menu_item',
          costing: { price: 500, margin: 30, vat: true },
          ingredients: [],
        })

        expect(response.status).toBe(409)
        expect(response.body.error.message).toContain('already exists')
      })

      test('should return 400 when missing costing.price and no parent', async () => {
        const response = await request.post('/api/recipes').send({
          name: 'Missing Price Recipe',
          slug: 'missing-price-recipe',
          stage: 'development',
          class: 'menu_item',
          ingredients: [],
        })

        expect(response.status).toBe(400)
        expect(response.body.error.message).toContain('costing.price is required')
      })

      test('should return 404 for non-existent parent recipe', async () => {
        const response = await request.post('/api/recipes').send({
          name: 'Child Recipe',
          slug: 'child-recipe',
          stage: 'development',
          class: 'menu_item',
          extends: 'non-existent-parent',
          ingredients: [],
        })

        expect(response.status).toBe(404)
        expect(response.body.error).toBeDefined()
      })

      test('should return 404 for non-existent ingredient', async () => {
        const response = await request.post('/api/recipes').send({
          name: 'Recipe with Missing Ingredient',
          slug: 'recipe-missing-ingredient',
          stage: 'development',
          class: 'menu_item',
          costing: { price: 500, margin: 30, vat: true },
          ingredients: [{ slug: 'non-existent-ingredient', unit: '100g' }],
        })

        expect(response.status).toBe(404)
        expect(response.body.error).toBeDefined()
      })
    })
  })

  describe('/api/recipes/:slug', () => {
    describe('GET', () => {
      test('should return a recipe by slug with ingredients', async () => {
        const response = await request.get('/api/recipes/test-bread')

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
          name: 'Test Bread',
        })
        expect(response.body.ingredients).toBeDefined()
      })

      test('should return 404 for non-existent recipe', async () => {
        const response = await request.get('/api/recipes/non-existent')

        expect(response.status).toBe(404)
        expect(response.body.error).toBeDefined()
      })
    })

    describe('PUT', () => {
      test('should update a recipe and return 200', async () => {
        const response = await request.put('/api/recipes/test-bread').send({
          name: 'Updated Test Bread',
          stage: 'active',
          class: 'menu_item',
          costing: { price: 600, margin: 35, vat: true },
          ingredients: [{ slug: 'test-flour', unit: '600g' }],
        })

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
          name: 'Updated Test Bread',
          stage: 'active',
        })

        // Reset for other tests
        const recipeService = applet.container.get<RecipeServiceImpl>(
          RecipeServiceImpl
        )!
        const recipeId = await recipeService.upsert('test-bread', {
          slug: 'test-bread',
          name: 'Test Bread',
          stage: 'development',
          class: 'menu_item',
          costing: { price: 500, margin: 30, vat: true },
          ingredients: [
            { slug: 'test-flour', type: 'ingredient', with: { unit: '500g' } },
          ],
        })
        if (recipeId) {
          await recipeService.upsertIngredients(recipeId, {
            slug: 'test-bread',
            name: 'Test Bread',
            stage: 'development',
            class: 'menu_item',
            costing: { price: 500, margin: 30, vat: true },
            ingredients: [
              { slug: 'test-flour', type: 'ingredient', with: { unit: '500g' } },
            ],
          })
        }
      })

      test('should return 400 on slug mismatch', async () => {
        const response = await request.put('/api/recipes/test-bread').send({
          name: 'Test',
          slug: 'different-slug',
          stage: 'development',
          class: 'menu_item',
          costing: { price: 500 },
          ingredients: [],
        })

        expect(response.status).toBe(400)
        expect(response.body.error.message).toContain('Slug mismatch')
      })

      test('should return 404 for non-existent recipe', async () => {
        const response = await request.put('/api/recipes/non-existent').send({
          name: 'Test',
          stage: 'development',
          class: 'menu_item',
          costing: { price: 500 },
          ingredients: [],
        })

        expect(response.status).toBe(404)
        expect(response.body.error).toBeDefined()
      })
    })

    describe('DELETE', () => {
      test('should delete a recipe and return 204', async () => {
        // Create a recipe to delete
        const recipeService = applet.container.get<RecipeServiceImpl>(
          RecipeServiceImpl
        )!
        await recipeService.upsert('to-delete', {
          slug: 'to-delete',
          name: 'To Delete',
          stage: 'development',
          class: 'menu_item',
          costing: { price: 300 },
          ingredients: [],
        })

        const response = await request.delete('/api/recipes/to-delete')

        expect(response.status).toBe(204)

        // Verify deletion
        const exists = await recipeService.exists('to-delete')
        expect(exists).toBe(false)
      })

      test('should return 404 for non-existent recipe', async () => {
        const response = await request.delete('/api/recipes/non-existent')

        expect(response.status).toBe(404)
        expect(response.body.error).toBeDefined()
      })
    })
  })

  describe('/api/recipes/:slug/calculate', () => {
    describe('GET', () => {
      test('should calculate cost and margin', async () => {
        const response = await request.get('/api/recipes/test-bread/calculate')

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
          recipe: 'test-bread',
        })
        // The response should contain cost/margin calculation fields
        expect(response.body).toHaveProperty('cost')
      })

      test('should return 404 for non-existent recipe', async () => {
        const response = await request.get('/api/recipes/non-existent/calculate')

        expect(response.status).toBe(404)
        expect(response.body.error).toBeDefined()
      })
    })
  })
})
