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
import RecipeServiceImpl from '../services/recipe.service'
import SupplierServiceImpl from '../services/supplier.service'
import { RecipesController } from './recipes.controller'

describe('RecipesController', () => {
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
      const recipeService =
        applet.container.get<RecipeServiceImpl>(RecipeServiceImpl)!
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
        expect(response.body.error.message).toContain(
          'costing.price is required'
        )
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
        const recipeService =
          applet.container.get<RecipeServiceImpl>(RecipeServiceImpl)!
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
              {
                slug: 'test-flour',
                type: 'ingredient',
                with: { unit: '500g' },
              },
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
        const recipeService =
          applet.container.get<RecipeServiceImpl>(RecipeServiceImpl)!
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
        const response = await request.get(
          '/api/recipes/non-existent/calculate'
        )

        expect(response.status).toBe(404)
        expect(response.body.error).toBeDefined()
      })
    })
  })

  describe('/api/recipes/:slug/ingredients/:ingredientSlug', () => {
    describe('PUT', () => {
      test('should add an ingredient to a recipe', async () => {
        // Create a test ingredient to add
        await applet.container
          .get<IngredientServiceImpl>(IngredientServiceImpl)!
          .upsert(
            'test-butter',
            {
              slug: 'test-butter',
              name: 'Test Butter',
              category: 'Dairy',
              purchase: { cost: 200, unit: '250g', vat: false },
            },
            'test-supplier'
          )

        const response = await request
          .put('/api/recipes/test-bread/ingredients/test-butter')
          .send({
            quantity: 50,
            unit: 'g',
          })

        expect(response.status).toBe(200)
        expect(response.body.ingredients).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ slug: 'test-butter', unit: '50g' }),
          ])
        )

        // Cleanup - remove the added ingredient
        await request.delete('/api/recipes/test-bread/ingredients/test-butter')
        await applet.container
          .get<IngredientServiceImpl>(IngredientServiceImpl)
          ?.delete('test-butter')
      })

      test('should update an existing ingredient quantity', async () => {
        const response = await request
          .put('/api/recipes/test-bread/ingredients/test-flour')
          .send({
            quantity: 750,
            unit: 'g',
          })

        expect(response.status).toBe(200)
        expect(response.body.ingredients).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ slug: 'test-flour', unit: '750g' }),
          ])
        )

        // Reset to original
        await request
          .put('/api/recipes/test-bread/ingredients/test-flour')
          .send({
            quantity: 500,
            unit: 'g',
          })
      })

      test('should return 400 when unit is missing', async () => {
        const response = await request
          .put('/api/recipes/test-bread/ingredients/test-flour')
          .send({
            quantity: 100,
          })

        expect(response.status).toBe(400)
        expect(response.body.error.message).toContain('unit is required')
      })

      test('should return 404 for non-existent recipe', async () => {
        const response = await request
          .put('/api/recipes/non-existent/ingredients/test-flour')
          .send({
            quantity: 100,
            unit: 'g',
          })

        expect(response.status).toBe(404)
        expect(response.body.error).toBeDefined()
      })

      test('should return 404 for non-existent ingredient', async () => {
        const response = await request
          .put('/api/recipes/test-bread/ingredients/non-existent')
          .send({
            quantity: 100,
            unit: 'g',
          })

        expect(response.status).toBe(404)
        expect(response.body.error).toBeDefined()
      })
    })

    describe('DELETE', () => {
      test('should remove an ingredient from a recipe', async () => {
        // First add an ingredient to remove
        await applet.container
          .get<IngredientServiceImpl>(IngredientServiceImpl)!
          .upsert(
            'test-salt',
            {
              slug: 'test-salt',
              name: 'Test Salt',
              category: 'Seasoning',
              purchase: { cost: 50, unit: '500g', vat: false },
            },
            'test-supplier'
          )

        await request
          .put('/api/recipes/test-bread/ingredients/test-salt')
          .send({ quantity: 5, unit: 'g' })

        const response = await request.delete(
          '/api/recipes/test-bread/ingredients/test-salt'
        )

        expect(response.status).toBe(200)
        expect(response.body.ingredients).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({ slug: 'test-salt' }),
          ])
        )

        // Cleanup
        await applet.container
          .get<IngredientServiceImpl>(IngredientServiceImpl)
          ?.delete('test-salt')
      })

      test('should return 404 for non-existent recipe', async () => {
        const response = await request.delete(
          '/api/recipes/non-existent/ingredients/test-flour'
        )

        expect(response.status).toBe(404)
        expect(response.body.error).toBeDefined()
      })

      test('should return 404 when ingredient not in recipe', async () => {
        // Create an ingredient that's not in the recipe
        await applet.container
          .get<IngredientServiceImpl>(IngredientServiceImpl)!
          .upsert(
            'test-sugar',
            {
              slug: 'test-sugar',
              name: 'Test Sugar',
              category: 'Dry Goods',
              purchase: { cost: 100, unit: '1kg', vat: false },
            },
            'test-supplier'
          )

        const response = await request.delete(
          '/api/recipes/test-bread/ingredients/test-sugar'
        )

        expect(response.status).toBe(404)
        expect(response.body.error).toBeDefined()

        // Cleanup
        await applet.container
          .get<IngredientServiceImpl>(IngredientServiceImpl)
          ?.delete('test-sugar')
      })
    })
  })
})
