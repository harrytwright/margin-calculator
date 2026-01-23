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

import IngredientServiceImpl from './ingredient.service'
import RecipeServiceImpl from './recipe.service'

@register('singleton')
export default class CalculatorImpl {
  private readonly calculator: Calculator = new Calculator(
    this.recipe.recipe,
    this.ingredient.ingredient,
    this.conf
  )

  constructor(
    @Inject('globalConfig') private readonly conf: ConfigService,
    private readonly ingredient: IngredientServiceImpl,
    private readonly recipe: RecipeServiceImpl
  ) {}

  #createDemoService(ctx: DatabaseContext): Calculator {
    const supplier = new SupplierService(ctx)
    const ingredient = new IngredientService(ctx, supplier)
    return new Calculator(
      new RecipeService(ctx, ingredient, this.conf),
      ingredient,
      this.conf
    )
  }

  async cost(recipe: string, depth: number = 0, ctx?: DatabaseContext) {
    const service = ctx ? this.#createDemoService(ctx) : this.calculator
    return service.cost(recipe, depth)
  }

  async margin(recipe: RecipeResult, ctx?: DatabaseContext) {
    const service = ctx ? this.#createDemoService(ctx) : this.calculator
    return service.margin(recipe)
  }
}
