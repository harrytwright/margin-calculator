import { register } from '@harrytwright/api/dist/core'

import { HealthIndicator } from '../../types/health.type'

@register('transient')
export class MemoryHealth {
  public async checkHeap(
    key: string,
    options: { heapUsedThreshold?: number }
  ): Promise<HealthIndicator> {
    const { heapUsed } = process.memoryUsage()

    /* istanbul ignore next */
    if (heapUsed > (options.heapUsedThreshold || 150 * 1024 * 1024)) {
      return {
        error: new Error(
          `Storage heap exceeded - max ${
            options.heapUsedThreshold || 150 * 1024 * 1024
          } used ${heapUsed}`
        ),
        key,
      }
    }

    return { status: 'healthy', details: `${heapUsed} used so far`, key }
  }
}
