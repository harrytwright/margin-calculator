import { controller, Inject, path } from '@harrytwright/api/dist/core'
import { BadRequest, Conflict, NotFound } from '@hndlr/errors'
import { slugify } from '@menubook/core'
import type { EventEmitter } from 'events'
import express from 'express'
import { SupplierApiData, supplierApiSchema, toSupplierData } from '../schemas'
import SupplierServiceImpl from '../services/supplier.service'
import type { ServerRequest } from '../types/response.json.type'

@controller('/api/suppliers')
export class SuppliersController {
  constructor(
    private readonly service: SupplierServiceImpl,
    @Inject('events') private readonly events: EventEmitter
  ) {}

  @path('/')
  async getSuppliers(req: express.Request, res: express.Response) {
    const data = await this.service.find()
    return res.status(200).json(data)
  }

  @path('/')
  async postSupplier(
    req: ServerRequest<never, unknown, SupplierApiData>,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const parsed = supplierApiSchema.parse(req.body)
      const slug = parsed.slug || (await slugify(parsed.name))

      if (await this.service.exists(slug)) {
        throw new Conflict(`Supplier with slug '${slug}' already exists`)
      }

      const data = toSupplierData(parsed, slug)
      await this.service.upsert(slug, data)

      const result = await this.service.findById(slug)
      this.events.emit('supplier.created', result)
      return res.status(201).json(result)
    } catch (error) {
      return next(error)
    }
  }

  @path('/:slug')
  async getSupplierBySlug(req: express.Request, res: express.Response) {
    const { slug } = req.params
    const data = await this.service.findById(slug)

    if (!data) {
      throw new NotFound(`Supplier with slug '${slug}' not found`)
    }

    return res.status(200).json(data)
  }

  @path('/:slug')
  async putSupplierBySlug(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const { slug } = req.params
      const parsed = supplierApiSchema.parse(req.body)

      if (parsed.slug && parsed.slug !== slug) {
        throw new BadRequest(
          `Slug mismatch: expected '${slug}' but received '${parsed.slug}'`
        )
      }

      if (!(await this.service.exists(slug))) {
        throw new NotFound(`Supplier with slug '${slug}' not found`)
      }

      const data = toSupplierData(parsed, slug)
      await this.service.upsert(slug, data)

      const result = await this.service.findById(slug)
      this.events.emit('supplier.updated', result)
      return res.status(200).json(result)
    } catch (error) {
      return next(error)
    }
  }

  @path('/:slug')
  async deleteSupplierBySlug(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const { slug } = req.params

      if (!(await this.service.exists(slug))) {
        throw new NotFound(`Supplier with slug '${slug}' not found`)
      }

      await this.service.delete(slug)

      this.events.emit('supplier.deleted', slug)
      return res.status(204).end()
    } catch (error) {
      return next(error)
    }
  }
}
