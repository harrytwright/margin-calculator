import { register } from '@harrytwright/api/dist/core'
import log from '@harrytwright/logger'

@register('singleton')
export class Abort {
  private readonly controller: AbortController

  constructor() {
    this.controller = new AbortController()
  }

  get signal() {
    return this.controller.signal
  }

  // Does not need to be async, but can go with it...
  async abort(reason?: string) {
    log.warn('abort', 'Aborting all inflight `axios` requests')
    return this.controller.abort(reason)
  }
}
