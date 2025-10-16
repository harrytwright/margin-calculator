declare module 'chokidar' {
  import { EventEmitter } from 'events'

  type AwaitWriteFinishOptions =
    | boolean
    | {
        stabilityThreshold?: number
        pollInterval?: number
      }

  export interface WatchOptions {
    persistent?: boolean
    ignoreInitial?: boolean
    ignored?: Array<string | RegExp> | string | RegExp | undefined
    followSymlinks?: boolean
    awaitWriteFinish?: AwaitWriteFinishOptions
    depth?: number
    interval?: number
    binaryInterval?: number
    usePolling?: boolean
  }

  export interface FSWatcher extends EventEmitter {
    add(paths: string | readonly string[]): this
    close(): Promise<void>
    on(
      event: 'add' | 'change' | 'unlink',
      listener: (path: string) => void
    ): this
    on(event: 'error', listener: (error: Error) => void): this
    on(event: 'ready', listener: () => void): this
    once(event: 'ready', listener: () => void): this
    once(event: 'error', listener: (error: Error) => void): this
  }

  export function watch(
    paths: string | readonly string[],
    options?: WatchOptions
  ): FSWatcher

  const chokidar: {
    watch: typeof watch
  }

  export default chokidar
}
