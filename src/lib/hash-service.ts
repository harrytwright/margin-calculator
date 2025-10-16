import { createHash } from 'crypto'
import fs from 'fs/promises'
import path from 'path'

export type HashSnapshot = Record<string, string>

export class HashService {
  private cache = new Map<string, string>()

  get(pathname: string): string | undefined {
    const absolute = this.toAbsolute(pathname)
    return this.cache.get(absolute)
  }

  set(pathname: string, hash: string): void {
    const absolute = this.toAbsolute(pathname)
    this.cache.set(absolute, hash)
  }

  remove(pathname: string): void {
    const absolute = this.toAbsolute(pathname)
    this.cache.delete(absolute)
  }

  has(pathname: string): boolean {
    const absolute = this.toAbsolute(pathname)
    return this.cache.has(absolute)
  }

  entries(): IterableIterator<[string, string]> {
    return this.cache.entries()
  }

  toSnapshot(): HashSnapshot {
    return Object.fromEntries(this.cache)
  }

  restore(snapshot: HashSnapshot): void {
    this.cache = new Map(
      Object.entries(snapshot).map(([key, value]) => [
        this.toAbsolute(key),
        value,
      ])
    )
  }

  async computeHash(pathname: string): Promise<string> {
    const absolute = this.toAbsolute(pathname)
    const file = await fs.readFile(absolute)
    return createHash('sha256').update(file).digest('hex')
  }

  async hasChanged(
    pathname: string,
    nextHash?: string
  ): Promise<{ changed: boolean; hash: string }> {
    const absolute = this.toAbsolute(pathname)
    const hash = nextHash ?? (await this.computeHash(absolute))
    const previous = this.cache.get(absolute)
    return {
      changed: !previous || previous !== hash,
      hash,
    }
  }

  async prefill(paths: Iterable<string>): Promise<HashSnapshot> {
    const snapshot: HashSnapshot = {}

    for (const entry of paths) {
      const absolute = this.toAbsolute(entry)

      try {
        const hash = await this.computeHash(absolute)
        this.cache.set(absolute, hash)
        snapshot[absolute] = hash
      } catch (error) {
        // Ignore files that can't be read (deleted between discovery and hashing)
        if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          throw error
        }
      }
    }

    return snapshot
  }

  private toAbsolute(pathname: string): string {
    return path.isAbsolute(pathname)
      ? pathname
      : path.resolve(process.cwd(), pathname)
  }
}
