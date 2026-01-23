import { afterAll, beforeAll, describe, test } from '@jest/globals'

import { BuilderContext } from '@harrytwright/api/dist/builders/builder'
import { API } from '@harrytwright/api/dist/core'
import supertest from 'supertest'

import { cleanup, generateApplet } from '../../../../jest/testing-suite'
import { MetricsController } from './metrics.controller'

describe('MetricsController', () => {
  var applet: BuilderContext
  var request: supertest.Agent
  var authHeader: string

  beforeAll(async () => {
    try {
      const { config } = await import('../../../config.js')
      config.load()

      applet = API.create(generateApplet(MetricsController), config)
      await applet.listen()

      request = supertest.agent(applet.server?.raw || undefined)
    } catch (err) {
      // Kysely defers the connection on the first sql command, so will not open any connection, unlike
      // the event handler which does, even still, just run a full cleanup
      await cleanup(applet)
      return Promise.reject(err)
    }
  })

  afterAll(() => cleanup(applet))

  describe('/metrics', function () {
    describe('GET', function () {
      test('200', function (done) {
        request
          .get('/metrics')
          .auth(authHeader, { type: 'bearer' })
          .expect('Content-Type', 'text/plain; charset=utf-8; version=0.0.4')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            done()
          })
      })
    })
  })
})
