import { controller, path } from '@harrytwright/api/dist/core'
import { NotFound } from '@hndlr/errors'
import { DBIngredient, DBIngredientWithSupplier, slugify } from '@menubook/core'
import express from 'express'

import { JSONIngredient } from '../mappers/ingredients.mapper'
import { SupplierMapper } from '../mappers/supplier.mapper'
import { IngredientApiData, ingredientApiSchema } from '../schemas'
import IngredientServiceImpl from '../services/ingredient.service'
import RecipeServiceImpl from '../services/recipe.service'
import type { ServerRequest } from '../types/response.json.type'

@controller('/api/ingredients')
export class IngredientsController {
  constructor(
    private readonly service: IngredientServiceImpl,
    private readonly recipes: RecipeServiceImpl,
    private readonly supplierMapper: SupplierMapper
  ) {}

  @path('/')
  async getIngredients(req: express.Request, res: express.Response) {
    const data = await this.service.find()
    return res
      .status(200)
      .json(data.map((el) => mapToData(el, { supplier: this.supplierMapper })))
  }

  @path('/')
  async postIngredient(
    req: ServerRequest<never, unknown, IngredientApiData>,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const parsed = ingredientApiSchema.parse(req.body)
      const slug = parsed.slug || (await slugify(parsed.name))
      const supplierSlug = parsed.supplier || 'generic'

      const result = await this.service.create(slug, parsed, supplierSlug)

      return res
        .status(201)
        .json(mapToData(result, { supplier: this.supplierMapper }))
    } catch (error) {
      return next(error)
    }
  }

  @path('/:slug')
  async getIngredientBySlug(req: express.Request, res: express.Response) {
    const { slug } = req.params
    const expand = req.query.expand === 'supplier'
    const raw = await this.service.findById(slug, expand)

    if (!raw) {
      throw new NotFound(`Ingredient with slug '${slug}' not found`)
    }

    return res
      .status(200)
      .json(mapToData(raw, { supplier: this.supplierMapper }))
  }

  @path('/:slug/recipes')
  async getIngredientRecipes(req: express.Request, res: express.Response) {
    const { slug } = req.params

    if (!(await this.service.exists(slug))) {
      throw new NotFound(`Ingredient with slug '${slug}' not found`)
    }

    const recipes = await this.recipes.findByIngredientSlug(slug)
    return res.status(200).json(recipes)
  }

  @path('/:slug')
  async putIngredientBySlug(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const { slug } = req.params
      const parsed = ingredientApiSchema.parse(req.body)
      const supplierSlug = parsed.supplier || 'generic'

      const result = await this.service.update(slug, parsed, supplierSlug)

      return res
        .status(200)
        .json(mapToData(result, { supplier: this.supplierMapper }))
    } catch (error) {
      return next(error)
    }
  }

  @path('/:slug')
  async deleteIngredientBySlug(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const { slug } = req.params

      await this.service.delete(slug)

      return res.status(204).end()
    } catch (error) {
      return next(error)
    }
  }
}

function mapToData(
  data: DBIngredient | DBIngredientWithSupplier,
  mappers: { supplier: SupplierMapper }
): JSONIngredient {
  return {
    slug: data.slug,
    name: data.name,
    category: data.category,
    notes: data.notes ?? undefined,
    purchase: {
      unit: data.purchaseUnit,
      cost: data.purchaseCost,
      vat: Boolean(data.includesVat),
    },
    conversionRule: data.conversionRule ?? undefined,
    lastPurchased: data.lastPurchased ?? undefined,
    supplier: data.supplierSlug
      ? 'supplierName' in data
        ? mappers.supplier.mapEntityToJSON({
            slug: data.supplierSlug as string,
            name: data.supplierName ?? (data.supplierSlug as string),
            contactName: data.supplierContactName ?? undefined,
            contactEmail: data.supplierContactEmail ?? undefined,
            contactPhone: data.supplierContactPhone ?? undefined,
            notes: data.supplierNotes ?? undefined,
          })
        : data.supplierSlug
      : undefined,
  }
}
