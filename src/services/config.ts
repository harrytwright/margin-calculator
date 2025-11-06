import fs from 'fs/promises'
import path from 'path'

import log from '@harrytwright/logger'
import toml from 'toml'

import { tomlWriter } from '../utils/toml-writer'

interface MarginConfig {
  vat?: number
  marginTarget?: number
  defaultPriceIncludesVat?: boolean
}

const defaultConfig: Required<MarginConfig> = {
  vat: 0.2,
  marginTarget: 20,
  defaultPriceIncludesVat: true, // UK/EU default: prices include VAT
}

export class ConfigService {
  private cache: MarginConfig | null = null

  private readonly configPath: string

  constructor(workingDir: string) {
    this.configPath = path.join(workingDir, 'conf', 'margin.toml')
  }

  async initialise(force: boolean, overrides: Partial<MarginConfig> = {}) {
    this.invalidate()

    const prev = await this.read()

    if (force) {
      await this.save({
        ...prev,
        ...overrides,
      })
    } else {
      await this.save({
        ...defaultConfig,
        ...prev,
        ...overrides,
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

  async getDefaultPriceIncludesVat(): Promise<boolean> {
    const config = await this.load()
    return (
      config.defaultPriceIncludesVat ?? defaultConfig.defaultPriceIncludesVat
    )
  }

  // Get all config settings at once (useful for settings page)
  async getAll(): Promise<Required<MarginConfig>> {
    const config = await this.load()
    return {
      vat: config.vat ?? defaultConfig.vat,
      marginTarget: config.marginTarget ?? defaultConfig.marginTarget,
      defaultPriceIncludesVat:
        config.defaultPriceIncludesVat ?? defaultConfig.defaultPriceIncludesVat,
    }
  }

  // Update config settings
  async update(
    updates: Partial<MarginConfig>
  ): Promise<Required<MarginConfig>> {
    const current = await this.load()
    const updated = {
      ...current,
      ...updates,
    }
    await this.save(updated)
    return this.getAll()
  }

  // Force reload from disk (useful after config changes)
  invalidate(): void {
    this.cache = null
  }
}

