import { Inject, register } from '@harrytwright/api/dist/core'
import { BadRequest, Conflict, NotFound } from '@hndlr/errors'
import type {
  DatabaseContext,
  IngredientResolvedImportData,
} from '@menubook/core'
import { IngredientService, SupplierService } from '@menubook/core'
import type { EventEmitter } from 'events'
import type { InsertResult } from 'kysely'

import { DemoPersistenceManager } from '../datastore/sqlite.demo'
import { IngredientApiData, toIngredientData } from '../schemas'
import SupplierServiceImpl from './supplier.service'

// Basically a wrapper around the IngredientService to work with the DI side of the webapp
@register('singleton')
export default class IngredientServiceImpl {
  // The shared ingredient service instance. Each method will have a `ctx` parameter, if set, a new service instance
  // will be created for that call and that call only. For use with the demo system.
  readonly defaultIngredient: IngredientService = new IngredientService(
    this.ctx,
    this.supplier.defaultSupplier
  )

  constructor(
    @Inject('database') private readonly ctx: DatabaseContext,
    @Inject('events') private readonly events: EventEmitter,
    private readonly supplier: SupplierServiceImpl,
    private readonly demo: DemoPersistenceManager
  ) {}

  private ingredient(ctx?: DatabaseContext): IngredientService {
    const _ctx = ctx || this.demo.ctx()
    return _ctx
      ? new IngredientService(_ctx, new SupplierService(_ctx))
      : this.defaultIngredient
  }

  async delete(slug: string, ctx?: DatabaseContext): Promise<boolean> {
    if (!(await this.exists(slug, ctx))) {
      throw new NotFound(`Ingredient with slug '${slug}' not found`)
    }

    const res = await this.ingredient(ctx).delete(slug)

    if (res) this.events.emit('ingredient.deleted', slug)

    return res
  }

  exists(slug: string, ctx?: DatabaseContext): Promise<boolean> {
    return this.ingredient(ctx).exists(slug)
  }

  upsert(
    slug: string,
    data: IngredientResolvedImportData,
    supplierSlug: string = 'generic',
    ctx?: DatabaseContext
  ): Promise<InsertResult> {
    return this.ingredient(ctx).upsert(slug, data, supplierSlug)
  }

  async create(
    slug: string,
    raw: IngredientApiData,
    supplierSlug: string = 'generic',
    ctx?: DatabaseContext
  ) {
    if (await this.exists(slug, ctx)) {
      throw new Conflict(`Ingredient with slug '${slug}' already exists`)
    }

    if (
      supplierSlug !== 'generic' &&
      !(await this.supplier.exists(supplierSlug, ctx))
    ) {
      throw new NotFound(`Supplier with slug '${supplierSlug}' not found`)
    }

    const data = toIngredientData(raw, slug)
    await this.upsert(slug, data, supplierSlug, ctx)

    return this.findAndEmit(slug, 'ingredient.created', ctx)
  }

  async update(
    slug: string,
    raw: IngredientApiData,
    supplierSlug: string = 'generic',
    ctx?: DatabaseContext
  ) {
    if (raw.slug && raw.slug !== slug) {
      throw new BadRequest(
        `Slug mismatch: expected '${slug}' but received '${raw.slug}'`
      )
    }

    if (!(await this.exists(slug, ctx))) {
      throw new NotFound(`Ingredient with slug '${slug}' not found`)
    }

    if (
      supplierSlug !== 'generic' &&
      !(await this.supplier.exists(supplierSlug, ctx))
    ) {
      throw new NotFound(`Supplier with slug '${supplierSlug}' not found`)
    }

    const data = toIngredientData(raw, slug)
    await this.upsert(slug, data, supplierSlug, ctx)

    return this.findAndEmit(slug, 'ingredient.updated', ctx)
  }

  findById(slug: string, ctx?: DatabaseContext) {
    return this.ingredient(ctx).findById(slug)
  }

  find(ctx?: DatabaseContext) {
    return this.ingredient(ctx).find()
  }

  private async findAndEmit(
    slug: string,
    event: string,
    ctx?: DatabaseContext
  ) {
    const result = await this.findById(slug, ctx)
    this.events.emit(event, result)
    return result
  }
}
