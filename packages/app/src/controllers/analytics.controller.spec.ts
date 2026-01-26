import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'

import { BuilderContext } from '@harrytwright/api/dist/builders/builder'
import { API } from '@harrytwright/api/dist/core'
import supertest from 'supertest'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/sqlite'
import type { Kysely } from 'kysely'

import { cleanup, generateApplet } from '../../jest/testing-suite'
import { AnalyticsController } from './analytics.controller'
import { createDatabase, migrate } from '@menubook/sqlite'
import { EventEmitter } from 'events'
import { ConfigService, type DatabaseContext, type DB } from '@menubook/core'

describe('AnalyticsController', () => {
  let applet: BuilderContext
  let request: supertest.Agent
  let db: Kysely<DB>

  beforeAll(async () => {
    try {
      const { config } = await import('../config')
      config.load()

      const database = createDatabase()
      await migrate(database, 'up')

      const dbContext: DatabaseContext = {
        db: database,
        helpers: {
          jsonArrayFrom,
          jsonObjectFrom,
        },
      }

      db = database

      applet = API
        .register('database', dbContext)
        .register('events', new EventEmitter())
        .register('globalConfig', new ConfigService('./tmp/dir'))
        .create(generateApplet(AnalyticsController), config)

      await applet.listen()

      // Insert test recipes directly into the database
      await db
        .insertInto('Recipe')
        .values([
          {
            slug: 'active-main',
            name: 'Active Main',
            stage: 'active',
            class: 'menu_item',
            category: 'Mains',
            sellPrice: 800,
            targetMargin: 30,
            includesVat: 1,
          },
          {
            slug: 'active-dessert',
            name: 'Active Dessert',
            stage: 'active',
            class: 'menu_item',
            category: 'Desserts',
            sellPrice: 500,
            targetMargin: 25,
            includesVat: 1,
          },
          {
            slug: 'dev-recipe',
            name: 'Development Recipe',
            stage: 'development',
            class: 'sub_recipe',
            category: 'Bases',
            sellPrice: 300,
            targetMargin: 20,
            includesVat: 0,
          },
          {
            slug: 'discontinued-recipe',
            name: 'Discontinued Recipe',
            stage: 'discontinued',
            class: 'menu_item',
            category: 'Mains',
            sellPrice: 600,
            targetMargin: 35,
            includesVat: 1,
          },
        ])
        .execute()

      const server = applet?.server?.raw
      request = supertest.agent(server!)
    } catch (err) {
      await cleanup(applet)
      return Promise.reject(err)
    }
  })

  afterAll(async () => {
    // Cleanup recipes
    await db
      .deleteFrom('Recipe')
      .where('slug', 'in', [
        'active-main',
        'active-dessert',
        'dev-recipe',
        'discontinued-recipe',
      ])
      .execute()
    await cleanup(applet)
  })

  describe('/api/analytics', () => {
    describe('GET', () => {
      test('should return all recipes when no filter', async () => {
        const response = await request.get('/api/analytics')

        expect(response.status).toBe(200)
        expect(response.body.data).toHaveLength(4)
        expect(response.body.meta.total).toBe(4)
      })

      test('should filter with equals operator (stage==active)', async () => {
        const response = await request.get(
          '/api/analytics?filter=stage==active'
        )

        expect(response.status).toBe(200)
        expect(response.body.data).toHaveLength(2)
        expect(
          response.body.data.every(
            (r: { stage: string }) => r.stage === 'active'
          )
        ).toBe(true)
        expect(response.body.meta.filter).toBe('stage==active')
      })

      test('should filter with greater than operator (targetMargin>25)', async () => {
        const response = await request.get(
          '/api/analytics?filter=targetMargin>25'
        )

        expect(response.status).toBe(200)
        // Should return recipes with margin > 25 (30 and 35)
        expect(response.body.data.length).toBeGreaterThanOrEqual(2)
        expect(
          response.body.data.every(
            (r: { targetMargin: number }) => r.targetMargin > 25
          )
        ).toBe(true)
      })

      test('should filter with in list operator (class=in=(menu_item,sub_recipe))', async () => {
        const response = await request.get(
          '/api/analytics?filter=class=in=(menu_item,sub_recipe)'
        )

        expect(response.status).toBe(200)
        expect(response.body.data).toHaveLength(4)
        expect(
          response.body.data.every((r: { class: string }) =>
            ['menu_item', 'sub_recipe'].includes(r.class)
          )
        ).toBe(true)
      })

      test('should combine filters with AND (stage==active;category==Mains)', async () => {
        const response = await request.get(
          '/api/analytics?filter=stage==active;category==Mains'
        )

        expect(response.status).toBe(200)
        expect(response.body.data).toHaveLength(1)
        expect(response.body.data[0]).toMatchObject({
          stage: 'active',
          category: 'Mains',
        })
      })

      test('should group by category', async () => {
        const response = await request.get('/api/analytics?groupBy=category')

        expect(response.status).toBe(200)
        expect(response.body.meta.groupBy).toBe('category')
        // Should have aggregated data with count
        expect(response.body.data.length).toBeGreaterThan(0)
        expect(response.body.data[0]).toHaveProperty('count')
      })

      test('should combine filter and groupBy', async () => {
        const response = await request.get(
          '/api/analytics?filter=stage==active&groupBy=stage'
        )

        expect(response.status).toBe(200)
        expect(response.body.meta.filter).toBe('stage==active')
        expect(response.body.meta.groupBy).toBe('stage')
        expect(response.body.data).toHaveLength(1)
        expect(response.body.data[0].stage).toBe('active')
        expect(response.body.data[0].count).toBe(2)
      })
    })
  })
})
