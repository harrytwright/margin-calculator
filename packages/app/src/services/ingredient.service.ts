/**
 * Could be re-written to use AsyncStorage concept to handle the underlying demo side?
 * */

import { Inject, register } from '@harrytwright/api/dist/core'
import type {
  DatabaseContext,
  IngredientImportData,
  IngredientResolvedImportData,
} from '@menubook/core'
import { IngredientService, SupplierService } from '@menubook/core'
import type { InsertResult } from 'kysely'
import SupplierServiceImpl from './supplier.service'

// Basically a wrapper around the IngredientService to work with the DI side of the webapp
@register('singleton')
export default class IngredientServiceImpl {
  // The shared ingredient service instance. Each method will have a `ctx` parameter, if set, a new service instance
  // will be created for that call and that call only. For use with the demo system.
  readonly ingredient: IngredientService = new IngredientService(
    this.ctx,
    this.supplier.supplier
  )

  constructor(
    @Inject('database') private readonly ctx: DatabaseContext,
    private readonly supplier: SupplierServiceImpl
  ) {}

  // Could add a metric here.
  #createDemoService(ctx: DatabaseContext): IngredientService {
    return new IngredientService(ctx, new SupplierService(ctx))
  }

  delete(slug: string, ctx?: DatabaseContext): Promise<boolean> {
    const service = ctx ? this.#createDemoService(ctx) : this.ingredient
    return service.delete(slug)
  }

  exists(slug: string, ctx?: DatabaseContext): Promise<boolean> {
    const service = ctx ? this.#createDemoService(ctx) : this.ingredient
    return service.exists(slug)
  }

  upsert(
    slug: string,
    data: IngredientImportData | IngredientResolvedImportData,
    supplier: string = 'generic',
    ctx?: DatabaseContext
  ): Promise<InsertResult> {
    const service = ctx ? this.#createDemoService(ctx) : this.ingredient
    return service.upsert(slug, data, supplier)
  }

  findById(slug: string, ctx?: DatabaseContext) {
    const service = ctx ? this.#createDemoService(ctx) : this.ingredient
    return service.findById(slug)
  }

  find(ctx?: DatabaseContext) {
    const service = ctx ? this.#createDemoService(ctx) : this.ingredient
    return service.find()
  }
}
