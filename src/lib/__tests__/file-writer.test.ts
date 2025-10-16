import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

import YAML from 'yaml'

import type {
  IngredientImportData,
  RecipeImportData,
  SupplierImportData,
} from '../../schema'
import { FileWriter } from '../file-writer'

describe('FileWriter', () => {
  let tempDir: string
  let writer: FileWriter

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-writer-test-'))
    writer = new FileWriter()
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test('writes supplier YAML to default location', async () => {
    const data: SupplierImportData = {
      name: 'ASDA',
      slug: 'asda',
    }

    const filePath = await writer.write('supplier', 'asda', data, tempDir)

    expect(filePath).toBe(path.join(tempDir, 'suppliers', 'asda.yaml'))

    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = YAML.parse(raw)

    expect(parsed).toEqual({
      object: 'supplier',
      data,
    })
  })

  test('writes ingredient YAML and creates directories', async () => {
    const data: IngredientImportData = {
      name: 'Cheddar',
      category: 'dairy',
      purchase: {
        unit: '1kg',
        cost: 5.99,
        vat: false,
      },
    }

    const filePath = await writer.write(
      'ingredient',
      'cheddar',
      data,
      tempDir,
      undefined
    )

    const stats = await fs.stat(path.dirname(filePath))
    expect(stats.isDirectory()).toBe(true)

    const parsed = YAML.parse(await fs.readFile(filePath, 'utf-8'))
    expect(parsed.object).toBe('ingredient')
    expect(parsed.data).toEqual(data)
  })

  test('writes recipe to existing custom path when provided', async () => {
    const data: RecipeImportData = {
      name: 'Ham Sandwich',
      slug: 'ham-sandwich',
      class: 'menu_item',
      stage: 'development',
      costing: {
        price: 450,
        margin: 30,
        vat: false,
      },
      ingredients: [],
    }

    const customDir = path.join(tempDir, 'recipes', 'lunch')
    await fs.mkdir(customDir, { recursive: true })
    const customPath = path.join(customDir, 'ham-sandwich.yaml')

    const filePath = await writer.write(
      'recipe',
      'ham-sandwich',
      data,
      tempDir,
      customPath
    )

    expect(filePath).toBe(customPath)

    const parsed = YAML.parse(await fs.readFile(filePath, 'utf-8'))
    expect(parsed.object).toBe('recipe')
    expect(parsed.data).toEqual(data)
  })

  test('deletes files when requested', async () => {
    const data: SupplierImportData = {
      name: 'Tesco',
      slug: 'tesco',
    }

    const filePath = await writer.write('supplier', 'tesco', data, tempDir)
    await writer.deleteFile(filePath)

    await expect(fs.access(filePath)).rejects.toThrow()
  })
})
