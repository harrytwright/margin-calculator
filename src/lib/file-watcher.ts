import EventEmitter from 'events'
import path from 'path'

import type { FSWatcher, WatchOptions } from 'chokidar'
import chokidar from 'chokidar'

import type { ResolvedImportData } from '../schema'
import { HashService } from './hash-service'
import type { ImportObjectType, ImportResult } from './importer'

const DEFAULT_DEBOUNCE_MS = 300
const DEFAULT_IGNORED = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.DS_Store',
  '**/*.tmp',
  '**/*.swp',
]

export type WatcherEntityAction = 'created' | 'updated' | 'deleted'

export interface WatcherEntityEvent {
  action: WatcherEntityAction
  type: ImportObjectType
  slug: string
  path: string
  data?: ResolvedImportData
}

export interface FileWatcherOptions {
  roots: string[]
  hashService: HashService
  importerFactory: () =>
    | Promise<{
        import: (files: string[]) => Promise<ImportResult>
      }>
    | {
        import: (files: string[]) => Promise<ImportResult>
      }
  debounceMs?: number
  ignored?: (string | RegExp)[]
  watchOptions?: WatchOptions
}

interface PathMetadata {
  slug: string
  type: ImportObjectType
}

export declare interface FileWatcher {
  on(event: 'entity', listener: (event: WatcherEntityEvent) => void): this
  on(event: 'error', listener: (error: Error) => void): this
  off(event: 'entity', listener: (event: WatcherEntityEvent) => void): this
  off(event: 'error', listener: (error: Error) => void): this
  emit(event: 'entity', payload: WatcherEntityEvent): boolean
  emit(event: 'error', error: Error): boolean
}

export class FileWatcher extends EventEmitter {
  private watcher?: FSWatcher
  private timers = new Map<string, NodeJS.Timeout>()
  private pathIndex = new Map<string, PathMetadata>()

  constructor(private options: FileWatcherOptions) {
    super()
  }

  async start(): Promise<void> {
    if (this.watcher) {
      return
    }

    const watchOptions = this.createWatchOptions()

    this.watcher = chokidar.watch(this.options.roots, watchOptions)

    this.watcher.on('add', (filePath: string) =>
      this.scheduleProcess(filePath, 'add')
    )
    this.watcher.on('change', (filePath: string) =>
      this.scheduleProcess(filePath, 'change')
    )
    this.watcher.on('unlink', (filePath: string) => {
      this.clearTimer(filePath)
      this.handleDelete(filePath).catch((error) => this.emitError(error))
    })
    this.watcher.on('error', (error: Error) => this.emitError(error))

    await new Promise<void>((resolve, reject) => {
      this.watcher?.once('ready', () => resolve())
      this.watcher?.once('error', (error: Error) => reject(error))
    })
  }

  async stop(): Promise<void> {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()

    if (this.watcher) {
      await this.watcher.close()
      this.watcher = undefined
    }
  }

  private scheduleProcess(filePath: string, reason: 'add' | 'change'): void {
    const absolute = path.resolve(filePath)
    const debounce = this.options.debounceMs ?? DEFAULT_DEBOUNCE_MS
    const existing = this.timers.get(absolute)
    if (existing) {
      clearTimeout(existing)
    }

    const timer = setTimeout(() => {
      this.timers.delete(absolute)
      this.handleAddOrChange(absolute, reason).catch((error) =>
        this.emitError(error)
      )
    }, debounce)

    this.timers.set(absolute, timer)
  }

  private clearTimer(filePath: string): void {
    const absolute = path.resolve(filePath)
    const timer = this.timers.get(absolute)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(absolute)
    }
  }

  private async handleAddOrChange(
    filePath: string,
    reason: 'add' | 'change'
  ): Promise<void> {
    const previousHash = this.options.hashService.get(filePath)
    const { changed, hash } =
      await this.options.hashService.hasChanged(filePath)

    if (!changed && reason === 'change') {
      return
    }

    this.options.hashService.set(filePath, hash)

    const importer = await Promise.resolve(this.options.importerFactory())
    const result = await importer.import([filePath])

    if (!result.resolved) {
      return
    }

    for (const value of result.resolved.values()) {
      const metaBefore = this.pathIndex.get(value.path)

      this.pathIndex.set(value.path, {
        slug: value.slug,
        type: value.type,
      })

      const action: WatcherEntityAction =
        metaBefore || previousHash ? 'updated' : 'created'

      this.emit('entity', {
        action,
        type: value.type,
        slug: value.slug,
        path: value.path,
        data: value.data,
      })
    }
  }

  private async handleDelete(filePath: string): Promise<void> {
    this.options.hashService.remove(filePath)
    const absolute = path.resolve(filePath)
    const meta = this.pathIndex.get(absolute)

    if (!meta) {
      return
    }

    this.pathIndex.delete(absolute)

    this.emit('entity', {
      action: 'deleted',
      type: meta.type,
      slug: meta.slug,
      path: absolute,
    })
  }

  private emitError(error: unknown): void {
    if (error instanceof Error) {
      this.emit('error', error)
    } else {
      this.emit('error', new Error(String(error)))
    }
  }

  private createWatchOptions(): WatchOptions {
    const baseIgnored = this.options.ignored ?? DEFAULT_IGNORED

    const provided = this.options.watchOptions ?? {}

    return {
      ignoreInitial: true,
      ...provided,
      ignored: provided.ignored ?? baseIgnored,
    }
  }
}
