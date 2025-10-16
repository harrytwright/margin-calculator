import { promises as fs } from 'fs'
import type { Dirent } from 'fs'
import path from 'path'

import { FileWriter, type WriteObjectType } from '../../lib/file-writer'
import { Importer } from '../../lib/importer'
import type {
  IngredientImportData,
  RecipeImportData,
  SupplierImportData,
} from '../../schema'
import { slugify } from '../../utils/slugify'
import { IngredientService } from '../../services/ingredient'
import { RecipeService } from '../../services/recipe'
import { SupplierService } from '../../services/supplier'
import type { ServerConfig } from '../index'
import { HttpError } from '../utils/http-error'

interface PersistenceServices {
  supplier: SupplierService
  ingredient: IngredientService
  recipe: RecipeService
}

export class EntityPersistence {
  private readonly fileWriter = new FileWriter()
  private readonly dataRoot: string

  constructor(
    private readonly config: ServerConfig,
    private readonly services: PersistenceServices
  ) {
    this.dataRoot = path.join(config.workingDir, 'data')
  }

  async createSupplier(data: SupplierImportData) {
    const slug = await this.ensureSlug(data.slug, data.name)

    if (await this.services.supplier.exists(slug)) {
      throw new HttpError(409, `Supplier '${slug}' already exists`)
    }

    const dataWithSlug: SupplierImportData = { ...data, slug }
    const filePath = await this.fileWriter.write(
      'supplier',
      slug,
      dataWithSlug,
      this.dataRoot
    )

    await this.importFiles([filePath])

    const record = await this.services.supplier.findById(slug)
    if (!record) {
      throw new HttpError(500, 'Failed to retrieve created supplier')
    }

    return { slug, ...record }
  }

  async createIngredient(data: IngredientImportData) {
    const slug = await this.ensureSlug(data.slug, data.name)

    if (await this.services.ingredient.exists(slug)) {
      throw new HttpError(409, `Ingredient '${slug}' already exists`)
    }

    const dataWithSlug: IngredientImportData = { ...data, slug }
    const filePath = await this.fileWriter.write(
      'ingredient',
      slug,
      dataWithSlug,
      this.dataRoot
    )

    await this.importFiles([filePath])

    const record = await this.services.ingredient.findById(slug)
    if (!record) {
      throw new HttpError(500, 'Failed to retrieve created ingredient')
    }

    return { slug, ...record }
  }

  async createRecipe(data: RecipeImportData) {
    const slug = await this.ensureSlug(data.slug, data.name)

    if (await this.services.recipe.exists(slug)) {
      throw new HttpError(409, `Recipe '${slug}' already exists`)
    }

    const dataWithSlug: RecipeImportData = { ...data, slug }
    const filePath = await this.fileWriter.write(
      'recipe',
      slug,
      dataWithSlug,
      this.dataRoot
    )

    await this.importFiles([filePath])

    const record = await this.services.recipe.findById(slug, true)
    if (!record) {
      throw new HttpError(500, 'Failed to retrieve created recipe')
    }

    return record
  }

  async updateSupplier(slug: string, data: SupplierImportData) {
    if (data.slug && data.slug !== slug) {
      throw new HttpError(
        400,
        `Slug mismatch: expected '${slug}' but received '${data.slug}'`
      )
    }

    if (!(await this.services.supplier.exists(slug))) {
      throw new HttpError(404, `Supplier '${slug}' not found`)
    }

    const existingPath = await this.resolveExistingPath('supplier', slug)
    if (!existingPath) {
      throw new HttpError(404, `Source file for supplier '${slug}' not found`)
    }

    const dataWithSlug: SupplierImportData = { ...data, slug }
    const filePath = await this.fileWriter.write(
      'supplier',
      slug,
      dataWithSlug,
      this.dataRoot,
      existingPath
    )

    await this.importFiles([filePath])

    const record = await this.services.supplier.findById(slug)
    if (!record) {
      throw new HttpError(500, 'Failed to retrieve updated supplier')
    }

    return { slug, ...record }
  }

  async updateIngredient(slug: string, data: IngredientImportData) {
    if (data.slug && data.slug !== slug) {
      throw new HttpError(
        400,
        `Slug mismatch: expected '${slug}' but received '${data.slug}'`
      )
    }

    if (!(await this.services.ingredient.exists(slug))) {
      throw new HttpError(404, `Ingredient '${slug}' not found`)
    }

    const existingPath = await this.resolveExistingPath('ingredient', slug)
    if (!existingPath) {
      throw new HttpError(404, `Source file for ingredient '${slug}' not found`)
    }

    const dataWithSlug: IngredientImportData = { ...data, slug }
    const filePath = await this.fileWriter.write(
      'ingredient',
      slug,
      dataWithSlug,
      this.dataRoot,
      existingPath
    )

    await this.importFiles([filePath])

    const record = await this.services.ingredient.findById(slug)
    if (!record) {
      throw new HttpError(500, 'Failed to retrieve updated ingredient')
    }

    return { slug, ...record }
  }

  async updateRecipe(slug: string, data: RecipeImportData) {
    if (data.slug && data.slug !== slug) {
      throw new HttpError(
        400,
        `Slug mismatch: expected '${slug}' but received '${data.slug}'`
      )
    }

    if (!(await this.services.recipe.exists(slug))) {
      throw new HttpError(404, `Recipe '${slug}' not found`)
    }

    const existingPath = await this.resolveExistingPath('recipe', slug)
    if (!existingPath) {
      throw new HttpError(404, `Source file for recipe '${slug}' not found`)
    }

    const dataWithSlug: RecipeImportData = { ...data, slug }
    const filePath = await this.fileWriter.write(
      'recipe',
      slug,
      dataWithSlug,
      this.dataRoot,
      existingPath
    )

    await this.importFiles([filePath])

    const record = await this.services.recipe.findById(slug, true)
    if (!record) {
      throw new HttpError(500, 'Failed to retrieve updated recipe')
    }

    return record
  }

  async deleteSupplier(slug: string) {
    if (!(await this.services.supplier.exists(slug))) {
      throw new HttpError(404, `Supplier '${slug}' not found`)
    }

    const existingPath = await this.resolveExistingPath('supplier', slug)
    if (!existingPath) {
      throw new HttpError(404, `Source file for supplier '${slug}' not found`)
    }

    await this.fileWriter.deleteFile(existingPath)
    const deleted = await this.services.supplier.delete(slug)

    if (!deleted) {
      throw new HttpError(500, `Failed to delete supplier '${slug}'`)
    }
  }

  async deleteIngredient(slug: string) {
    if (!(await this.services.ingredient.exists(slug))) {
      throw new HttpError(404, `Ingredient '${slug}' not found`)
    }

    const existingPath = await this.resolveExistingPath('ingredient', slug)
    if (!existingPath) {
      throw new HttpError(404, `Source file for ingredient '${slug}' not found`)
    }

    await this.fileWriter.deleteFile(existingPath)
    const deleted = await this.services.ingredient.delete(slug)

    if (!deleted) {
      throw new HttpError(500, `Failed to delete ingredient '${slug}'`)
    }
  }

  async deleteRecipe(slug: string) {
    if (!(await this.services.recipe.exists(slug))) {
      throw new HttpError(404, `Recipe '${slug}' not found`)
    }

    const existingPath = await this.resolveExistingPath('recipe', slug)
    if (!existingPath) {
      throw new HttpError(404, `Source file for recipe '${slug}' not found`)
    }

    await this.fileWriter.deleteFile(existingPath)
    const deleted = await this.services.recipe.delete(slug)

    if (!deleted) {
      throw new HttpError(500, `Failed to delete recipe '${slug}'`)
    }
  }

  private async ensureSlug(
    provided: string | undefined,
    fallbackName: string
  ) {
    return provided && provided.length > 0
      ? provided
      : await slugify(fallbackName)
  }

  private createImporter(importOnly = false) {
    return new Importer(this.config.database, {
      failFast: true,
      importOnly,
      projectRoot: this.dataRoot,
      processors: [
        ['supplier', this.services.supplier],
        ['ingredient', this.services.ingredient],
        ['recipe', this.services.recipe],
      ],
    })
  }

  private async runImport(files: string[], importOnly: boolean) {
    const importer = this.createImporter(importOnly)
    const maxAttempts = 3

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await importer.import(files)
      } catch (error) {
        if (attempt === maxAttempts - 1 || !this.isRecoverableImportError(error)) {
          throw error
        }
        await this.delay(50 * (attempt + 1))
      }
    }
  }

  private async importFiles(files: string[]) {
    await this.runImport(files, false)
  }

  private async resolveExistingPath(
    type: WriteObjectType,
    slug: string
  ): Promise<string | undefined> {
    const defaultPath = path.join(
      this.dataRoot,
      this.folderFor(type),
      `${slug}.yaml`
    )

    if (await this.pathExists(defaultPath)) {
      return defaultPath
    }

    const files = await this.collectYamlFiles(this.dataRoot)
    if (files.length === 0) {
      return undefined
    }

    const result = await this.runImport(files, true)
    const entry = result.resolved?.get(slug)

    if (entry && entry.type === type) {
      return entry.path
    }

    return undefined
  }

  private folderFor(type: WriteObjectType) {
    switch (type) {
      case 'supplier':
        return 'suppliers'
      case 'ingredient':
        return 'ingredients'
      case 'recipe':
        return 'recipes'
      default:
        return ''
    }
  }

  private async pathExists(filePath: string) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private async collectYamlFiles(dir: string): Promise<string[]> {
    let entries: Dirent[]

    try {
      entries = (await fs.readdir(dir, {
        withFileTypes: true,
        encoding: 'utf8',
      })) as Dirent[]
    } catch {
      return []
    }

    const files: string[] = []

    for (const entry of entries) {
      const target = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...(await this.collectYamlFiles(target)))
      } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
        files.push(target)
      }
    }

    return files
  }

  private isRecoverableImportError(error: unknown) {
    if (!(error instanceof Error)) return false
    return /Invalid input: expected object, received/.test(error.message)
  }

  private async delay(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }
}
