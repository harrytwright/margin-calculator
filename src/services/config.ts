import fs from 'fs/promises'
import path from 'path'

import log from '@harrytwright/logger'
import toml from 'toml'

import { tomlWriter } from '../utils/toml-writer'

interface MarginConfig {
  vat?: number
  marginTarget?: number
}

const defaultConfig: Required<MarginConfig> = {
  vat: 0.2,
  marginTarget: 20,
}

export class ConfigService {
  private cache: MarginConfig | null = null

  private readonly configPath: string

  constructor(workingDir: string) {
    this.configPath = path.join(workingDir, 'conf', 'margin.toml')
  }

  async initialise(force: boolean) {
    this.invalidate()

    const prev = await this.read()

    if (force) {
      await this.save({
        ...prev,
      })
    } else {
      await this.save({
        ...defaultConfig,
        ...prev,
      })
    }
  }

  private async set<K extends keyof MarginConfig>(
    key: K,
    value: MarginConfig[K]
  ) {
    return this.save({
      ...this.cache,
      [key]: value,
    })
  }

  // Save the file to the directory and then set the cache value.
  private async save(cache: MarginConfig = defaultConfig) {
    await fs.writeFile(
      this.configPath,
      tomlWriter(cache, { newlineAfterSection: true }),
      'utf-8'
    )
    this.cache = cache
    return cache
  }

  // Read the value or return the default config. Throw if any error other than `ENOENT`
  private async read(): Promise<MarginConfig> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8')
      return toml.parse(content) as MarginConfig
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        log.warn('config', 'No config file found. Using default config')
        return defaultConfig
      }

      throw error
    }
  }

  // Load the data setting as we go
  private async load(): Promise<MarginConfig> {
    if (!this.cache) {
      this.cache = await this.read()
    }

    return this.cache
  }

  async getVatRate(): Promise<number> {
    const config = await this.load()
    return config.vat ?? defaultConfig.vat // Default 20% (0.2)
  }

  async getMarginTarget(): Promise<number> {
    const config = await this.load()
    return config.marginTarget ?? defaultConfig.marginTarget // Default 20%
  }

  // Force reload from disk (useful after config changes)
  invalidate(): void {
    this.cache = null
  }
}
