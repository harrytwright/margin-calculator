import { controller, path } from '@harrytwright/api/dist/core'
import { NotFound } from '@hndlr/errors'
import { slugify } from '@menubook/core'
import express from 'express'

import { IngredientApiData, ingredientApiSchema } from '../schemas'
import IngredientServiceImpl from '../services/ingredient.service'
import type { ServerRequest } from '../types/response.json.type'

@controller('/api/ingredients')
export class IngredientsController {
  constructor(private readonly service: IngredientServiceImpl) {}

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
      const supplierSlug = parsed.supplier || 'generic'

      const result = await this.service.create(slug, parsed, supplierSlug)

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
      const supplierSlug = parsed.supplier || 'generic'

      const result = await this.service.update(slug, parsed, supplierSlug)

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

      await this.service.delete(slug)

      return res.status(204).end()
    } catch (error) {
      return next(error)
    }
  }
}
