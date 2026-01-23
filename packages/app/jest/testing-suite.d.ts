import { BuilderContext } from '@harrytwright/api/dist/builders/builder'
import { Constructable } from '@harrytwright/api/dist/common/interfaces'
import { API } from '@harrytwright/api/dist/core'
import { Container } from '@harrytwright/api/dist/core/injection/container'
import { Container as BaseContainer } from '@harrytwright/api/dist/injection'
import { ServiceIdentifier } from '@harrytwright/api/dist/injection/types/service-identifier.type'
import { Config } from '@harrytwright/cli-config'
import supertest from 'supertest'
import { AppConfig } from '../src/config'
import './mocks/logger'
export { __unsafe_TestingSuite as TestingSuite } from '@harrytwright/api/dist/test/testing-suite'
export type { ITestingSuite } from '@harrytwright/api/dist/test/testing-suite'
export declare function generateApplet(controller: Constructable<any>): {
  new (): {}
}
export declare function errorMessageShouldBe(
  message: any
): (res: supertest.Response) => void
export declare function handle<A extends any>(
  fn: Promise<A> | undefined,
  callback: (err?: Error) => void
): Promise<void>
export declare function flatten(
  obj: Record<any, any>,
  deliminator?: string
): Record<any, any>
export declare function fatten(
  obj: Record<any, any>,
  deliminator?: string
): Record<any, any>
export type Methods = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
export type Exporter = {
  path: string
  regex?: string
  default?: string
}
export interface WorkFlow {
  route: string
  method: Methods
  body?: any
  auth?: boolean | string
  headers?: Record<string, any>
  tests?: {
    [key: 'status' | 'content-type' | 'body' | string]: any
  }[]
  exports?: Record<string, string | Exporter>
  name?: string
  host?: string
  wait?: number
  timeout?: number
}
export type WorkFlows = {
  [key: string]: WorkFlow[]
}
export type Hook = (
  applet: BuilderContext | undefined,
  ctx: Record<string, Record<string, any>>,
  config?: Config<AppConfig>
) => Promise<void>
export interface Hooks {
  before?: Hook
  after?: Hook
}
export declare function handleFlow(
  workflow: WorkFlow[],
  base: string | Constructable<any>,
  runnerCtx: Record<string, any>,
  hooks?: Hooks,
  builder?: typeof API
): Promise<void>
export declare function sleep(ms: number): Promise<unknown>
export declare function sign(payload: object, priv: string): Promise<string>
export declare function cleanup(
  applet?:
    | BuilderContext
    | BaseContainer
    | Container
    | {
        get: <T>(v: ServiceIdentifier) => T | undefined
      },
  container?:
    | BaseContainer
    | Container
    | {
        get: <T>(v: ServiceIdentifier) => T | undefined
      }
): Promise<void | PromiseSettledResult<any>[]>
export declare function supertestLogger(res: supertest.Response): void
export declare function testDebugLog(msg: any, ...args: any[]): void
//# sourceMappingURL=testing-suite.d.ts.map
