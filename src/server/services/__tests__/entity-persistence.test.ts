import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

import YAML from 'yaml'

import { database, destroy, migrate, seed } from '../../../datastore/database'
import { FileSystemStorage } from '../../../lib/storage/file-system-storage'
import { IngredientService } from '../../../services/ingredient'
import { RecipeService } from '../../../services/recipe'
import { SupplierService } from '../../../services/supplier'
import type { ServerConfig } from '../../index'
import { EntityPersistence } from '../entity-persistence'

jest.mock('../../../utils/slugify', () => ({
  slugify: jest.fn((value: string) =>
    Promise.resolve(
      value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    )
  ),
}))

describe('EntityPersistence create flow', () => {
  let tempDir: string
  let dbPath: string
  let db: ReturnType<typeof database>
  let persistence: EntityPersistence

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'entity-persistence-'))
    dbPath = path.join(tempDir, 'test.sqlite')
    const dataDir = path.join(tempDir, 'data')
    await fs.mkdir(dataDir, { recursive: true })

    db = database(dbPath)
    await migrate.call(
      db,
      'up',
      path.join(__dirname, '../../../datastore/migrations')
    )
    await seed.call(db)

    const supplier = new SupplierService(db)
    const ingredient = new IngredientService(db, supplier)
    const recipe = new RecipeService(db, ingredient)

    const config: ServerConfig = {
      port: 0,
      database: db as unknown as any,
      locationDir: tempDir,
      workspaceDir: dataDir,
      openBrowser: false,
    }

    const storage = new FileSystemStorage()

    persistence = new EntityPersistence(
      config,
      {
        supplier,
        ingredient,
        recipe,
      },
      storage
    )
  })

  afterEach(async () => {
    await destroy(dbPath)
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test('creates supplier, ingredient, and recipe', async () => {
    const supplier = await persistence.createSupplier({
      name: 'Atlantic Foods',
    })

    expect(supplier.slug).toBe('atlantic-foods')
    expect(supplier.name).toBe('Atlantic Foods')

    const supplierFile = path.join(
      tempDir,
      'data',
      'suppliers',
      'atlantic-foods.yaml'
    )
    const supplierYaml = YAML.parse(await fs.readFile(supplierFile, 'utf-8'))
    expect(supplierYaml).toMatchObject({
      object: 'supplier',
      data: { name: 'Atlantic Foods', slug: 'atlantic-foods' },
    })

    const ingredient = await persistence.createIngredient({
      name: 'Ham',
      category: 'meat',
      purchase: {
        unit: '1kg',
        cost: 5.99,
        vat: false,
      },
      supplier: { uses: 'slug:atlantic-foods' },
    })

    expect(ingredient.slug).toBe('ham')
    expect(ingredient.supplierSlug).toBe('atlantic-foods')

    const ingredientFile = path.join(tempDir, 'data', 'ingredients', 'ham.yaml')
    const ingredientYaml = YAML.parse(
      await fs.readFile(ingredientFile, 'utf-8')
    )
    expect(ingredientYaml).toMatchObject({
      object: 'ingredient',
      data: {
        name: 'Ham',
        slug: 'ham',
        supplier: { uses: 'slug:atlantic-foods' },
      },
    })

    const recipe = await persistence.createRecipe({
      name: 'Ham Sandwich',
      class: 'menu_item',
      stage: 'active',
      costing: {
        price: 450,
        margin: 30,
        vat: false,
      },
      ingredients: [
        {
          uses: 'slug:ham',
          with: {
            unit: '50g',
          },
        },
      ],
    })

    expect(recipe?.slug).toBe('ham-sandwich')
    expect(recipe?.ingredients).toHaveLength(1)

    const recipeFile = path.join(
      tempDir,
      'data',
      'recipes',
      'ham-sandwich.yaml'
    )
    const recipeYaml = YAML.parse(await fs.readFile(recipeFile, 'utf-8'))
    expect(recipeYaml).toMatchObject({
      object: 'recipe',
      data: {
        name: 'Ham Sandwich',
        slug: 'ham-sandwich',
      },
    })
  })

  test('updates existing entities without changing file path', async () => {
    await persistence.createSupplier({ name: 'Atlantic Foods' })
    await persistence.createIngredient({
      name: 'Ham',
      category: 'meat',
      purchase: {
        unit: '1kg',
        cost: 5.99,
        vat: false,
      },
      supplier: { uses: 'slug:atlantic-foods' },
    })
    await persistence.createRecipe({
      name: 'Ham Sandwich',
      class: 'menu_item',
      stage: 'active',
      costing: {
        price: 450,
        margin: 30,
        vat: false,
      },
      ingredients: [
        {
          uses: 'slug:ham',
          with: { unit: '50g' },
        },
      ],
    })

    const supplierPath = path.join(
      tempDir,
      'data',
      'suppliers',
      'atlantic-foods.yaml'
    )
    const ingredientPath = path.join(tempDir, 'data', 'ingredients', 'ham.yaml')
    const recipePath = path.join(
      tempDir,
      'data',
      'recipes',
      'ham-sandwich.yaml'
    )

    const supplier = await persistence.updateSupplier('atlantic-foods', {
      name: 'Atlantic Foods Intl',
    })
    const ingredient = await persistence.updateIngredient('ham', {
      name: 'Smoked Ham',
      category: 'meat',
      purchase: {
        unit: '1kg',
        cost: 6.5,
        vat: false,
      },
      supplier: { uses: 'slug:atlantic-foods' },
    })
    const recipe = await persistence.updateRecipe('ham-sandwich', {
      name: 'Ham Sandwich Deluxe',
      class: 'menu_item',
      stage: 'active',
      costing: {
        price: 500,
        margin: 32,
        vat: false,
      },
      ingredients: [
        {
          uses: 'slug:ham',
          with: { unit: '60g' },
        },
      ],
    })

    expect(supplier?.name).toBe('Atlantic Foods Intl')
    expect(ingredient?.name).toBe('Smoked Ham')
    expect(recipe?.name).toBe('Ham Sandwich Deluxe')

    const supplierYaml = YAML.parse(await fs.readFile(supplierPath, 'utf-8'))
    expect(supplierYaml.data.name).toBe('Atlantic Foods Intl')

    const ingredientYaml = YAML.parse(
      await fs.readFile(ingredientPath, 'utf-8')
    )
    expect(ingredientYaml.data.name).toBe('Smoked Ham')

    const recipeYaml = YAML.parse(await fs.readFile(recipePath, 'utf-8'))
    expect(recipeYaml.data.name).toBe('Ham Sandwich Deluxe')
  })

  test('deletes entities and removes files', async () => {
    await persistence.createSupplier({ name: 'Atlantic Foods' })
    await persistence.createIngredient({
      name: 'Ham',
      category: 'meat',
      purchase: {
        unit: '1kg',
        cost: 5.99,
        vat: false,
      },
      supplier: { uses: 'slug:atlantic-foods' },
    })
    await persistence.createRecipe({
      name: 'Ham Sandwich',
      class: 'menu_item',
      stage: 'active',
      costing: {
        price: 450,
        margin: 30,
        vat: false,
      },
      ingredients: [
        {
          uses: 'slug:ham',
          with: { unit: '50g' },
        },
      ],
    })

    const supplierPath = path.join(
      tempDir,
      'data',
      'suppliers',
      'atlantic-foods.yaml'
    )
    const ingredientPath = path.join(tempDir, 'data', 'ingredients', 'ham.yaml')
    const recipePath = path.join(
      tempDir,
      'data',
      'recipes',
      'ham-sandwich.yaml'
    )

    await persistence.deleteRecipe('ham-sandwich')
    await persistence.deleteIngredient('ham')
    await persistence.deleteSupplier('atlantic-foods')

    await expect(fs.access(recipePath)).rejects.toThrow()
    await expect(fs.access(ingredientPath)).rejects.toThrow()
    await expect(fs.access(supplierPath)).rejects.toThrow()
  })
})
