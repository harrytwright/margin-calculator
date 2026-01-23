import { Inject, register } from '@harrytwright/api/dist/core'
import type {
  DatabaseContext,
  SupplierImportData,
  SupplierResolvedImportData,
} from '@menubook/core'
import { SupplierService } from '@menubook/core'
import type { InsertResult } from 'kysely'

// Basically a wrapper around the SupplierService to work with the DI side of the webapp
@register('singleton')
export default class SupplierServiceImpl {
  // The shared supplier service instance. Each method will have a `ctx` parameter, if set, a new service instance
  // will be created for that call and that call only. For use with the demo system.
  readonly supplier: SupplierService = new SupplierService(this.ctx)

  constructor(@Inject('database') private readonly ctx: DatabaseContext) {}

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

  findById(
    slug: string,
    ctx?: DatabaseContext
  ): Promise<{ name: string; id: number } | undefined> {
    const supplier = ctx ? new SupplierService(ctx) : this.supplier
    return supplier.findById(slug)
  }

  find(ctx?: DatabaseContext) {
    const supplier = ctx ? new SupplierService(ctx) : this.supplier
    return supplier.find()
  }
}
