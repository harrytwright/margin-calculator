import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client'

export class MetricsService {
  private registry: Registry

  // HTTP metrics
  public httpRequestsTotal: Counter
  public httpRequestDuration: Histogram

  // Session metrics (for demo mode)
  public activeSessions: Gauge
  public sessionCreatedTotal: Counter
  public sessionExpiredTotal: Counter

  // Business metrics
  public entityCreatedTotal: Counter
  public calculationsTotal: Counter

  constructor() {
    this.registry = new Registry()
    collectDefaultMetrics({ register: this.registry })

    this.httpRequestsTotal = new Counter({
      name: 'menubook_http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    })

    this.httpRequestDuration = new Histogram({
      name: 'menubook_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    })

    this.activeSessions = new Gauge({
      name: 'menubook_demo_active_sessions',
      help: 'Number of active demo sessions',
      registers: [this.registry],
    })

    this.sessionCreatedTotal = new Counter({
      name: 'menubook_demo_sessions_created_total',
      help: 'Total demo sessions created',
      registers: [this.registry],
    })

    this.sessionExpiredTotal = new Counter({
      name: 'menubook_demo_sessions_expired_total',
      help: 'Total demo sessions expired',
      registers: [this.registry],
    })

    this.entityCreatedTotal = new Counter({
      name: 'menubook_entities_created_total',
      help: 'Total entities created',
      labelNames: ['type'],
      registers: [this.registry],
    })

    this.calculationsTotal = new Counter({
      name: 'menubook_calculations_total',
      help: 'Total recipe calculations performed',
      registers: [this.registry],
    })
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics()
  }

  getContentType(): string {
    return this.registry.contentType
  }
}

export const metricsService = new MetricsService()
