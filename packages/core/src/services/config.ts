import type { DatabaseContext, Settings, UpdateSettings } from '@menubook/shared'

// TODO: Add tenant-aware settings lookup when tenant scoped data lands.

export interface MarginConfig {
  vat?: number
  marginTarget?: number
  defaultPriceIncludesVat?: boolean
}

const defaultConfig: Required<MarginConfig> = {
  vat: 0.2,
  marginTarget: 20,
  defaultPriceIncludesVat: true,
}

const SETTINGS_ID = 1

export class ConfigService {
  constructor(private readonly context: DatabaseContext) {}

  private get database() {
    return this.context.db
  }

  async initialise(
    force: boolean,
    overrides: Partial<MarginConfig> = {}
  ): Promise<Settings> {
    if (force) {
      return this.upsert({
        ...defaultConfig,
        ...overrides,
      })
    }

    const settings = await this.database
      .selectFrom('Settings')
      .selectAll()
      .where('id', '=', SETTINGS_ID)
      .executeTakeFirst()

    if (!settings) {
      return this.upsert({
        ...defaultConfig,
        ...overrides,
      })
    }

    if (hasUpdates(overrides)) {
      return this.update(overrides)
    }

    return settings
  }

  async find(): Promise<Settings> {
    return this.database
      .selectFrom('Settings')
      .selectAll()
      .where('id', '=', SETTINGS_ID)
      .executeTakeFirstOrThrow()
  }

  async findVatRate(): Promise<number> {
    const settings = await this.find()
    return settings.vatRateBps / 10000
  }

  async findMarginTarget(): Promise<number> {
    const settings = await this.find()
    return settings.marginTarget
  }

  async findDefaultPriceIncludesVat(): Promise<boolean> {
    const settings = await this.find()
    return Boolean(settings.defaultPriceIncludesVat)
  }

  async update(updates: Partial<MarginConfig>): Promise<Settings> {
    const values = this.configToSettings(updates)

    if (Object.keys(values).length > 0) {
      await this.database
        .updateTable('Settings')
        .set(values)
        .where('id', '=', SETTINGS_ID)
        .executeTakeFirst()
    }

    return this.find()
  }

  async upsert(settings: Partial<MarginConfig>): Promise<Settings> {
    const insertValues = this.configToSettings({
      ...defaultConfig,
      ...settings,
    })
    const updateValues = this.configToSettings(settings)

    await this.database
      .insertInto('Settings')
      .values({
        id: SETTINGS_ID,
        vatRateBps:
          insertValues.vatRateBps ?? Math.round(defaultConfig.vat * 10000),
        marginTarget: insertValues.marginTarget ?? defaultConfig.marginTarget,
        defaultPriceIncludesVat:
          insertValues.defaultPriceIncludesVat ??
          defaultConfig.defaultPriceIncludesVat,
      } as any)
      .onConflict((oc) =>
        Object.keys(updateValues).length > 0
          ? oc.column('id').doUpdateSet(updateValues)
          : oc.column('id').doNothing()
      )
      .execute()

    return this.find()
  }

  private configToSettings(settings: Partial<MarginConfig>): UpdateSettings {
    const values: UpdateSettings = {}

    if (settings.vat !== undefined) {
      values.vatRateBps = Math.round(settings.vat * 10000)
    }

    if (settings.marginTarget !== undefined) {
      values.marginTarget = settings.marginTarget
    }

    if (settings.defaultPriceIncludesVat !== undefined) {
      values.defaultPriceIncludesVat = (
        this.context.type === 'sqlite'
          ? Number(settings.defaultPriceIncludesVat)
          : settings.defaultPriceIncludesVat
      ) as UpdateSettings['defaultPriceIncludesVat']
    }

    return values
  }
}

function hasUpdates(settings: Partial<MarginConfig>): boolean {
  return Object.values(settings).some((value) => value !== undefined)
}
