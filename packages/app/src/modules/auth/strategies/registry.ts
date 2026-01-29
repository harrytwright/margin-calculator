import { register } from '@harrytwright/api/dist/core'

import type { ProtectedRequest } from '../../../types/response.json.type'
import type { Auth } from '../classes/auth'

export interface AuthenticationStrategy {
  supports(req: ProtectedRequest<any, any, any, any>): boolean
  authenticate(
    req: ProtectedRequest<any, any, any, any>
  ): Promise<Auth | undefined> | Auth | undefined
}

@register('singleton')
export class StrategyRegistry {
  private readonly strategies: AuthenticationStrategy[] = []

  add(strategy: AuthenticationStrategy) {
    this.strategies.push(strategy)
  }

  list(): AuthenticationStrategy[] {
    return [...this.strategies]
  }
}
