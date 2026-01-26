import { controller, Inject, path } from '@harrytwright/api/dist/core'
import { BadRequest, Conflict, NotFound } from '@hndlr/errors'
import { slugify } from '@menubook/core'
import type { EventEmitter } from 'events'
import express from 'express'
import {
  IngredientApiData,
  ingredientApiSchema,
  toIngredientData,
} from '../schemas'
import IngredientServiceImpl from '../services/ingredient.service'
import SupplierServiceImpl from '../services/supplier.service'
import type { ServerRequest } from '../types/response.json.type'

@controller('/api/ingredients')
export class IngredientsController {
  constructor(
    private readonly service: IngredientServiceImpl,
    private readonly suppliers: SupplierServiceImpl,
    @Inject('events') private readonly events: EventEmitter
  ) {}

  @path('/')
  async getIngredients(req: express.Request, res: express.Response) {
    const data = await this.service.find()
    return res.status(200).json(data)
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

      if (await this.service.exists(slug)) {
        throw new Conflict(`Ingredient with slug '${slug}' already exists`)
      }

      const supplierSlug = parsed.supplier || 'generic'
      if (parsed.supplier && !(await this.suppliers.exists(supplierSlug))) {
        throw new NotFound(`Supplier with slug '${supplierSlug}' not found`)
      }

      const data = toIngredientData(parsed, slug)
      await this.service.upsert(slug, data, supplierSlug)

      const result = await this.service.findById(slug)
      this.events.emit('ingredient.created', result)
      return res.status(201).json(result)
    } catch (error) {
      return next(error)
    }
  }

  @path('/:slug')
  async getIngredientBySlug(req: express.Request, res: express.Response) {
    const { slug } = req.params
    const data = await this.service.findById(slug)

    if (!data) {
      throw new NotFound(`Ingredient with slug '${slug}' not found`)
    }

    return res.status(200).json(data)
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

      if (parsed.slug && parsed.slug !== slug) {
        throw new BadRequest(
          `Slug mismatch: expected '${slug}' but received '${parsed.slug}'`
        )
      }

      if (!(await this.service.exists(slug))) {
        throw new NotFound(`Ingredient with slug '${slug}' not found`)
      }

      const supplierSlug = parsed.supplier || 'generic'
      if (parsed.supplier && !(await this.suppliers.exists(supplierSlug))) {
        throw new NotFound(`Supplier with slug '${supplierSlug}' not found`)
      }

      const data = toIngredientData(parsed, slug)
      await this.service.upsert(slug, data, supplierSlug)

      const result = await this.service.findById(slug)
      this.events.emit('ingredient.updated', result)
      return res.status(200).json(result)
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

      if (!(await this.service.exists(slug))) {
        throw new NotFound(`Ingredient with slug '${slug}' not found`)
      }

      await this.service.delete(slug)
      this.events.emit('ingredient.deleted', slug)
      return res.status(204).end()
    } catch (error) {
      return next(error)
    }
  }
}
