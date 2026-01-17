import cookieParser from 'cookie-parser'
import { EventEmitter } from 'events'
import express, { Express } from 'express'
import fs from 'fs/promises'
import { Server } from 'http'
import path from 'path'

import log from '@harrytwright/logger'

import type { DatabaseContext, StorageMode } from '@menubook/core'
import {
  ConfigService,
  detectRealm,
  FileWatcher,
  HashService,
  Importer,
  IngredientService,
  realmToConfig,
  RecipeService,
  SupplierService,
} from '@menubook/core'
import { demoMiddleware, isDemoEnabled } from './middleware/demo'
import { metricsMiddleware } from './middleware/metrics'
import { createApiRouter } from './routes/api'
import { initDemoSessionManager } from './services/demo-session'
import { metricsService } from './services/metrics'

export interface ServerConfig {
  port: number
  database: DatabaseContext
  locationDir: string
  workspaceDir: string
  storageMode?: StorageMode
  openBrowser?: boolean
  watchFiles?: boolean
  events?: EventEmitter
  /** Factory function to create in-memory databases for demo sessions */
  demoDatabaseFactory?: () => Promise<DatabaseContext>
}

export function createServer(config: ServerConfig): Express {
  const app = express()

  // View engine setup for EJS
  app.set('view engine', 'ejs')
  app.set('views', path.join(__dirname, 'views'))

  // Middleware
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(cookieParser())
  app.use(express.static(path.join(__dirname, 'public')))
  app.use(metricsMiddleware)
  app.use(demoMiddleware)

  // Metrics endpoint
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', metricsService.getContentType())
    res.send(await metricsService.getMetrics())
  })

  // Make config available to all views
  app.locals.config = config

  // API routes
  app.use(
    require('./middleware/morgan').morgan(require('@harrytwright/logger'))
  )
  app.use('/api', createApiRouter(config))

  // EJS-based app routes
  const { createAppRouter } = require('./routes/app')
  app.use('/', createAppRouter(config))

  return app
}

export async function startServer(
  config: ServerConfig
): Promise<{ close: () => Promise<void> }> {
  const events = config.events ?? new EventEmitter()

  // Apply REALM-based defaults if not explicitly configured
  const realmDefaults = realmToConfig(detectRealm())
  const runtimeConfig: ServerConfig = {
    storageMode: realmDefaults.storageMode,
    watchFiles: realmDefaults.watchFiles,
    ...config, // CLI-provided values override defaults
    events,
  }

  // Initialize demo session manager if DEMO mode is enabled
  let demoManager: ReturnType<typeof initDemoSessionManager> | undefined
  if (isDemoEnabled() && config.demoDatabaseFactory) {
    demoManager = initDemoSessionManager(config.demoDatabaseFactory)
    log.info('demo', 'Demo mode enabled - session-based databases active')
  }

  const app = createServer(runtimeConfig)
  const url = `http://localhost:${config.port}`

  const server = await listen(app, config.port)

  console.log(`\n🚀 Margin UI running at ${url}`)
  if (isDemoEnabled()) {
    console.log('   📋 Demo mode active (sessions expire after 30 minutes)')
  }
  console.log(`   Press Ctrl+C to stop\n`)

  if (config.openBrowser !== false) {
    try {
      const open = (await import('open')).default
      await open(url)
    } catch (error) {
      console.log(`   💡 Couldn't auto-open browser, please visit ${url}`)
    }
  }

  const watcher = config.watchFiles
    ? await startFileWatcher(runtimeConfig)
    : undefined

  return {
    close: async () => {
      await closeServer(server)
      if (watcher) {
        await watcher.stop()
      }
      if (demoManager) {
        await demoManager.shutdown()
      }
    },
  }
}

async function startFileWatcher(config: ServerConfig): Promise<FileWatcher> {
  const dataRoot = config.workspaceDir

  await ensureDirectories([
    dataRoot,
    path.join(dataRoot, 'suppliers'),
    path.join(dataRoot, 'ingredients'),
    path.join(dataRoot, 'recipes'),
  ])

  const configService = new ConfigService(config.locationDir)
  const supplierService = new SupplierService(config.database)
  const ingredientService = new IngredientService(
    config.database,
    supplierService
  )
  const recipeService = new RecipeService(
    config.database,
    ingredientService,
    configService
  )

  const watcher = new FileWatcher({
    roots: [dataRoot],
    hashService: new HashService(),
    debounceMs: 150,
    watchOptions: {
      usePolling: process.platform === 'darwin' && process.env.CI === 'true',
    },
    importerFactory: () =>
      new Importer(config.database, {
        failFast: true,
        dataDir: dataRoot,
        processors: [
          ['supplier', supplierService],
          ['ingredient', ingredientService],
          ['recipe', recipeService],
        ],
      }),
    ignored: ['**/*.sqlite*'],
  })

  watcher.on('entity', (event) => {
    log.info(
      'watcher',
      `${event.action} ${event.type} (${event.slug}) from ${path.relative(
        dataRoot,
        event.path
      )}`
    )
    config.events?.emit('entity', event)
  })

  watcher.on('error', (error) => {
    log.error('watcher', error, 'File watcher error')
    config.events?.emit('error', error)
  })

  await watcher.start()
  return watcher
}

async function ensureDirectories(dirs: string[]): Promise<void> {
  await Promise.all(dirs.map((dir) => fs.mkdir(dir, { recursive: true })))
}

function listen(app: Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server))
    server.on('error', reject)
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}
