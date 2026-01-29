import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

import YAML from 'yaml'

import type { IngredientImportData } from '../../../schema'
import { FileSystemStorage } from '../file-system-storage'

describe('FileSystemStorage', () => {
  let storage: FileSystemStorage
  let tempDir: string

  beforeEach(async () => {
    storage = new FileSystemStorage()
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-storage-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test('getMode returns "fs"', () => {
    expect(storage.getMode()).toBe('fs')
  })

  test('write creates YAML file with correct structure', async () => {
    const data: IngredientImportData = {
      name: 'Test Ingredient',
      category: 'test',
      purchase: {
        unit: '1kg',
        cost: 1050,
        vat: false,
      },
    }

    const filePath = await storage.write(
      'ingredient',
      'test-ingredient',
      data,
      tempDir
    )

    expect(filePath).toBe(
      path.join(tempDir, 'ingredients', 'test-ingredient.yaml')
    )

    // Verify file exists
    const fileExists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false)
    expect(fileExists).toBe(true)

    // Verify file contents
    const fileContents = await fs.readFile(filePath, 'utf-8')
    const parsed = YAML.parse(fileContents)

    expect(parsed).toMatchObject({
      object: 'ingredient',
      data: {
        name: 'Test Ingredient',
        category: 'test',
        purchase: {
          unit: '1kg',
          cost: 1050,
          vat: false,
        },
      },
    })

    // Verify auto-generated header is present
    expect(fileContents).toContain('WARNING: This file was auto-generated')
  })

  test('write creates directory structure if missing', async () => {
    const data: IngredientImportData = {
      name: 'Test',
      category: 'test',
      purchase: { unit: '1kg', cost: 5, vat: false },
    }

    const filePath = await storage.write('ingredient', 'test', data, tempDir)

    const ingredientsDir = path.join(tempDir, 'ingredients')
    const dirExists = await fs
      .access(ingredientsDir)
      .then(() => true)
      .catch(() => false)

    expect(dirExists).toBe(true)
    expect(filePath).toBe(path.join(ingredientsDir, 'test.yaml'))
  })

  test('write uses existingPath when provided', async () => {
    const existingPath = path.join(tempDir, 'custom', 'path.yaml')
    await fs.mkdir(path.dirname(existingPath), { recursive: true })

    const data: IngredientImportData = {
      name: 'Test',
      category: 'test',
      purchase: { unit: '1kg', cost: 5, vat: false },
    }

    const filePath = await storage.write(
      'ingredient',
      'test',
      data,
      tempDir,
      existingPath
    )

    expect(filePath).toBe(existingPath)

    const fileExists = await fs
      .access(existingPath)
      .then(() => true)
      .catch(() => false)
    expect(fileExists).toBe(true)
  })

  test('deleteFile removes file from filesystem', async () => {
    const testFile = path.join(tempDir, 'test.yaml')
    await fs.writeFile(testFile, 'test content', 'utf-8')

    // Verify file exists
    let fileExists = await fs
      .access(testFile)
      .then(() => true)
      .catch(() => false)
    expect(fileExists).toBe(true)

    // Delete file
    await storage.deleteFile(testFile)

    // Verify file is gone
    fileExists = await fs
      .access(testFile)
      .then(() => true)
      .catch(() => false)
    expect(fileExists).toBe(false)
  })

  test('write handles all entity types', async () => {
    const supplierData = { name: 'Test Supplier' }
    const ingredientData = {
      name: 'Test Ingredient',
      category: 'test',
      purchase: { unit: '1kg', cost: 5, vat: false },
    }
    const recipeData = {
      name: 'Test Recipe',
      category: 'test',
      class: 'menu_item',
      ingredients: [],
    }

    const supplierPath = await storage.write(
      'supplier',
      'test-supplier',
      supplierData,
      tempDir
    )
    const ingredientPath = await storage.write(
      'ingredient',
      'test-ingredient',
      ingredientData,
      tempDir
    )
    const recipePath = await storage.write(
      'recipe',
      'test-recipe',
      recipeData,
      tempDir
    )

    expect(supplierPath).toContain('suppliers')
    expect(ingredientPath).toContain('ingredients')
    expect(recipePath).toContain('recipes')

    // Verify all files exist
    for (const filePath of [supplierPath, ingredientPath, recipePath]) {
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)
    }
  })
})
