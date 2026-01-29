import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

import type { IngredientImportData } from '../../../schema'
import { DatabaseOnlyStorage } from '../database-only-storage'

describe('DatabaseOnlyStorage', () => {
  let storage: DatabaseOnlyStorage
  let tempDir: string

  beforeEach(async () => {
    storage = new DatabaseOnlyStorage()
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'db-only-storage-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test('getMode returns "database-only"', () => {
    expect(storage.getMode()).toBe('database-only')
  })

  test('write returns empty string and does not create file', async () => {
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

    // Should return empty string
    expect(filePath).toBe('')

    // Verify no directories were created
    const ingredientsDir = path.join(tempDir, 'ingredients')
    const dirExists = await fs
      .access(ingredientsDir)
      .then(() => true)
      .catch(() => false)

    expect(dirExists).toBe(false)
  })

  test('write handles all entity types without creating files', async () => {
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

    // All should return empty strings
    expect(supplierPath).toBe('')
    expect(ingredientPath).toBe('')
    expect(recipePath).toBe('')

    // Verify no directories were created
    const suppliersDir = path.join(tempDir, 'suppliers')
    const ingredientsDir = path.join(tempDir, 'ingredients')
    const recipesDir = path.join(tempDir, 'recipes')

    for (const dir of [suppliersDir, ingredientsDir, recipesDir]) {
      const exists = await fs
        .access(dir)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(false)
    }
  })

  test('deleteFile does not throw error even if file does not exist', async () => {
    const nonExistentPath = path.join(tempDir, 'does-not-exist.yaml')

    // Should not throw
    await expect(storage.deleteFile(nonExistentPath)).resolves.toBeUndefined()
  })

  test('deleteFile is a no-op for existing files', async () => {
    const testFile = path.join(tempDir, 'test.yaml')
    await fs.writeFile(testFile, 'test content', 'utf-8')

    // Verify file exists
    let fileExists = await fs
      .access(testFile)
      .then(() => true)
      .catch(() => false)
    expect(fileExists).toBe(true)

    // Call deleteFile (should be no-op)
    await storage.deleteFile(testFile)

    // File should still exist (deleteFile is a no-op in database-only mode)
    fileExists = await fs
      .access(testFile)
      .then(() => true)
      .catch(() => false)
    expect(fileExists).toBe(true)
  })

  test('write ignores existingPath parameter', async () => {
    const existingPath = path.join(tempDir, 'custom', 'path.yaml')
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

    // Should still return empty string
    expect(filePath).toBe('')

    // Verify no file was created
    const fileExists = await fs
      .access(existingPath)
      .then(() => true)
      .catch(() => false)
    expect(fileExists).toBe(false)
  })
})
