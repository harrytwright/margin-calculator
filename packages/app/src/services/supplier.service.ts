import { Inject, register } from '@harrytwright/api/dist/core'
import type {
  DatabaseContext,
  SupplierImportData,
  SupplierResolvedImportData,
} from '@menubook/core'
import { SupplierService } from '@menubook/core'
import type { InsertResult } from 'kysely'
import {Conflict} from "@hndlr/errors";
import {toSupplierData} from "../schemas";
import type {EventEmitter} from "events";

// Basically a wrapper around the SupplierService to work with the DI side of the webapp
@register('singleton')
export default class SupplierServiceImpl {
  // The shared supplier service instance. Each method will have a `ctx` parameter, if set, a new service instance
  // will be created for that call and that call only. For use with the demo system.
  readonly supplier: SupplierService = new SupplierService(this.ctx)

  constructor(@Inject('database') private readonly ctx: DatabaseContext, @Inject('events') private readonly events: EventEmitter) {}

  delete(slug: string, ctx?: DatabaseContext): Promise<boolean> {
    const supplier = ctx ? new SupplierService(ctx) : this.supplier
    return supplier.delete(slug)
  }

  exists(slug: string, ctx?: DatabaseContext): Promise<boolean> {
    const supplier = ctx ? new SupplierService(ctx) : this.supplier
    return supplier.exists(slug)
  }

  upsert(
    slug: string,
    data: SupplierImportData | SupplierResolvedImportData,
    ctx?: DatabaseContext
  ): Promise<InsertResult> {
    const supplier = ctx ? new SupplierService(ctx) : this.supplier
    return supplier.upsert(slug, data)
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

    const result = await this.findById(slug)
    this.events.emit('supplier.created', result)
    return this.findById(slug, ctx)
  }

  findById(
    slug: string,
    ctx?: DatabaseContext
  ) {
    const supplier = ctx ? new SupplierService(ctx) : this.supplier
    return supplier.findById(slug)
  }

  find(ctx?: DatabaseContext) {
    const supplier = ctx ? new SupplierService(ctx) : this.supplier
    return supplier.find()
  }
}
