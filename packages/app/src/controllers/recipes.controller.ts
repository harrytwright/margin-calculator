import { controller, path } from '@harrytwright/api/dist/core'
import { NotFound } from '@hndlr/errors'
import { slugify } from '@menubook/core'
import express from 'express'

import { RecipeApiData, recipeApiSchema } from '../schemas'
import CalculatorImpl from '../services/calculator.service'
import RecipeServiceImpl from '../services/recipe.service'
import type { ServerRequest } from '../types/response.json.type'

@controller('/api/recipes')
export class RecipesController {
  constructor(
    private readonly service: RecipeServiceImpl,
    private readonly calculator: CalculatorImpl
  ) {}

  @path('/')
  async getRecipes(req: express.Request, res: express.Response) {
    const data = await this.service.find()
    return res.status(200).json(data)
  }

  @path('/')
  async postRecipe(
    req: ServerRequest<never, unknown, RecipeApiData>,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const parsed = recipeApiSchema.parse(req.body)
      const slug = parsed.slug || (await slugify(parsed.name))

      const result = await this.service.create(slug, parsed)

      return res.status(201).json(result)
    } catch (error) {
      return next(error)
    }
  }

  @path('/:slug')
  async getRecipeBySlug(req: express.Request, res: express.Response) {
    const { slug } = req.params
    const data = await this.service.findById(slug)

    if (!data) {
      throw new NotFound(`Recipe with slug '${slug}' not found`)
    }

    return res.status(200).json(data)
  }

  @path('/:slug/calculate')
  async getRecipeCalculation(req: express.Request, res: express.Response) {
    const { slug } = req.params

    if (!(await this.service.exists(slug))) {
      throw new NotFound(`Recipe with slug '${slug}' not found`)
    }

    const costResult = await this.calculator.cost(slug)
    const marginResult = await this.calculator.margin(costResult)

    return res.status(200).json({
      recipe: slug,
      ...marginResult,
    })
  }

  @path('/:slug')
  async putRecipeBySlug(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const { slug } = req.params
      const parsed = recipeApiSchema.parse(req.body)

      const result = await this.service.update(slug, parsed)

      return res.status(200).json(result)
    } catch (error) {
      return next(error)
    }
  }

  @path('/:slug')
  async deleteRecipeBySlug(
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

  @path('/:slug/ingredients/:ingredientSlug')
  async putRecipeIngredient(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const { slug, ingredientSlug } = req.params
      const { quantity, unit } = req.body

      if (!unit) {
        return res.status(400).json({
          error: { message: 'unit is required' },
        })
      }

      const result = await this.service.addIngredient(slug, ingredientSlug, {
        quantity,
        unit,
      })

      return res.status(200).json(result)
    } catch (error) {
      return next(error)
    }
  }

  @path('/:slug/ingredients/:ingredientSlug')
  async deleteRecipeIngredient(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const { slug, ingredientSlug } = req.params

      const result = await this.service.removeIngredient(slug, ingredientSlug)

      return res.status(200).json(result)
    } catch (error) {
      return next(error)
    }
  }
}
