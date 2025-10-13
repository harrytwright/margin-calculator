import express, { Express } from 'express'
import { Kysely } from 'kysely'
import path from 'path'

import type { DB } from '../datastore/types'
import { createApiRouter } from './routes/api'

export interface ServerConfig {
  port: number
  database: Kysely<DB>
  workingDir: string
  openBrowser?: boolean
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

export function startServer(config: ServerConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    const app = createServer(config)
    const url = `http://localhost:${config.port}`

    const server = app.listen(config.port, async () => {
      console.log(`\n🚀 Margin UI running at ${url}`)
      console.log(`   Press Ctrl+C to stop\n`)

      // Open browser if requested
      if (config.openBrowser !== false) {
        try {
          const open = (await import('open')).default
          await open(url)
        } catch (error) {
          // Silently fail if browser can't be opened
          console.log(`   💡 Couldn't auto-open browser, please visit ${url}`)
        }
      }

      resolve()
    })

    server.on('error', reject)
  })
}
