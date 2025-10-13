import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'

import { migrate } from '../../datastore/database'
import { DB } from '../../datastore/types'
import {
  IngredientResolvedImportData,
  RecipeResolvedImportData,
  SupplierResolvedImportData,
} from '../../schema'
import { IngredientService } from '../../services/ingredient'
import { SupplierService } from '../../services/supplier'
import { hasChanges } from '../../utils/has-changes'
import { Importer } from '../importer'

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

describe('Importer', () => {
  let db: Kysely<DB>
  let tmpDir: string

  beforeEach(async () => {
    // Create in-memory database for testing
    db = new Kysely<DB>({
      dialect: new SqliteDialect({
        database: new Database(':memory:'),
      }),
    })

    await migrate.call(
      db,
      'up',
      path.join(__dirname, '../../datastore/migrations')
    )

    // Create a temporary directory for test files
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-test-'))
  })

  afterEach(async () => {
    await db.destroy()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  describe('Basic Functionality', () => {
    test('should register and retrieve processors', () => {
      const importer = new Importer(db)

      const mockProcessor = jest.fn()
      importer.addProcessor('supplier', mockProcessor)

      expect(importer.hasProcessor('supplier')).toBe(true)
      expect(importer.getProcessor('supplier')).toBe(mockProcessor)
      expect(importer.hasProcessor('ingredient')).toBe(false)
    })

    test('should allow method chaining when adding processors', () => {
      const importer = new Importer(db)

      const result = importer
        .addProcessor('supplier', jest.fn())
        .addProcessor('ingredient', jest.fn())

      expect(result).toBe(importer)
      expect(importer.hasProcessor('supplier')).toBe(true)
      expect(importer.hasProcessor('ingredient')).toBe(true)
    })

    test('should provide slugify helper', async () => {
      const importer = new Importer(db)

      const slug = await importer.slugify('Test Supplier Name')
      expect(slug).toBe('test-supplier-name')
    })

    test('should preload processors via constructor', () => {
      const mockProcessor1 = jest.fn()
      const mockProcessor2 = jest.fn()

      const importer = new Importer(db, {
        processors: [
          ['supplier', mockProcessor1],
          ['ingredient', mockProcessor2],
        ],
      })

      expect(importer.hasProcessor('supplier')).toBe(true)
      expect(importer.hasProcessor('ingredient')).toBe(true)
      expect(importer.getProcessor('supplier')).toBe(mockProcessor1)
      expect(importer.getProcessor('ingredient')).toBe(mockProcessor2)
    })

    test('should preload processors via constructor with service objects', async () => {
      const mockService = {
        processor: jest.fn().mockResolvedValue('created'),
      }

      const importer = new Importer(db, {
        processors: [['supplier', mockService]],
      })

      expect(importer.hasProcessor('supplier')).toBe(true)

      // Verify the wrapper function works correctly
      const processor = importer.getProcessor('supplier')
      expect(processor).toBeDefined()

      // Call the processor and verify it delegates to the service's processor method
      const result = await processor!.call(
        importer,
        { slug: 'test', name: 'Test' },
        undefined
      )
      expect(result).toBe('created')
      expect(mockService.processor).toHaveBeenCalledWith(
        importer,
        { slug: 'test', name: 'Test' },
        undefined
      )
    })
  })

  describe('File Import', () => {
    test('should import a simple supplier file', async () => {
      const importer = new Importer(db)
      const supplierService = new SupplierService(db)

      // Register supplier processor (receives resolved data with slug already set)
      importer.addProcessor<SupplierResolvedImportData>(
        'supplier',
        async function (data) {
          await supplierService.upsert(data.slug, data)
          return 'created'
        }
      )

      // Create test file
      const supplierFile = path.join(tmpDir, 'asda.yaml')
      await fs.writeFile(
        supplierFile,
        `object: supplier
data:
  name: Asda
`
      )

      // Import
      const stats = await importer.import([supplierFile])

      expect(stats.created).toBe(1)
      expect(stats.failed).toBe(0)

      // Verify database
      const supplier = await db
        .selectFrom('Supplier')
        .selectAll()
        .executeTakeFirst()
      expect(supplier?.name).toBe('Asda')
      expect(supplier?.slug).toBe('asda')
    })

    test('should track upserted items', async () => {
      const importer = new Importer(db)
      const supplierService = new SupplierService(db)

      // Insert initial supplier with matching slug
      await db
        .insertInto('Supplier')
        .values({ slug: 'asda-new-name', name: 'Asda Old Name' })
        .execute()

      // Register processor
      importer.addProcessor<SupplierResolvedImportData>(
        'supplier',
        async function (data) {
          const existing = await supplierService.findById(data.slug)
          await supplierService.upsert(data.slug, data)
          return existing ? 'upserted' : 'created'
        }
      )

      // Create test file - will generate slug 'asda-new-name' to match existing
      const supplierFile = path.join(tmpDir, 'asda.yaml')
      await fs.writeFile(
        supplierFile,
        `object: supplier
data:
  name: Asda New Name
`
      )

      const stats = await importer.import([supplierFile])

      expect(stats.upserted).toBe(1)
      expect(stats.created).toBe(0)

      // Verify updated
      const supplier = await db
        .selectFrom('Supplier')
        .selectAll()
        .executeTakeFirst()
      expect(supplier?.name).toBe('Asda New Name')
    })

    test('should track ignored items when no changes', async () => {
      const importer = new Importer(db)
      const supplierService = new SupplierService(db)

      // Insert initial supplier
      await db
        .insertInto('Supplier')
        .values({ slug: 'asda', name: 'Asda' })
        .execute()

      // Register processor with change detection
      importer.addProcessor<SupplierResolvedImportData>(
        'supplier',
        async function (data) {
          const existing = await supplierService.findById(data.slug)

          const hasChanged = hasChanges(existing, data, {
            name: 'name',
          })

          if (existing && !hasChanged) {
            return 'ignored'
          }

          await supplierService.upsert(data.slug, data)
          return existing ? 'upserted' : 'created'
        }
      )

      // Create test file with identical data
      const supplierFile = path.join(tmpDir, 'asda.yaml')
      await fs.writeFile(
        supplierFile,
        `object: supplier
data:
  name: Asda
`
      )

      const stats = await importer.import([supplierFile])

      expect(stats.ignored).toBe(1)
      expect(stats.created).toBe(0)
      expect(stats.upserted).toBe(0)
    })

    test('should handle errors gracefully in default mode', async () => {
      const importer = new Importer(db)

      // Register processor that throws
      importer.addProcessor<SupplierResolvedImportData>(
        'supplier',
        async function () {
          throw new Error('Test error')
        }
      )

      const supplierFile = path.join(tmpDir, 'asda.yaml')
      await fs.writeFile(
        supplierFile,
        `object: supplier
data:
  name: Asda
`
      )

      const stats = await importer.import([supplierFile])

      expect(stats.failed).toBe(1)
      expect(importer.hasErrors()).toBe(true)

      const errors = importer.getErrors()
      expect(errors).toHaveLength(1)
      expect(errors[0].error).toContain('Test error')
    })

    test('should throw in fail-fast mode', async () => {
      const importer = new Importer(db, { failFast: true })

      importer.addProcessor<SupplierResolvedImportData>(
        'supplier',
        async function () {
          throw new Error('Test error')
        }
      )

      const supplierFile = path.join(tmpDir, 'asda.yaml')
      await fs.writeFile(
        supplierFile,
        `object: supplier
data:
  name: Asda
`
      )

      await expect(importer.import([supplierFile])).rejects.toThrow(
        'Test error'
      )
    })
  })

  describe('Dependency Resolution', () => {
    test('should prevent duplicate imports', async () => {
      const importer = new Importer(db)
      const supplierService = new SupplierService(db)

      let importCount = 0
      importer.addProcessor<SupplierResolvedImportData>(
        'supplier',
        async function (data) {
          importCount++
          await supplierService.upsert(data.slug, data)
          return 'created'
        }
      )

      const supplierFile = path.join(tmpDir, 'asda.yaml')
      await fs.writeFile(
        supplierFile,
        `object: supplier
data:
  name: Asda
`
      )

      // Import same file twice
      await importer.import([supplierFile])
      await importer.import([supplierFile])

      // Should only process once per import() call
      expect(importCount).toBe(2) // Each import() call resets, so 2 is expected
    })
  })

  describe('Reference Resolution', () => {
    describe('resolveReferenceToPath', () => {
      test('should resolve absolute (@/) references', () => {
        const importer = new Importer(db, { projectRoot: '/project' })

        const resolved = importer.resolveReferenceToPath(
          '/project/recipes/pizza.yaml',
          '@/ingredients/cheese.yaml'
        )

        expect(resolved).toBe('/project/ingredients/cheese.yaml')
      })

      test('should resolve relative (./) references', () => {
        const importer = new Importer(db)

        const resolved = importer.resolveReferenceToPath(
          '/project/recipes/pizza.yaml',
          './base-pizza.yaml'
        )

        expect(resolved).toBe('/project/recipes/base-pizza.yaml')
      })

      test('should resolve parent (../) references', () => {
        const importer = new Importer(db)

        const resolved = importer.resolveReferenceToPath(
          '/project/recipes/pizza.yaml',
          '../ingredients/cheese.yaml'
        )

        expect(resolved).toBe('/project/ingredients/cheese.yaml')
      })

      test('should return null for slug references', () => {
        const importer = new Importer(db)

        const resolved = importer.resolveReferenceToPath(
          '/project/recipes/pizza.yaml',
          'slug:cheese'
        )

        expect(resolved).toBeNull()
      })

      test('should use cwd as default project root', () => {
        const importer = new Importer(db)

        const resolved = importer.resolveReferenceToPath(
          '/any/file.yaml',
          '@/data/test.yaml'
        )

        expect(resolved).toBe(path.join(process.cwd(), 'data/test.yaml'))
      })
    })

    describe('extractFileDependencies', () => {
      test('should extract recipe extends dependencies', () => {
        const importer = new Importer(db, {
          projectRoot: tmpDir,
          failFast: true,
        })

        const data = {
          object: 'recipe',
          data: {
            name: 'Margherita Pizza',
            extends: './base-pizza.yaml',
            costing: { price: 800 },
            ingredients: [],
          },
        } as any

        const deps = importer.extractFileDependencies(
          data,
          path.join(tmpDir, 'recipes/margherita.yaml')
        )

        expect(deps).toHaveLength(1)
        expect(deps[0]).toBe(path.join(tmpDir, 'recipes/base-pizza.yaml'))
      })

      test('should extract recipe ingredient path dependencies', () => {
        const importer = new Importer(db, {
          projectRoot: tmpDir,
          failFast: true,
        })

        const data = {
          object: 'recipe',
          data: {
            name: 'Ham Sandwich',
            ingredients: [
              { uses: '@/ingredients/ham.yaml', with: { unit: '25g' } },
              { uses: './bread.yaml', with: { unit: '2 slices' } },
              { uses: 'slug:cheese', with: { unit: '15g' } }, // Should be ignored
            ],
          },
        } as any

        const deps = importer.extractFileDependencies(
          data,
          path.join(tmpDir, 'recipes/ham-sandwich.yaml')
        )

        expect(deps).toHaveLength(2)
        expect(deps).toContain(path.join(tmpDir, 'ingredients/ham.yaml'))
        expect(deps).toContain(path.join(tmpDir, 'recipes/bread.yaml'))
      })

      test('should extract ingredient supplier path dependencies', () => {
        const importer = new Importer(db, {
          projectRoot: tmpDir,
          failFast: true,
        })

        const data = {
          object: 'ingredient',
          data: {
            name: 'Ham',
            category: 'meat',
            purchaseUnit: '1kg',
            purchaseCost: 5.99,
            supplier: { uses: '../suppliers/asda.yaml' },
          },
        } as any

        const deps = importer.extractFileDependencies(
          data,
          path.join(tmpDir, 'ingredients/ham.yaml')
        )

        expect(deps).toHaveLength(1)
        expect(deps[0]).toBe(path.join(tmpDir, 'suppliers/asda.yaml'))
      })

      test('should ignore slug references', () => {
        const importer = new Importer(db)

        const data = {
          object: 'ingredient',
          data: {
            name: 'Cheese',
            category: 'dairy',
            purchaseUnit: '200g',
            purchaseCost: 2.5,
            supplier: { uses: 'slug:asda' },
          },
        } as any

        const deps = importer.extractFileDependencies(
          data,
          path.join(tmpDir, 'ingredients/cheese.yaml')
        )

        expect(deps).toHaveLength(0)
      })
    })
  })

  describe('Dependency Graph Import', () => {
    test('should auto-import dependencies in correct order', async () => {
      const importer = new Importer(db, { projectRoot: tmpDir, failFast: true })
      const supplierService = new SupplierService(db)
      const ingredientService = new IngredientService(db, supplierService)

      const importOrder: string[] = []

      // Register processors that track import order
      importer.addProcessor<SupplierResolvedImportData>(
        'supplier',
        async function (data) {
          importOrder.push(`supplier:${data.name}`)
          await supplierService.upsert(data.slug, data)
          return 'created'
        }
      )

      importer.addProcessor<IngredientResolvedImportData>(
        'ingredient',
        async function (data) {
          importOrder.push(`ingredient:${data.name}`)

          const supplierSlug = data.supplier?.slug || 'generic'

          await ingredientService.upsert(data.slug, data, supplierSlug)
          return 'created'
        }
      )

      // Create directory structure
      const suppliersDir = path.join(tmpDir, 'suppliers')
      const ingredientsDir = path.join(tmpDir, 'ingredients')
      await fs.mkdir(suppliersDir)
      await fs.mkdir(ingredientsDir)

      // Create supplier file
      await fs.writeFile(
        path.join(suppliersDir, 'asda.yaml'),
        `object: supplier
data:
  name: Asda
`
      )

      // Create ingredient file that depends on supplier
      await fs.writeFile(
        path.join(ingredientsDir, 'ham.yaml'),
        `object: ingredient
data:
  name: Ham
  category: meat
  purchase:
    unit: 1kg
    cost: 5.99
  supplier:
    uses: ../suppliers/asda.yaml
`
      )

      // Import only the ingredient - supplier should be auto-imported
      const stats = await importer.import([
        path.join(ingredientsDir, 'ham.yaml'),
      ])

      expect(stats.created).toBe(2) // Supplier + Ingredient
      expect(stats.failed).toBe(0)

      // Verify import order: supplier before ingredient
      expect(importOrder).toEqual(['supplier:Asda', 'ingredient:Ham'])

      // Verify database
      const suppliers = await db.selectFrom('Supplier').selectAll().execute()
      const ingredients = await db
        .selectFrom('Ingredient')
        .selectAll()
        .execute()

      expect(suppliers).toHaveLength(1)
      expect(ingredients).toHaveLength(1)
      expect(ingredients[0].supplierId).toBe(suppliers[0].id)
    })

    test('should handle complex dependency trees', async () => {
      const importer = new Importer(db, { projectRoot: tmpDir, failFast: true })
      const supplierService = new SupplierService(db)
      const ingredientService = new IngredientService(db, supplierService)

      const importOrder: string[] = []

      importer.addProcessor<SupplierResolvedImportData>(
        'supplier',
        async function (data) {
          importOrder.push(`supplier:${data.name}`)
          await supplierService.upsert(data.slug, data)
          return 'created'
        }
      )

      importer.addProcessor<IngredientResolvedImportData>(
        'ingredient',
        async function (data) {
          importOrder.push(`ingredient:${data.name}`)

          const supplierSlug = data.supplier?.slug || 'generic'

          await ingredientService.upsert(data.slug, data, supplierSlug)
          return 'created'
        }
      )

      importer.addProcessor<RecipeResolvedImportData>(
        'recipe',
        async function (data) {
          importOrder.push(`recipe:${data.name}`)
          return 'created'
        }
      )

      // Create complex structure
      const suppliersDir = path.join(tmpDir, 'suppliers')
      const ingredientsDir = path.join(tmpDir, 'ingredients')
      const recipesDir = path.join(tmpDir, 'recipes')
      await fs.mkdir(suppliersDir)
      await fs.mkdir(ingredientsDir)
      await fs.mkdir(recipesDir)

      // Supplier
      await fs.writeFile(
        path.join(suppliersDir, 'asda.yaml'),
        `object: supplier
data:
  name: Asda
`
      )

      // Ingredients depending on supplier
      await fs.writeFile(
        path.join(ingredientsDir, 'cheese.yaml'),
        `object: ingredient
data:
  name: Cheese
  category: dairy
  purchase:
    unit: 200g
    cost: 2.50
  supplier:
    uses: ../suppliers/asda.yaml
`
      )

      await fs.writeFile(
        path.join(ingredientsDir, 'ham.yaml'),
        `object: ingredient
data:
  name: Ham
  category: meat
  purchase:
    unit: 1kg
    cost: 5.99
  supplier:
    uses: "@/suppliers/asda.yaml"
`
      )

      // Recipe depending on ingredients
      await fs.writeFile(
        path.join(recipesDir, 'ham-sandwich.yaml'),
        `object: recipe
data:
  name: Ham Sandwich
  costing:
    price: 400
  ingredients:
    - uses: ../ingredients/ham.yaml
      with:
        unit: 25g
    - uses: ../ingredients/cheese.yaml
      with:
        unit: 15g
`
      )

      // Import only recipe - should auto-import all dependencies
      const stats = await importer.import([
        path.join(recipesDir, 'ham-sandwich.yaml'),
      ])

      expect(stats.created).toBe(4) // 1 supplier + 2 ingredients + 1 recipe
      expect(stats.failed).toBe(0)

      // Verify order: supplier -> ingredients -> recipe
      expect(importOrder[0]).toBe('supplier:Asda')
      expect(importOrder.slice(1, 3).sort()).toEqual([
        'ingredient:Cheese',
        'ingredient:Ham',
      ])
      expect(importOrder[3]).toBe('recipe:Ham Sandwich')
    })

    test('should detect circular dependencies', async () => {
      const importer = new Importer(db, { projectRoot: tmpDir, failFast: true })

      importer.addProcessor<RecipeResolvedImportData>(
        'recipe',
        async function () {
          return 'created'
        }
      )

      const recipesDir = path.join(tmpDir, 'recipes')
      await fs.mkdir(recipesDir)

      // Create circular dependency: A -> B -> A
      await fs.writeFile(
        path.join(recipesDir, 'a.yaml'),
        `object: recipe
data:
  name: Recipe A
  costing:
    price: 250
  ingredients:
    - uses: ./b.yaml
      with:
        unit: 100g
`
      )

      await fs.writeFile(
        path.join(recipesDir, 'b.yaml'),
        `object: recipe
data:
  name: Recipe B
  costing:
    price: 250
  ingredients:
    - uses: ./a.yaml
      with:
        unit: 50g
`
      )

      // Should throw cycle detection error
      await expect(
        importer.import([path.join(recipesDir, 'a.yaml')])
      ).rejects.toThrow(/Dependency Cycle Found/)
    })
  })

  describe('Multiple Files', () => {
    test('should import multiple files and aggregate stats', async () => {
      const importer = new Importer(db)
      const supplierService = new SupplierService(db)

      importer.addProcessor<SupplierResolvedImportData>(
        'supplier',
        async function (data) {
          await supplierService.upsert(data.slug, data)
          return 'created'
        }
      )

      // Create multiple supplier files
      const files = ['asda.yaml', 'tesco.yaml', 'sainsburys.yaml']
      const filePaths = []

      for (const file of files) {
        const filePath = path.join(tmpDir, file)
        const name = file.replace('.yaml', '')
        await fs.writeFile(
          filePath,
          `object: supplier
data:
  name: ${name.charAt(0).toUpperCase() + name.slice(1)}
`
        )
        filePaths.push(filePath)
      }

      const stats = await importer.import(filePaths)

      expect(stats.created).toBe(3)
      expect(stats.failed).toBe(0)

      const suppliers = await db.selectFrom('Supplier').selectAll().execute()
      expect(suppliers).toHaveLength(3)
    })
  })
})
