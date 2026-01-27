import { controller, path } from '@harrytwright/api/dist/core'
import { NotFound } from '@hndlr/errors'
import { slugify } from '@menubook/core'
import express from 'express'

import { SupplierApiData, supplierApiSchema } from '../schemas'
import SupplierServiceImpl from '../services/supplier.service'
import type { ServerRequest } from '../types/response.json.type'

@controller('/api/suppliers')
export class SuppliersController {
  constructor(private readonly service: SupplierServiceImpl) {}

  @path('/')
  async getSuppliers(req: express.Request, res: express.Response) {
    const data = await this.service.find()

    // Todo: add an export mapper here, converting database objects to JSONObjects based on OpenAPI Spec

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

      const result = await this.service.create(slug, parsed)

      // Todo: add an export mapper here, converting database objects to JSONObjects based on OpenAPI Spec

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

    // Todo: add an export mapper here, converting database objects to JSONObjects based on OpenAPI Spec

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

      const result = await this.service.update(slug, parsed)

      // Todo: add an export mapper here, converting database objects to JSONObjects based on OpenAPI Spec

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

      await this.service.delete(slug)

      return res.status(204).end()
    } catch (error) {
      return next(error)
    }
  }
}
