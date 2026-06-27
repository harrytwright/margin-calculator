import type { DatabaseContext } from '@menubook/shared'

import { ConfigService } from '../config'
import { createTestContext } from './helpers/test-adapter'

describe('ConfigService', () => {
  let context: DatabaseContext
  let service: ConfigService

  beforeEach(async () => {
    context = await createTestContext()
    service = new ConfigService(context)
  })

  afterEach(async () => {
    await context.db.destroy()
  })

  test('find returns the settings row', async () => {
    const settings = await service.find()

    expect(settings).toMatchObject({
      id: 1,
      vatRateBps: 2000,
      marginTarget: 20,
    })
    expect(Boolean(settings.defaultPriceIncludesVat)).toBe(true)
  })

  test('find throws when the settings row is missing', async () => {
    await context.db.deleteFrom('Settings').execute()

    await expect(service.find()).rejects.toThrow()
  })

  test('initialise creates the default settings row when missing', async () => {
    await context.db.deleteFrom('Settings').execute()

    const settings = await service.initialise(false)
    const row = await context.db
      .selectFrom('Settings')
      .selectAll()
      .executeTakeFirstOrThrow()

    expect(settings).toMatchObject({
      id: 1,
      vatRateBps: 2000,
      marginTarget: 20,
    })
    expect(Boolean(settings.defaultPriceIncludesVat)).toBe(true)
    expect(row).toMatchObject({
      id: 1,
      vatRateBps: 2000,
      marginTarget: 20,
    })
    expect(Boolean(row.defaultPriceIncludesVat)).toBe(true)
  })

  test('converts vatRateBps to decimal VAT', async () => {
    await context.db
      .updateTable('Settings')
      .set({ vatRateBps: 1750 })
      .where('id', '=', 1)
      .execute()

    expect(await service.findVatRate()).toBe(0.175)
  })

  test('update preserves omitted fields', async () => {
    await service.upsert({
      vat: 0.1,
      marginTarget: 30,
      defaultPriceIncludesVat: false,
    })

    const settings = await service.update({ marginTarget: 40 })

    expect(settings).toMatchObject({
      vatRateBps: 1000,
      marginTarget: 40,
    })
    expect(Boolean(settings.defaultPriceIncludesVat)).toBe(false)
  })

  test('upsert inserts when missing and updates when present', async () => {
    await context.db.deleteFrom('Settings').execute()

    const inserted = await service.upsert({ vat: 0.055 })
    expect(inserted).toMatchObject({
      id: 1,
      vatRateBps: 550,
      marginTarget: 20,
    })
    expect(Boolean(inserted.defaultPriceIncludesVat)).toBe(true)

    const row = await context.db
      .selectFrom('Settings')
      .selectAll()
      .executeTakeFirstOrThrow()
    expect(row.vatRateBps).toBe(550)

    const updated = await service.upsert({ defaultPriceIncludesVat: false })
    expect(updated).toMatchObject({
      id: 1,
      vatRateBps: 550,
      marginTarget: 20,
    })
    expect(Boolean(updated.defaultPriceIncludesVat)).toBe(false)
  })

  test('initialise without force preserves existing values unless overrides are passed', async () => {
    await service.upsert({
      vat: 0.12,
      marginTarget: 55,
      defaultPriceIncludesVat: false,
    })

    const preserved = await service.initialise(false)
    expect(preserved).toMatchObject({
      vatRateBps: 1200,
      marginTarget: 55,
    })
    expect(Boolean(preserved.defaultPriceIncludesVat)).toBe(false)

    const updated = await service.initialise(false, { vat: 0.2 })
    expect(updated).toMatchObject({
      vatRateBps: 2000,
      marginTarget: 55,
    })
    expect(Boolean(updated.defaultPriceIncludesVat)).toBe(false)
  })

  test('initialise with force resets to defaults plus overrides', async () => {
    await service.upsert({
      vat: 0.12,
      marginTarget: 55,
      defaultPriceIncludesVat: false,
    })

    const settings = await service.initialise(true, { marginTarget: 60 })
    expect(settings).toMatchObject({
      vatRateBps: 2000,
      marginTarget: 60,
    })
    expect(Boolean(settings.defaultPriceIncludesVat)).toBe(true)
  })
})
