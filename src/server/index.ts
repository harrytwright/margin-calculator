import express, { Express } from 'express'
import fs from 'fs/promises'
import { Server } from 'http'
import { Kysely } from 'kysely'
import path from 'path'

import log from '@harrytwright/logger'

import type { DB } from '../datastore/types'
import { FileWatcher } from '../lib/file-watcher'
import { HashService } from '../lib/hash-service'
import { Importer } from '../lib/importer'
import { createApiRouter } from './routes/api'

export interface ServerConfig {
  port: number
  database: Kysely<DB>
  workingDir: string
  openBrowser?: boolean
  watchFiles?: boolean
}

export function createServer(config: ServerConfig): Express {
  const app = express()

  // Middleware
  app.use(express.json())
  app.use(express.static(path.join(__dirname, 'public')))

  // API routes
  app.use('/api', createApiRouter(config))

  // Serve index.html for root
  app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
  })

  return app
}

export async function startServer(
  config: ServerConfig
): Promise<{ close: () => Promise<void> }> {
  const app = createServer(config)
  const url = `http://localhost:${config.port}`

  const server = await listen(app, config.port)

  console.log(`\n🚀 Margin UI running at ${url}`)
  console.log(`   Press Ctrl+C to stop\n`)

  if (config.openBrowser !== false) {
    try {
      const open = (await import('open')).default
      await open(url)
    } catch (error) {
      console.log(`   💡 Couldn't auto-open browser, please visit ${url}`)
    }
  }

  const watcher = config.watchFiles ? await startFileWatcher(config) : undefined

  return {
    close: async () => {
      await closeServer(server)
      if (watcher) {
        await watcher.stop()
      }
    },
  }
}

async function startFileWatcher(config: ServerConfig): Promise<FileWatcher> {
  const dataRoot = path.join(config.workingDir, 'data')

  await ensureDirectories([
    path.join(dataRoot, 'suppliers'),
    path.join(dataRoot, 'ingredients'),
    path.join(dataRoot, 'recipes'),
  ])

  const watcher = new FileWatcher({
    roots: [dataRoot],
    hashService: new HashService(),
    debounceMs: 150,
    watchOptions: {
      usePolling: process.platform === 'darwin' && process.env.CI === 'true',
    },
    importerFactory: () =>
      new Importer(config.database, {
        importOnly: true,
        projectRoot: dataRoot,
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
  })

  watcher.on('error', (error) => {
    log.error('watcher', error, 'File watcher error')
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
