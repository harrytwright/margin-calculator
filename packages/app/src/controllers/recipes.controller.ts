import { controller, Inject, path } from '@harrytwright/api/dist/core'
import { BadRequest, Conflict, NotFound } from '@hndlr/errors'
import { slugify } from '@menubook/core'
import type { EventEmitter } from 'events'
import express from 'express'
import { RecipeApiData, recipeApiSchema, toRecipeData } from '../schemas'
import CalculatorImpl from '../services/calculator.service'
import IngredientServiceImpl from '../services/ingredient.service'
import RecipeServiceImpl from '../services/recipe.service'
import type { ServerRequest } from '../types/response.json.type'

@controller('/api/recipes')
export class RecipesController {
  constructor(
    private readonly service: RecipeServiceImpl,
    private readonly ingredients: IngredientServiceImpl,
    private readonly calculator: CalculatorImpl,
    @Inject('events') private readonly events: EventEmitter
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

      if (await this.service.exists(slug)) {
        throw new Conflict(`Recipe with slug '${slug}' already exists`)
      }

      // Validate parent recipe exists if specified
      if (parsed.extends && !(await this.service.exists(parsed.extends))) {
        throw new NotFound(
          `Parent recipe with slug '${parsed.extends}' not found`
        )
      }

      // Validate price requirement
      if (!parsed.extends && !parsed.costing?.price) {
        throw new BadRequest(
          'costing.price is required when no parent recipe (extends) is specified'
        )
      }

      // Detect ingredient types and validate they exist
      const ingredientTypes = new Map<string, 'ingredient' | 'recipe'>()
      for (const ing of parsed.ingredients) {
        if (ing.type) {
          ingredientTypes.set(ing.slug, ing.type)
        } else {
          // Auto-detect: check ingredient first, then recipe
          if (await this.ingredients.exists(ing.slug)) {
            ingredientTypes.set(ing.slug, 'ingredient')
          } else if (await this.service.exists(ing.slug)) {
            ingredientTypes.set(ing.slug, 'recipe')
          } else {
            throw new NotFound(
              `Ingredient or sub-recipe with slug '${ing.slug}' not found`
            )
          }
        }
      }

      const data = toRecipeData(parsed, slug, ingredientTypes)
      const recipeId = await this.service.upsert(slug, data)

      if (!recipeId) {
        throw new Error('Failed to create recipe')
      }

      await this.service.upsertIngredients(recipeId, data)

      const result = await this.service.findById(slug)

      this.events.emit('recipe.created', result)

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

      if (parsed.slug && parsed.slug !== slug) {
        throw new BadRequest(
          `Slug mismatch: expected '${slug}' but received '${parsed.slug}'`
        )
      }

      const existing = await this.service.findById(slug)
      if (!existing) {
        throw new NotFound(`Recipe with slug '${slug}' not found`)
      }

      // Validate parent recipe exists if specified (and hasn't changed)
      if (parsed.extends && !(await this.service.exists(parsed.extends))) {
        throw new NotFound(
          `Parent recipe with slug '${parsed.extends}' not found`
        )
      }

      // Validate parent is not being changed
      if (existing.parent !== (parsed.extends || null)) {
        throw new BadRequest(
          `Cannot change parent recipe from '${existing.parent}' to '${parsed.extends || null}'. Parent is immutable after creation.`
        )
      }

      // Detect ingredient types and validate they exist
      const ingredientTypes = new Map<string, 'ingredient' | 'recipe'>()
      for (const ing of parsed.ingredients) {
        if (ing.type) {
          ingredientTypes.set(ing.slug, ing.type)
        } else {
          if (await this.ingredients.exists(ing.slug)) {
            ingredientTypes.set(ing.slug, 'ingredient')
          } else if (await this.service.exists(ing.slug)) {
            ingredientTypes.set(ing.slug, 'recipe')
          } else {
            throw new NotFound(
              `Ingredient or sub-recipe with slug '${ing.slug}' not found`
            )
          }
        }
      }

      const data = toRecipeData(parsed, slug, ingredientTypes)
      const recipeId = await this.service.upsert(slug, data)

      if (!recipeId) {
        throw new Error('Failed to update recipe')
      }

      await this.service.upsertIngredients(recipeId, data)

      const result = await this.service.findById(slug)

      this.events.emit('recipe.updated', result)

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

      if (!(await this.service.exists(slug))) {
        throw new NotFound(`Recipe with slug '${slug}' not found`)
      }

      await this.service.delete(slug)

      this.events.emit('recipe.deleted', slug)

      return res.status(204).end()
    } catch (error) {
      return next(error)
    }
  }
}
