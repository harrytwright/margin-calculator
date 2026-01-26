import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'

import { BuilderContext } from '@harrytwright/api/dist/builders/builder'
import { API } from '@harrytwright/api/dist/core'
import { createId } from '@paralleldrive/cuid2'
import supertest from 'supertest'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/sqlite'

import {cleanup, generateApplet, sign, supertestLogger} from '../../jest/testing-suite'
import {SuppliersController} from "./suppliers.controller";
import {createDatabase, migrate} from "@menubook/sqlite";
import {EventEmitter} from "events";
import {ConfigService, Supplier} from "@menubook/core";
import SupplierServiceImpl from "../services/supplier.service";
import {Selectable} from "kysely";

describe('SuppliersController', () => {
  var applet: BuilderContext
  var request: supertest.Agent
  var supplier: Selectable<Supplier>

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
            jsonObjectFrom
          }
        })
        .register('events', new EventEmitter())
        .register('globalConfig', new ConfigService('./tmp/dir'))
        .create(generateApplet(SuppliersController), config)

      await applet.listen()

      supplier = await applet.container.get<SupplierServiceImpl>(SupplierServiceImpl)!
        .create('demo-001', { name: 'Demo Supplier' })

      const server = applet?.server?.raw
      request = supertest.agent(server!)
    } catch (err) {
      await cleanup(applet)
      return Promise.reject(err)
    }
  })

  afterAll(async () => {
    await applet.container.get<SupplierServiceImpl>(SupplierServiceImpl)?.delete('demo-001')
    await cleanup(applet)
  })

  describe('/api/suppliers', () => {
    describe('GET', () => {
      test('should return a list of suppliers', async () => {
        const response = await request
          .get('/api/suppliers')

        expect(response.status).toBe(200)
        expect(response.body).toHaveLength(1)
      })
    })
  })
})
