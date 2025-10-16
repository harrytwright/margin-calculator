import path from 'path'

import { FileWriter } from '../../lib/file-writer'
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

  private async importFiles(files: string[]) {
    const importer = this.createImporter(false)
    await importer.import(files)
  }
}
