import {
  BodyParser,
  http,
  NotFound,
  useControllers,
  useErrorHandler,
  useMiddleware,
} from '@harrytwright/api/dist/core'
import { NotFound as HTTPNotFound } from '@hndlr/errors'
import express from 'express'

import {
  AnalyticsController,
  AppController,
  EventsController,
  HealthcheckController,
  InfoController,
  IngredientsController,
  RecipesController,
  SuppliersController,
} from './controllers'

import { Setting } from '@harrytwright/api/dist/core/decorators/helpers/settings.decorator'
import path from 'path'
import handler from './middleware/error-handler'
import { MetricsController } from './modules/metrics/controllers/metrics.controller'
import { expressRequestHandler } from './modules/sentry/middleware/wrapper'

@http((config) => config.get('port')) // @ts-ignore
@Setting('view engine', 'ejs')
@Setting('views', path.join(__dirname, '../views'))
@useControllers(
  InfoController,
  HealthcheckController,
  MetricsController,
  SuppliersController,
  IngredientsController,
  RecipesController,
  AnalyticsController,
  EventsController,
  AppController
)
@useMiddleware(expressRequestHandler())
@useMiddleware(require('./modules/metrics/middleware/morgan').morgan)
@useMiddleware(require('./middleware/cors').cors)
// @useMiddleware(require('./middleware/tracing').Tracing)
// @useMiddleware(require('./middleware/trace').trace)
@useMiddleware(require('cookie-parser')())
@useMiddleware(require('./middleware/demo').demo)
@useMiddleware(express.static(path.join(__dirname, '../public')))
@useMiddleware(
  require('./modules/auth/middleware/authentication').Authentication
)
@BodyParser.json({ type: ['application/*+json', 'application/json'] })
@BodyParser.url({ extended: true })
@NotFound()
@NotFound(
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.set('X-REASON-NOT-FOUND', 'route')
    return next(new HTTPNotFound(`Could not find ${req.url}`, 'ERR_NOT_FOUND'))
  }
)
@useErrorHandler(handler)
export class App {}
