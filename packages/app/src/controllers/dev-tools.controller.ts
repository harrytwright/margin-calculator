import { randomUUID } from 'crypto'
import { join } from 'path'

import {
  controller,
  Inject,
  path,
  UsesConfig,
} from '@harrytwright/api/dist/core'
import { Config } from '@harrytwright/cli-config'
import express from 'express'

import { AppConfig } from '../config'

@controller('/.well-known/appspecific')
export class DevToolsController implements UsesConfig {
  @Inject('config')
  config: Config<AppConfig>

  @path('/com.chrome.devtools.json')
  getServerInfo(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    if (process.env.NODE_ENV !== 'development') return res.status(204).end()

    return res.status(200).json({
      workspace: {
        root: join(__dirname, '../../'),
        uuid: randomUUID(),
      },
    })
  }
}
