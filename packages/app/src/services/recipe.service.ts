/**
 * Could be re-written to use AsyncStorage concept to handle the underlying demo side?
 * */

import { Inject, register } from '@harrytwright/api/dist/core'
import type {
  DatabaseContext,
  RecipeResolvedImportData,
  RecipeWithIngredients,
} from '@menubook/core'
import {
  ConfigService,
  IngredientService,
  RecipeService,
  SupplierService,
} from '@menubook/core'

import IngredientServiceImpl from './ingredient.service'

// Basically a wrapper around the IngredientService to work with the DI side of the webapp
@register('singleton')
export default class RecipeServiceImpl {
  // The shared ingredient service instance. Each method will have a `ctx` parameter, if set, a new service instance
  // will be created for that call and that call only. For use with the demo system.
  readonly recipe: RecipeService = new RecipeService(
    this.ctx,
    this.ingredient.ingredient,
    this.conf
  )

  constructor(
    @Inject('database') private readonly ctx: DatabaseContext,
    @Inject('globalConfig') private readonly conf: ConfigService,
    private readonly ingredient: IngredientServiceImpl
  ) {}

  // Could add a metric here.
  #createDemoService(ctx: DatabaseContext): RecipeService {
    return new RecipeService(
      ctx,
      new IngredientService(ctx, new SupplierService(ctx)),
      this.conf
    )
  }

  delete(slug: string, ctx?: DatabaseContext): Promise<boolean> {
    const service = ctx ? this.#createDemoService(ctx) : this.recipe
    return service.delete(slug)
  }

  exists(slug: string, ctx?: DatabaseContext): Promise<boolean> {
    const service = ctx ? this.#createDemoService(ctx) : this.recipe
    return service.exists(slug)
  }

  upsert(
    slug: string,
    data: RecipeResolvedImportData,
    defaultPriceIncludesVat: boolean = true,
    ctx?: DatabaseContext
  ) {
    const service = ctx ? this.#createDemoService(ctx) : this.recipe
    return service.upsert(slug, data, defaultPriceIncludesVat)
  }

  findById(
    slug: string,
    ctx?: DatabaseContext
  ): Promise<RecipeWithIngredients<true> | undefined>
  findById(
    slug: string,
    withIngredients: true,
    ctx?: DatabaseContext
  ): Promise<RecipeWithIngredients<true> | undefined>
  findById(
    slug: string,
    withIngredients: false,
    ctx?: DatabaseContext
  ): Promise<RecipeWithIngredients<false> | undefined>
  findById(
    slug: string,
    withIngredients?: boolean | DatabaseContext,
    ctx?: DatabaseContext
  ): Promise<
    RecipeWithIngredients<true> | RecipeWithIngredients<false> | undefined
  > {
    if (withIngredients && typeof withIngredients !== 'boolean') {
      ctx = withIngredients
      withIngredients = true
    }

    if (!withIngredients) withIngredients = true

    const service = ctx ? this.#createDemoService(ctx) : this.recipe
    return service.findById(slug, withIngredients)
  }
}
