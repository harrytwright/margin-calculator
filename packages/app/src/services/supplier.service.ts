import { Inject, register } from '@harrytwright/api/dist/core'
import { BadRequest, Conflict, NotFound } from '@hndlr/errors'
import type {
  DatabaseContext,
  SupplierImportData,
  SupplierResolvedImportData,
} from '@menubook/core'
import { SupplierService } from '@menubook/core'
import type { EventEmitter } from 'events'
import type { InsertResult } from 'kysely'
import { DemoPersistenceManager } from '../datastore/sqlite.demo'
import { toSupplierData } from '../schemas'

// Basically a wrapper around the SupplierService to work with the DI side of the webapp
@register('singleton')
export default class SupplierServiceImpl {
  // The shared supplier service instance. Each method will have a `ctx` parameter, if set, a new service instance
  // will be created for that call and that call only. For use with the demo system.
  readonly defaultSupplier: SupplierService = new SupplierService(this.ctx)

  constructor(
    @Inject('database') private readonly ctx: DatabaseContext,
    @Inject('events') private readonly events: EventEmitter,
    private readonly demo: DemoPersistenceManager
  ) {}

  private supplier(ctx?: DatabaseContext): SupplierService {
    const _ctx = ctx || this.demo.ctx()
    return _ctx ? new SupplierService(_ctx) : this.defaultSupplier
  }

  async delete(slug: string, ctx?: DatabaseContext): Promise<boolean> {
    if (!(await this.exists(slug))) {
      throw new NotFound(`Supplier with slug '${slug}' not found`)
    }

    const res = await this.supplier(ctx).delete(slug)

    if (res) this.events.emit('supplier.deleted', slug)

    return res
  }

  exists(slug: string, ctx?: DatabaseContext): Promise<boolean> {
    return this.supplier(ctx).exists(slug)
  }

  upsert(
    slug: string,
    data: SupplierImportData | SupplierResolvedImportData,
    ctx?: DatabaseContext
  ): Promise<InsertResult> {
    return this.supplier(ctx).upsert(slug, data)
  }

  async create(
    slug: string,
    raw: SupplierImportData | SupplierResolvedImportData,
    ctx?: DatabaseContext
  ) {
    if (await this.exists(slug)) {
      throw new Conflict(`Supplier with slug '${slug}' already exists`)
    }

    const data = toSupplierData(raw, slug)
    await this.upsert(slug, data)

    return this.findAndEmit(slug, 'supplier.created', ctx)
  }

  async update(
    slug: string,
    raw: SupplierImportData | SupplierResolvedImportData,
    ctx?: DatabaseContext
  ) {
    if (raw.slug && raw.slug !== slug)
      throw new BadRequest(
        `Slug mismatch: expected '${slug}' but received '${raw.slug}'`
      )

    if (!(await this.exists(slug))) {
      throw new NotFound(`Supplier with slug '${slug}' not found`)
    }

    const data = toSupplierData(raw, slug)
    await this.upsert(slug, data)

    return this.findAndEmit(slug, 'supplier.updated', ctx)
  }

  findById(slug: string, ctx?: DatabaseContext) {
    return this.supplier(ctx).findById(slug)
  }

  find(ctx?: DatabaseContext) {
    return this.supplier(ctx).find()
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
