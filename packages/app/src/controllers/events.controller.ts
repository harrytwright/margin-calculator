import { controller, Inject, path } from '@harrytwright/api/dist/core'
import type { EventEmitter } from 'events'
import express from 'express'

@controller('/api/events')
export class EventsController {
  constructor(@Inject('events') private readonly events: EventEmitter) {}

  @path('/sse')
  async getEvents(req: express.Request, res: express.Response) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering

    // Send initial connection event
    res.write('event: connected\n')
    res.write(
      `data: ${JSON.stringify({ message: 'SSE connection established' })}\n\n`
    )

    // Keep-alive heartbeat
    const heartbeat = setInterval(() => {
      res.write('event: ping\n')
      res.write(`data: ${JSON.stringify({ timestamp: Date.now() })}\n\n`)
    }, 30000)

    // Event handlers
    const handlers: Array<{
      event: string
      handler: (...args: any[]) => void
    }> = []

    if (this.events) {
      // Forward relevant events to the client
      const eventTypes = [
        'supplier.created',
        'supplier.updated',
        'supplier.deleted',
        'ingredient.created',
        'ingredient.updated',
        'ingredient.deleted',
        'recipe.created',
        'recipe.updated',
        'recipe.deleted',
      ]

      for (const eventType of eventTypes) {
        const handler = (data: unknown) => {
          res.write(`event: ${eventType}\n`)
          res.write(`data: ${JSON.stringify(data)}\n\n`)
        }
        handlers.push({ event: eventType, handler })
        this.events.on(eventType, handler)
      }
    }

    // Cleanup on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat)
      if (this.events) {
        for (const { event, handler } of handlers) {
          this.events.off(event, handler)
        }
      }
    })
  }
}
