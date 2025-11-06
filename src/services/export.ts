import { stringify } from 'csv-stringify/sync'
import { Kysely } from 'kysely'
import YAML from 'yaml'

import type { DB } from '../datastore/types'
import { Calculator } from '../lib/calculation/calculator'
import { IngredientService } from './ingredient'
import { RecipeService } from './recipe'
import { SupplierService } from './supplier'

export interface ExportOptions {
  includeDependencies?: boolean
}

export class ExportService {
  constructor(
    private database: Kysely<DB>,
    private supplier: SupplierService,
    private ingredient: IngredientService,
    private recipe: RecipeService,
    private calculator: Calculator
  ) {}

  /**
   * Export a single supplier to YAML format
   */
  async exportSupplier(slug: string): Promise<string> {
    const supplier = await this.supplier.findById(slug)
    if (!supplier) {
      throw new Error(`Supplier '${slug}' not found`)
    }

    const yamlData = {
      object: 'supplier',
      data: {
        name: supplier.name,
      },
    }

    return YAML.stringify(yamlData)
  }

  /**
   * Export all suppliers to YAML format
   */
  async exportAllSuppliers(): Promise<string> {
    const suppliers = await this.database
      .selectFrom('Supplier')
      .select(['slug', 'name'])
      .orderBy('name')
      .execute()

    const yamlDocs = suppliers.map((supplier) => ({
      object: 'supplier',
      data: {
        name: supplier.name,
      },
    }))

    return yamlDocs.map((doc) => YAML.stringify(doc)).join('---\n')
  }

  /**
   * Export a single ingredient to YAML format
   */
  async exportIngredient(
    slug: string,
    options: ExportOptions = {}
  ): Promise<string | { files: Map<string, string> }> {
    const ingredient = await this.ingredient.findById(slug)
    if (!ingredient) {
      throw new Error(`Ingredient '${ingredient}' not found`)
    }

    const yamlData: any = {
      object: 'ingredient',
      data: {
        name: ingredient.name,
        category: ingredient.category || undefined,
        purchase: {
          unit: ingredient.purchaseUnit,
          cost: ingredient.purchaseCost,
          vat: ingredient.includesVat === 1,
        },
        supplier: ingredient.supplierSlug
          ? { uses: `slug:${ingredient.supplierSlug}` }
          : undefined,
        conversionRate: ingredient.conversionRule || undefined,
        notes: ingredient.notes || undefined,
        lastPurchased: ingredient.lastPurchased || undefined,
      },
    }

    const yamlString = YAML.stringify(yamlData)

    if (options.includeDependencies && ingredient.supplierSlug) {
      const files = new Map<string, string>()
      files.set(`ingredients/${slug}.yaml`, yamlString)

      // Add supplier
      const supplierYaml = await this.exportSupplier(ingredient.supplierSlug)
      files.set(`suppliers/${ingredient.supplierSlug}.yaml`, supplierYaml)

      return { files }
    }

    return yamlString
  }

  /**
   * Export all ingredients to YAML format
   */
  async exportAllIngredients(): Promise<string> {
    const ingredients = await this.database
      .selectFrom('Ingredient')
      .leftJoin('Supplier', 'Ingredient.supplierId', 'Supplier.id')
      .select([
        'Ingredient.slug',
        'Ingredient.name',
        'Ingredient.category',
        'Ingredient.purchaseUnit',
        'Ingredient.purchaseCost',
        'Ingredient.includesVat',
        'Ingredient.conversionRule',
        'Ingredient.notes',
        'Ingredient.lastPurchased',
        'Supplier.slug as supplierSlug',
      ])
      .orderBy('Ingredient.name')
      .execute()

    const yamlDocs = ingredients.map((ingredient) => ({
      object: 'ingredient',
      data: {
        name: ingredient.name,
        category: ingredient.category || undefined,
        purchase: {
          unit: ingredient.purchaseUnit,
          cost: ingredient.purchaseCost,
          vat: ingredient.includesVat === 1,
        },
        supplier: ingredient.supplierSlug
          ? { uses: `slug:${ingredient.supplierSlug}` }
          : undefined,
        conversionRate: ingredient.conversionRule || undefined,
        notes: ingredient.notes || undefined,
        lastPurchased: ingredient.lastPurchased || undefined,
      },
    }))

    return yamlDocs.map((doc) => YAML.stringify(doc)).join('---\n')
  }

  /**
   * Export a single recipe to YAML format
   */
  async exportRecipe(
    slug: string,
    options: ExportOptions = {}
  ): Promise<string | { files: Map<string, string> }> {
    const recipe = await this.recipe.findById(slug, true)
    if (!recipe) {
      throw new Error(`Recipe '${slug}' not found`)
    }

    const yamlData: any = {
      object: 'recipe',
      data: {
        name: recipe.name,
        stage: recipe.stage,
        class: recipe.class,
        category: recipe.category || undefined,
      },
    }

    // Add parent if exists
    if (recipe.parent) {
      yamlData.data.extends = `slug:${recipe.parent}`
    }

    // Add costing
    yamlData.data.costing = {
      price: recipe.sellPrice,
      margin: recipe.targetMargin || undefined,
      vat: recipe.includesVat === 1,
    }

    // Add yield
    if (recipe.yieldAmount && recipe.yieldUnit) {
      yamlData.data.yieldAmount = recipe.yieldAmount
      yamlData.data.yieldUnit = recipe.yieldUnit
    }

    // Add ingredients
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      yamlData.data.ingredients = recipe.ingredients.map((ing) => ({
        uses: `slug:${ing.slug}`,
        with: {
          unit: ing.unit,
          notes: ing.notes || undefined,
        },
      }))
    }

    const yamlString = YAML.stringify(yamlData)

    if (options.includeDependencies) {
      const files = new Map<string, string>()
      files.set(`recipes/${slug}.yaml`, yamlString)

      // Track which suppliers we've already exported
      const exportedSuppliers = new Set<string>()

      // Add all ingredients and their suppliers
      if (recipe.ingredients) {
        for (const ing of recipe.ingredients) {
          if (ing.type === 'ingredient') {
            const ingredientResult = await this.exportIngredient(ing.slug, {
              includeDependencies: false,
            })
            files.set(
              `ingredients/${ing.slug}.yaml`,
              ingredientResult as string
            )

            // Get supplier for this ingredient
            const ingredientData = await this.ingredient.findById(ing.slug)
            if (ingredientData?.supplierSlug) {
              if (!exportedSuppliers.has(ingredientData.supplierSlug)) {
                const supplierYaml = await this.exportSupplier(
                  ingredientData.supplierSlug
                )
                files.set(
                  `suppliers/${ingredientData.supplierSlug}.yaml`,
                  supplierYaml
                )
                exportedSuppliers.add(ingredientData.supplierSlug)
              }
            }
          } else if (ing.type === 'recipe') {
            // Recursively export sub-recipes
            const subRecipeResult = await this.exportRecipe(ing.slug, {
              includeDependencies: true,
            })
            if (typeof subRecipeResult === 'object') {
              // Merge the files
              for (const [path, content] of subRecipeResult.files) {
                files.set(path, content)
              }
            }
          }
        }
      }

      return { files }
    }

    return yamlString
  }

  /**
   * Export all recipes to YAML format
   */
  async exportAllRecipes(): Promise<string> {
    const recipes = await this.database
      .selectFrom('Recipe')
      .select(['slug'])
      .orderBy('name')
      .execute()

    const yamlDocs = []

    for (const { slug } of recipes) {
      const recipe = await this.recipe.findById(slug, true)
      if (!recipe) continue

      const yamlData: any = {
        object: 'recipe',
        data: {
          name: recipe.name,
          stage: recipe.stage,
          class: recipe.class,
          category: recipe.category || undefined,
        },
      }

      // Add parent if exists
      if (recipe.parent) {
        yamlData.data.extends = `slug:${recipe.parent}`
      }

      // Add costing
      yamlData.data.costing = {
        price: recipe.sellPrice,
        margin: recipe.targetMargin || undefined,
        vat: recipe.includesVat === 1,
      }

      // Add yield
      if (recipe.yieldAmount && recipe.yieldUnit) {
        yamlData.data.yieldAmount = recipe.yieldAmount
        yamlData.data.yieldUnit = recipe.yieldUnit
      }

      // Add ingredients
      if (recipe.ingredients && recipe.ingredients.length > 0) {
        yamlData.data.ingredients = recipe.ingredients.map((ing) => ({
          uses: `slug:${ing.slug}`,
          with: {
            unit: ing.unit,
            notes: ing.notes || undefined,
          },
        }))
      }

      yamlDocs.push(yamlData)
    }

    return yamlDocs.map((doc) => YAML.stringify(doc)).join('---\n')
  }

  /**
   * Export complete dataset (all entities)
   */
  async exportAll(): Promise<{ files: Map<string, string> }> {
    const files = new Map<string, string>()

    // Export all suppliers
    const suppliers = await this.database
      .selectFrom('Supplier')
      .select(['slug'])
      .execute()

    for (const { slug } of suppliers) {
      const yaml = await this.exportSupplier(slug)
      files.set(`suppliers/${slug}.yaml`, yaml)
    }

    // Export all ingredients
    const ingredients = await this.database
      .selectFrom('Ingredient')
      .select(['slug'])
      .execute()

    for (const { slug } of ingredients) {
      const yaml = (await this.exportIngredient(slug, {
        includeDependencies: false,
      })) as string
      files.set(`ingredients/${slug}.yaml`, yaml)
    }

    // Export all recipes
    const recipes = await this.database
      .selectFrom('Recipe')
      .select(['slug'])
      .execute()

    for (const { slug } of recipes) {
      const yaml = (await this.exportRecipe(slug, {
        includeDependencies: false,
      })) as string
      files.set(`recipes/${slug}.yaml`, yaml)
    }

    return { files }
  }

  /**
   * Export suppliers to CSV format
   */
  async exportSuppliersCSV(): Promise<string> {
    const suppliers = await this.database
      .selectFrom('Supplier')
      .select(['slug', 'name'])
      .orderBy('name')
      .execute()

    return stringify(suppliers, {
      header: true,
      columns: ['slug', 'name'],
    })
  }

  /**
   * Export ingredients to CSV format
   */
  async exportIngredientsCSV(): Promise<string> {
    const ingredients = await this.database
      .selectFrom('Ingredient')
      .leftJoin('Supplier', 'Ingredient.supplierId', 'Supplier.id')
      .select([
        'Ingredient.slug',
        'Ingredient.name',
        'Ingredient.category',
        'Ingredient.purchaseUnit',
        'Ingredient.purchaseCost',
        'Ingredient.includesVat',
        'Supplier.name as supplierName',
        'Ingredient.conversionRule',
        'Ingredient.notes',
        'Ingredient.lastPurchased',
      ])
      .orderBy('Ingredient.name')
      .execute()

    const rows = ingredients.map((ing) => ({
      slug: ing.slug,
      name: ing.name,
      category: ing.category || '',
      purchaseUnit: ing.purchaseUnit,
      purchaseCost: ing.purchaseCost / 100, // Convert pence to pounds
      includesVat: ing.includesVat === 1 ? 'Yes' : 'No',
      supplier: ing.supplierName || '',
      conversionRule: ing.conversionRule || '',
      notes: ing.notes || '',
      lastPurchased: ing.lastPurchased || '',
    }))

    return stringify(rows, {
      header: true,
      columns: [
        'slug',
        'name',
        'category',
        'purchaseUnit',
        'purchaseCost',
        'includesVat',
        'supplier',
        'conversionRule',
        'notes',
        'lastPurchased',
      ],
    })
  }

  /**
   * Export recipes to CSV format
   */
  async exportRecipesCSV(): Promise<string> {
    const recipes = await this.database
      .selectFrom('Recipe')
      .leftJoin('Recipe as ParentRecipe', 'Recipe.parentId', 'ParentRecipe.id')
      .select([
        'Recipe.slug',
        'Recipe.name',
        'Recipe.class',
        'Recipe.category',
        'Recipe.stage',
        'Recipe.sellPrice',
        'Recipe.includesVat',
        'Recipe.targetMargin',
        'Recipe.yieldAmount',
        'Recipe.yieldUnit',
        'ParentRecipe.name as parentName',
      ])
      .orderBy('Recipe.name')
      .execute()

    const rows = recipes.map((recipe) => ({
      slug: recipe.slug,
      name: recipe.name,
      class: recipe.class,
      category: recipe.category || '',
      stage: recipe.stage,
      sellPrice: recipe.sellPrice / 100, // Convert pence to pounds
      includesVat: recipe.includesVat === 1 ? 'Yes' : 'No',
      targetMargin: recipe.targetMargin || '',
      yieldAmount: recipe.yieldAmount || '',
      yieldUnit: recipe.yieldUnit || '',
      parent: recipe.parentName || '',
    }))

    return stringify(rows, {
      header: true,
      columns: [
        'slug',
        'name',
        'class',
        'category',
        'stage',
        'sellPrice',
        'includesVat',
        'targetMargin',
        'yieldAmount',
        'yieldUnit',
        'parent',
      ],
    })
  }

  /**
   * Export recipes with calculated costs and margins to CSV
   */
  async exportRecipesWithCostsCSV(): Promise<string> {
    const recipes = await this.database
      .selectFrom('Recipe')
      .select(['slug', 'name', 'class', 'category'])
      .orderBy('Recipe.name')
      .execute()

    const rows = []

    for (const recipe of recipes) {
      try {
        const cost = await this.calculator.cost(recipe.slug)
        const margin = await this.calculator.margin(cost)

        rows.push({
          slug: recipe.slug,
          name: recipe.name,
          class: recipe.class,
          category: recipe.category || '',
          cost: margin.cost / 100, // Convert pence to pounds
          sellPrice: margin.sellPrice / 100,
          customerPrice: margin.customerPrice / 100,
          vatAmount: margin.vatAmount / 100,
          profit: margin.profit / 100,
          actualMargin: margin.actualMargin.toFixed(2) + '%',
          targetMargin: margin.targetMargin
            ? margin.targetMargin.toFixed(2) + '%'
            : '',
          meetsTarget: margin.meetsTarget ? 'Yes' : 'No',
        })
      } catch (error) {
        // If calculation fails, include recipe with error indicator
        rows.push({
          slug: recipe.slug,
          name: recipe.name,
          class: recipe.class,
          category: recipe.category || '',
          cost: 'ERROR',
          sellPrice: 'ERROR',
          customerPrice: 'ERROR',
          vatAmount: 'ERROR',
          profit: 'ERROR',
          actualMargin: 'ERROR',
          targetMargin: 'ERROR',
          meetsTarget: 'ERROR',
        })
      }
    }

    return stringify(rows, {
      header: true,
      columns: [
        'slug',
        'name',
        'class',
        'category',
        'cost',
        'sellPrice',
        'customerPrice',
        'vatAmount',
        'profit',
        'actualMargin',
        'targetMargin',
        'meetsTarget',
      ],
    })
  }
}
