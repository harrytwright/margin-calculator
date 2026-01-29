import { Inject, register, UsesConfig } from '@harrytwright/api/dist/core'

import { Config } from '@harrytwright/cli-config'
import { AppConfig } from '../config'
import { MemoryHealth } from '../utils/health/memory.health'

export interface Health {
  error: { [key: string]: string }

  info: { [key: string]: 'healthy' | 'unhealthy' }

  details: { [key: string]: string }
}

@register('singleton')
export class HeathcheckService implements UsesConfig {
  @Inject('config')
  config: Config<AppConfig>

  constructor(private readonly memory: MemoryHealth) {}

  async health(): Promise<Health> {
    const checks = await Promise.allSettled([
      this.memory.checkHeap(this.config.get('name'), {
        heapUsedThreshold: 500 * 1024 * 1024,
      }),
    ])

    const health: Health = { error: {}, details: {}, info: {} }
    for (const check of checks) {
      if (check.status === 'rejected') continue

      const value = check.value
      const isError = 'error' in value

      health.info[value.key] = isError ? 'unhealthy' : 'healthy'

      /* istanbul ignore if */
      if (isError) health.error[value.key] = value.error.message

      if (!isError) health.details[value.key] = value.details ?? 'healthy'
    }

    return health
  }

  async readiness(): Promise<boolean> {
    const { info } = await this.health()
    // items can be worked around as long as the cache is healthy, as we can return what we know as the minimum
    return info.database === 'healthy' && info.token === 'healthy'
  }
}
