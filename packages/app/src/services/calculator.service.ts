import { Inject, register } from '@harrytwright/api/dist/core'
import {
  Calculator,
  ConfigService,
  DatabaseContext,
  IngredientService,
  RecipeResult,
  RecipeService,
  SupplierService,
} from '@menubook/core'

import { DemoPersistenceManager } from '../datastore/sqlite.demo'
import IngredientServiceImpl from './ingredient.service'
import RecipeServiceImpl from './recipe.service'

@register('singleton')
export default class CalculatorImpl {
  private readonly defaultCalculator: Calculator = new Calculator(
    this.recipe.defaultRecipe,
    this.ingredient.defaultIngredient,
    this.conf
  )

  constructor(
    @Inject('globalConfig') private readonly conf: ConfigService,
    private readonly ingredient: IngredientServiceImpl,
    private readonly recipe: RecipeServiceImpl,
    private readonly demo: DemoPersistenceManager
  ) {}

  private calculator(ctx?: DatabaseContext): Calculator {
    const _ctx = ctx || this.demo.ctx()
    if (_ctx) {
      const supplier = new SupplierService(_ctx)
      const ingredient = new IngredientService(_ctx, supplier)
      return new Calculator(
        new RecipeService(_ctx, ingredient, this.conf),
        ingredient,
        this.conf
      )
    }
    return this.defaultCalculator
  }

  async cost(recipe: string, depth: number = 0, ctx?: DatabaseContext) {
    return this.calculator(ctx).cost(recipe, depth)
  }

  async margin(recipe: RecipeResult, ctx?: DatabaseContext) {
    return this.calculator(ctx).margin(recipe)
  }
}
