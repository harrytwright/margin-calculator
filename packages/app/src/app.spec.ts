import { describe } from '@jest/globals'

import { API } from '@harrytwright/api/dist/core'
import { ConfigService } from '@menubook/core'
import { createDatabase, migrate } from '@menubook/sqlite'
import { EventEmitter } from 'events'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/sqlite'

import { App } from './app'

import { handleFlow, WorkFlows } from '../jest/testing-suite'

describe('App', () => {
  const workflow: WorkFlows = <WorkFlows>require('../e2e/api/workflow.json')

  describe('readinessCheck', function () {
    const database = createDatabase()

    handleFlow(
      workflow['readinessCheck']!,
      App,
      {},
      {
        before: async () => {
          await migrate(database, 'up')
        },
      },
      API.register('database', {
        db: database,
        helpers: {
          jsonArrayFrom,
          jsonObjectFrom,
        },
      })
        .register('events', new EventEmitter())
        .register('globalConfig', new ConfigService('./tmp/dir')),
      false
    )
  })
})
