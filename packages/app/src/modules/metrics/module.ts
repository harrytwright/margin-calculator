import {
  Inject,
  register,
  UsesConfig,
  WillBootstrap,
} from '@harrytwright/api/dist/core'
import { Config } from '@harrytwright/cli-config'
import express from 'express'
import client, { Counter, Gauge } from 'prom-client'

import { AppConfig } from '../../config'

const prefix = process.env.PROM_PREFIX || 'gb_'

type ClassProperties<C, T> = {
  [K in keyof C as C[K] extends T ? K : never]: C[K]
}

type Keys<C, T> = keyof ClassProperties<C, T>

type IncrementalProperties = Keys<
  Omit<Prometheus, 'contentType' | 'config' | 'register'>,
  client.Counter | client.Gauge
>

type DecrementalProperties = Keys<
  Omit<Prometheus, 'contentType' | 'config' | 'register'>,
  client.Gauge
>

type ObservableProperties = Keys<
  Omit<Prometheus, 'contentType' | 'config' | 'register'>,
  client.Histogram
>

type TimeableProperties = Keys<
  Omit<Prometheus, 'contentType' | 'config' | 'register'>,
  client.Histogram | client.Gauge
>

@register('singleton')
export class Prometheus implements UsesConfig, WillBootstrap {
  @Inject('config')
  config: Config<AppConfig>

  register: client.Registry = new client.Registry()

  // Use this so we can log out what metrics are being used, only really for testing
  metricUsed: Set<
    Keys<
      Omit<Prometheus, 'metricUsed'>,
      client.Counter | client.Gauge | client.Histogram
    >
  > = new Set()

  get contentType() {
    return this.register.contentType
  }

  async bootstrap() {
    this.register.setDefaultLabels({
      service: this.config.get('name'),
    })

    client.collectDefaultMetrics({ prefix, register: this.register })
  }

  async handler(res: express.Response<string>) {
    res.set('Content-Type', this.contentType)
    return res.send(await this.register.metrics())
  }

  #getMetric<
    T extends Keys<
      Prometheus,
      client.Counter | client.Gauge | client.Histogram
    >,
  >(key: T) {
    this.metricUsed.add(key)
    return this[key]
  }

  inc<T extends IncrementalProperties>(name: T): void
  inc<T extends IncrementalProperties>(name: T, value: number): void
  inc<T extends IncrementalProperties>(
    name: T,
    labels: Parameters<Prometheus[T]['labels']>[0]
  ): void
  inc<T extends IncrementalProperties>(
    name: T,
    value: number,
    labels: Parameters<Prometheus[T]['labels']>[0]
  ): void
  inc<T extends IncrementalProperties>(
    name: T,
    valueOrLabels: number | Parameters<Prometheus[T]['labels']>[0] = 1,
    labels: Parameters<Prometheus[T]['labels']>[0] = {}
  ): void {
    const metric = this.#getMetric(name)
    if (typeof valueOrLabels !== 'number') {
      labels = valueOrLabels
      valueOrLabels = 1
    }

    return metric.labels(labels).inc(valueOrLabels)
  }

  dec<T extends DecrementalProperties>(name: T): void
  dec<T extends DecrementalProperties>(name: T, value: number): void
  dec<T extends DecrementalProperties>(
    name: T,
    labels: Parameters<Prometheus[T]['labels']>[0]
  ): void
  dec<T extends DecrementalProperties>(
    name: T,
    value: number,
    labels: Parameters<Prometheus[T]['labels']>[0]
  ): void
  dec<T extends DecrementalProperties>(
    name: T,
    valueOrLabels: number | Parameters<Prometheus[T]['labels']>[0] = 1,
    labels: Parameters<Prometheus[T]['labels']>[0] = {}
  ): void {
    const metric = this.#getMetric(name)
    if (typeof valueOrLabels !== 'number') {
      labels = valueOrLabels
      valueOrLabels = 1
    }

    return metric.labels(labels).dec(valueOrLabels)
  }

  observe<T extends ObservableProperties>(name: T): void
  observe<T extends ObservableProperties>(name: T, value: number): void
  observe<T extends ObservableProperties>(
    name: T,
    labels: Parameters<Prometheus[T]['labels']>[0]
  ): void
  observe<T extends ObservableProperties>(
    name: T,
    value: number,
    labels: Parameters<Prometheus[T]['labels']>[0]
  ): void
  observe<T extends ObservableProperties>(
    name: T,
    valueOrLabels: number | Parameters<Prometheus[T]['labels']>[0] = 1,
    labels: Parameters<Prometheus[T]['labels']>[0] = {}
  ): void {
    const metric = this.#getMetric(name)
    if (typeof valueOrLabels !== 'number') {
      labels = valueOrLabels
      valueOrLabels = 1
    }

    return metric
      .labels(...Object.values(labels).map((el) => el.toString()))
      .observe(valueOrLabels)
  }

  startTimer<T extends TimeableProperties>(
    name: T
  ): (labels?: Parameters<Prometheus[T]['startTimer']>[0]) => void
  startTimer<T extends ObservableProperties>(
    name: T,
    labels: Parameters<Prometheus[T]['startTimer']>[0]
  ): (labels?: Parameters<Prometheus[T]['startTimer']>[0]) => void
  startTimer<T extends ObservableProperties>(
    name: T,
    labels: Parameters<Prometheus[T]['startTimer']>[0] = {}
  ): (labels?: Parameters<Prometheus[T]['startTimer']>[0]) => void {
    const metric = this.#getMetric(name)
    // @ts-ignore
    return metric.startTimer(labels)
  }

  // Common metrics

  readonly httpReq = new client.Counter({
    name: 'gb_http_requests_total',
    help: 'HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [this.register],
  })

  readonly http404Route = new client.Counter({
    name: 'gb_http_invalid_route_total',
    help: 'Invalid Routes',
    labelNames: ['route'],
    registers: [this.register],
  })

  readonly httpDuration = new client.Histogram({
    name: 'gb_http_request_duration_seconds',
    help: 'HTTP duration',
    labelNames: ['method', 'route'],
    buckets: client.exponentialBuckets(0.05, 1.75, 8),
    registers: [this.register],
  })

  readonly httpInFlight = new client.Gauge({
    name: 'gb_http_in_flight_requests',
    help: 'In-flight HTTP requests',
    registers: [this.register],
  })

  readonly authAttempts = new client.Counter({
    name: `${prefix}auth_attempts_total`,
    help: 'Authentication attempts by strategy',
    labelNames: ['strategy'],
    registers: [this.register],
  })

  readonly authSuccess = new client.Counter({
    name: `${prefix}auth_success_total`,
    help: 'Successful authentications by strategy',
    labelNames: ['strategy'],
    registers: [this.register],
  })

  readonly authFailures = new client.Counter({
    name: `${prefix}auth_failures_total`,
    help: 'Authentication failures by strategy',
    labelNames: ['strategy', 'reason'],
    registers: [this.register],
  })

  // Database

  readonly dbDuration = new client.Histogram({
    name: 'gb_db_query_duration_seconds',
    help: 'DB query duration',
    labelNames: ['op', 'table'],
    buckets: [0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
    registers: [this.register],
  })

  readonly dbError = new client.Counter({
    name: 'gb_db_errors_total',
    help: 'DB errors',
    labelNames: ['op'],
    registers: [this.register],
  })

  readonly dbConnectionActive = new client.Gauge({
    name: 'gb_db_connection_active',
    help: 'Pool Connection active',
    registers: [this.register],
  })

  readonly dbConnectionCreated = new client.Gauge({
    name: 'gb_db_connection_created',
    help: 'Pool Connection created',
    registers: [this.register],
  })

  //Demo-Session

  readonly activeSessions = new Gauge({
    name: 'menubook_demo_active_sessions',
    help: 'Number of active demo sessions',
    registers: [this.register],
  })

  readonly sessionCreatedTotal = new Counter({
    name: 'menubook_demo_sessions_created_total',
    help: 'Total demo sessions created',
    registers: [this.register],
  })

  readonly sessionExpiredTotal = new Counter({
    name: 'menubook_demo_sessions_expired_total',
    help: 'Total demo sessions expired',
    registers: [this.register],
  })
}
