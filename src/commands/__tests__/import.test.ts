import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { Kysely } from 'kysely'

import { database, destroy, migrate } from '../../datastore/database'
import { DB } from '../../datastore/types'
import { Importer } from '../../lib/importer'
import {
  IngredientResolvedImportData,
  RecipeResolvedImportData,
  SupplierResolvedImportData,
} from '../../schema'
import { IngredientService } from '../../services/ingredient'
import { RecipeService } from '../../services/recipe'
import { SupplierService } from '../../services/supplier'

// Mock the slugify utility to avoid ESM import issues in tests
jest.mock('../../utils/slugify', () => ({
  slugify: jest.fn((input: string) =>
    Promise.resolve(
      input
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '')
    )
  ),
}))

describe('Import Command (CLI Integration)', () => {
  let tmpDir: string
  let workingDir: string
  let dbPath: string
  let db: Kysely<DB>

  beforeEach(async () => {
    // Create temporary working directory
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-cli-test-'))
    workingDir = tmpDir

    // Create .margin directory
    await fs.mkdir(path.join(workingDir, '.margin'))

    // Create data directory
    await fs.mkdir(path.join(workingDir, 'data'))

    // Set up database
    dbPath = path.join(workingDir, 'data', 'test.sqlite3')
    db = database(dbPath)

    // Run migrations
    await migrate.call(
      db,
      'up',
      path.join(__dirname, '../../datastore/migrations')
    )

    // Seed generic supplier
    await db
      .insertInto('Supplier')
      .values({ slug: 'generic', name: 'Generic Supplier' })
      .execute()
  })

  afterEach(async () => {
    await destroy(dbPath)
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  describe('Single File Import', () => {
    test('should import a supplier file', async () => {
      // Create test file
      const supplierFile = path.join(tmpDir, 'supplier.yaml')
      await fs.writeFile(
        supplierFile,
        `object: supplier
data:
  name: Test Supplier
`
      )

      // Run import logic (same as command action)
      const importer = new Importer(db, { failFast: false })
      const supplier = new SupplierService(db)
      const ingredient = new IngredientService(db, supplier)
      const recipe = new RecipeService(db, ingredient)

      importer.addProcessor<SupplierResolvedImportData>(
        'supplier',
        function (data, filePath) {
          return supplier.processor(this, data, filePath)
        }
      )

      importer.addProcessor<IngredientResolvedImportData>(
        'ingredient',
        function (data, filePath) {
          return ingredient.processor(this, data, filePath)
        }
      )

      importer.addProcessor<RecipeResolvedImportData>(
        'recipe',
        function (data, filePath) {
          return recipe.processor(this, data, filePath)
        }
      )

      const result = await importer.import([supplierFile])
      const { stats } = result

      // Verify stats
      expect(stats.created).toBe(1)
      expect(stats.failed).toBe(0)

      // Verify database
      const suppliers = await db.selectFrom('Supplier').selectAll().execute()
      expect(suppliers).toHaveLength(2) // Generic + Test Supplier
      expect(suppliers.find((s) => s.name === 'Test Supplier')).toBeDefined()
    })

    test('should import an ingredient file', async () => {
      const ingredientFile = path.join(tmpDir, 'ingredient.yaml')
      await fs.writeFile(
        ingredientFile,
        `object: ingredient
data:
  name: Test Ingredient
  category: test
  purchase:
    unit: 1kg
    cost: 5.99
    vat: false
`
      )

      const importer = new Importer(db, { failFast: false })
      const supplier = new SupplierService(db)
      const ingredient = new IngredientService(db, supplier)
      const recipe = new RecipeService(db, ingredient)

      importer.addProcessor<SupplierResolvedImportData>(
        'supplier',
        function (data) {
          return supplier.processor(this, data, undefined)
        }
      )
      importer.addProcessor<IngredientResolvedImportData>(
        'ingredient',
        function (data) {
          return ingredient.processor(this, data, undefined)
        }
      )
      importer.addProcessor<RecipeResolvedImportData>(
        'recipe',
        function (data) {
          return recipe.processor(this, data, undefined)
        }
      )

      const result = await importer.import([ingredientFile])
      const { stats } = result

      expect(stats.created).toBe(1)
      expect(stats.failed).toBe(0)

      const ingredients = await db
        .selectFrom('Ingredient')
        .selectAll()
        .execute()
      expect(ingredients).toHaveLength(1)
      expect(ingredients[0].name).toBe('Test Ingredient')
    })
  })

  describe('Multiple File Import (Mixed Types)', () => {
    test('should import supplier and ingredient together', async () => {
      const supplierFile = path.join(tmpDir, 'supplier.yaml')
      await fs.writeFile(
        supplierFile,
        `object: supplier
data:
  name: My Supplier
`
      )

      const ingredientFile = path.join(tmpDir, 'ingredient.yaml')
      await fs.writeFile(
        ingredientFile,
        `object: ingredient
data:
  name: My Ingredient
  category: test
  purchase:
    unit: 1kg
    cost: 3.50
    vat: false
`
      )

      const importer = new Importer(db, { failFast: false })
      const supplier = new SupplierService(db)
      const ingredient = new IngredientService(db, supplier)
      const recipe = new RecipeService(db, ingredient)

      importer.addProcessor<SupplierResolvedImportData>(
        'supplier',
        function (data) {
          return supplier.processor(this, data, undefined)
        }
      )
      importer.addProcessor<IngredientResolvedImportData>(
        'ingredient',
        function (data) {
          return ingredient.processor(this, data, undefined)
        }
      )
      importer.addProcessor<RecipeResolvedImportData>(
        'recipe',
        function (data) {
          return recipe.processor(this, data, undefined)
        }
      )

      const result = await importer.import([supplierFile, ingredientFile])
      const { stats } = result

      expect(stats.created).toBe(2)
      expect(stats.failed).toBe(0)
    })
  })

  describe('Dependency Resolution', () => {
    test('should auto-import supplier when importing ingredient with reference', async () => {
      // Create supplier file
      const supplierDir = path.join(tmpDir, 'suppliers')
      await fs.mkdir(supplierDir)
      const supplierFile = path.join(supplierDir, 'my-supplier.yaml')
      await fs.writeFile(
        supplierFile,
        `object: supplier
data:
  name: My Supplier
`
      )

      // Create ingredient file with supplier reference
      const ingredientDir = path.join(tmpDir, 'ingredients')
      await fs.mkdir(ingredientDir)
      const ingredientFile = path.join(ingredientDir, 'my-ingredient.yaml')
      await fs.writeFile(
        ingredientFile,
        `object: ingredient
data:
  name: My Ingredient
  category: test
  purchase:
    unit: 1kg
    cost: 4.99
    vat: false
  supplier:
    uses: ../suppliers/my-supplier.yaml
`
      )

      const importer = new Importer(db, {
        failFast: false,
        dataDir: tmpDir,
      })
      const supplier = new SupplierService(db)
      const ingredient = new IngredientService(db, supplier)
      const recipe = new RecipeService(db, ingredient)

      importer.addProcessor<SupplierResolvedImportData>(
        'supplier',
        function (data) {
          return supplier.processor(this, data, undefined)
        }
      )
      importer.addProcessor<IngredientResolvedImportData>(
        'ingredient',
        function (data) {
          return ingredient.processor(this, data, undefined)
        }
      )
      importer.addProcessor<RecipeResolvedImportData>(
        'recipe',
        function (data) {
          return recipe.processor(this, data, undefined)
        }
      )

      // Import only the ingredient - supplier should be auto-imported
      const result = await importer.import([ingredientFile])
      const { stats } = result

      expect(stats.created).toBe(2) // Supplier + Ingredient
      expect(stats.failed).toBe(0)

      const suppliers = await db.selectFrom('Supplier').selectAll().execute()
      const ingredients = await db
        .selectFrom('Ingredient')
        .selectAll()
        .execute()

      expect(suppliers).toHaveLength(2) // Generic + My Supplier
      expect(ingredients).toHaveLength(1)
    })

    test('should auto-import ingredients when importing recipe', async () => {
      // Create ingredient files
      const ingredientDir = path.join(tmpDir, 'ingredients')
      await fs.mkdir(ingredientDir)

      await fs.writeFile(
        path.join(ingredientDir, 'ham.yaml'),
        `object: ingredient
data:
  name: Ham
  category: meat
  purchase:
    unit: 1kg
    cost: 5.99
    vat: false
`
      )

      await fs.writeFile(
        path.join(ingredientDir, 'cheese.yaml'),
        `object: ingredient
data:
  name: Cheese
  category: dairy
  purchase:
    unit: 200g
    cost: 2.50
    vat: false
`
      )

      // Create recipe file
      const recipeDir = path.join(tmpDir, 'recipes')
      await fs.mkdir(recipeDir)
      const recipeFile = path.join(recipeDir, 'sandwich.yaml')
      await fs.writeFile(
        recipeFile,
        `object: recipe
data:
  name: Ham Sandwich
  costing:
    price: 400
    vat: false
  ingredients:
    - uses: ../ingredients/ham.yaml
      with:
        unit: 25g
    - uses: ../ingredients/cheese.yaml
      with:
        unit: 15g
`
      )

      const importer = new Importer(db, {
        failFast: false,
        dataDir: tmpDir,
      })
      const supplier = new SupplierService(db)
      const ingredient = new IngredientService(db, supplier)
      const recipe = new RecipeService(db, ingredient)

      importer.addProcessor<SupplierResolvedImportData>(
        'supplier',
        function (data) {
          return supplier.processor(this, data, undefined)
        }
      )
      importer.addProcessor<IngredientResolvedImportData>(
        'ingredient',
        function (data) {
          return ingredient.processor(this, data, undefined)
        }
      )
      importer.addProcessor<RecipeResolvedImportData>(
        'recipe',
        function (data) {
          return recipe.processor(this, data, undefined)
        }
      )

      // Import only recipe - ingredients should be auto-imported
      const result = await importer.import([recipeFile])
      const { stats } = result

      expect(stats.created).toBe(3) // 2 ingredients + 1 recipe
      expect(stats.failed).toBe(0)
    })
  })

  describe('Import-only mode', () => {
    test('should resolve data without writing to the database', async () => {
      const supplierFile = path.join(tmpDir, 'supplier.yaml')
      await fs.writeFile(
        supplierFile,
        `object: supplier
data:
  name: Test Supplier
`
      )

      const importer = new Importer(db, { failFast: false, importOnly: true })
      const supplier = new SupplierService(db)
      const ingredient = new IngredientService(db, supplier)
      const recipe = new RecipeService(db, ingredient)

      importer.addProcessor<SupplierResolvedImportData>(
        'supplier',
        function (data) {
          return supplier.processor(this, data, undefined)
        }
      )
      importer.addProcessor<IngredientResolvedImportData>(
        'ingredient',
        function (data) {
          return ingredient.processor(this, data, undefined)
        }
      )
      importer.addProcessor<RecipeResolvedImportData>(
        'recipe',
        function (data) {
          return recipe.processor(this, data, undefined)
        }
      )

      const { stats, resolved } = await importer.import([supplierFile])

      expect(stats.created).toBe(0)
      expect(stats.failed).toBe(0)

      const suppliers = await db.selectFrom('Supplier').selectAll().execute()
      expect(suppliers).toHaveLength(1)

      const entry = resolved?.get('test-supplier')
      expect(entry).toBeDefined()
      expect(entry?.type).toBe('supplier')
      expect(entry?.data.name).toBe('Test Supplier')
    })
  })

  describe('Error Handling', () => {
    test('should report failed imports when processor throws', async () => {
      // Create a valid file first
      const supplierFile = path.join(tmpDir, 'test-supplier.yaml')
      await fs.writeFile(
        supplierFile,
        `object: supplier
data:
  name: Test Supplier
`
      )

      const importer = new Importer(db, { failFast: false })
      const supplier = new SupplierService(db)
      const ingredient = new IngredientService(db, supplier)
      const recipe = new RecipeService(db, ingredient)

      // Register processor that throws for testing
      importer.addProcessor<SupplierResolvedImportData>(
        'supplier',
        function (data) {
          throw new Error('Simulated processor error')
        }
      )
      importer.addProcessor<IngredientResolvedImportData>(
        'ingredient',
        function (data) {
          return ingredient.processor(this, data, undefined)
        }
      )
      importer.addProcessor<RecipeResolvedImportData>(
        'recipe',
        function (data) {
          return recipe.processor(this, data, undefined)
        }
      )

      const result = await importer.import([supplierFile])
      const { stats } = result

      expect(stats.failed).toBeGreaterThan(0)
      expect(importer.hasErrors()).toBe(true)

      const errors = importer.getErrors()
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].error).toContain('Simulated processor error')
    })

    test('should stop on first error with --fail-fast', async () => {
      const invalidFile = path.join(tmpDir, 'invalid.yaml')
      await fs.writeFile(invalidFile, `invalid yaml: [}`)

      const importer = new Importer(db, { failFast: true })
      const supplier = new SupplierService(db)
      const ingredient = new IngredientService(db, supplier)
      const recipe = new RecipeService(db, ingredient)

      importer.addProcessor<SupplierResolvedImportData>(
        'supplier',
        function (data) {
          return supplier.processor(this, data, undefined)
        }
      )
      importer.addProcessor<IngredientResolvedImportData>(
        'ingredient',
        function (data) {
          return ingredient.processor(this, data, undefined)
        }
      )
      importer.addProcessor<RecipeResolvedImportData>(
        'recipe',
        function (data) {
          return recipe.processor(this, data, undefined)
        }
      )

      await expect(importer.import([invalidFile])).rejects.toThrow()
    })
  })

  describe('Stats Reporting', () => {
    test('should track created, upserted, and ignored stats', async () => {
      const supplierFile = path.join(tmpDir, 'supplier.yaml')
      await fs.writeFile(
        supplierFile,
        `object: supplier
data:
  name: Test Supplier
`
      )

      const importer = new Importer(db, { failFast: false })
      const supplier = new SupplierService(db)
      const ingredient = new IngredientService(db, supplier)
      const recipe = new RecipeService(db, ingredient)

      importer.addProcessor<SupplierResolvedImportData>(
        'supplier',
        function (data) {
          return supplier.processor(this, data, undefined)
        }
      )
      importer.addProcessor<IngredientResolvedImportData>(
        'ingredient',
        function (data) {
          return ingredient.processor(this, data, undefined)
        }
      )
      importer.addProcessor<RecipeResolvedImportData>(
        'recipe',
        function (data) {
          return recipe.processor(this, data, undefined)
        }
      )

      // First import - should create
      const { stats: stats1 } = await importer.import([supplierFile])
      expect(stats1.created).toBe(1)
      expect(stats1.ignored).toBe(0)

      // Second import - should ignore (no changes)
      const { stats: stats2 } = await importer.import([supplierFile])
      expect(stats2.created).toBe(0)
      expect(stats2.ignored).toBe(1)
    })
  })
})
