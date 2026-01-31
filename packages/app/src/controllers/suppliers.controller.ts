import { controller, path } from '@harrytwright/api/dist/core'
import { NotFound } from '@hndlr/errors'
import { slugify, Supplier } from '@menubook/core'
import express from 'express'

import { Insertable, Updateable } from 'kysely'
import { SupplierMapper } from '../mappers/supplier.mapper'
import { SupplierApiData } from '../schemas'
import SupplierServiceImpl from '../services/supplier.service'
import type { ServerRequest } from '../types/response.json.type'

@controller('/api/suppliers')
export class SuppliersController {
  constructor(
    private readonly service: SupplierServiceImpl,
    private readonly mapper: SupplierMapper
  ) {}

  @path('/')
  async getSuppliers(req: express.Request, res: express.Response) {
    const data = await this.service.find()
    return res.status(200).json(data.map(this.mapper.mapEntityToJSON))
  }

  @path('/')
  async postSupplier(
    req: ServerRequest<never, unknown, SupplierApiData>,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const parsed = this.mapper.mapJSONToEntity(
        req.body
      ) as Insertable<Supplier>
      const slug = parsed.slug || (await slugify(parsed.name))

      const result = await this.service.create(slug, parsed)

      return res.status(201).json(this.mapper.mapEntityToJSON(result))
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

    return res.status(200).json(this.mapper.mapEntityToJSON(data))
  }

  @path('/:slug')
  async putSupplierBySlug(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const { slug } = req.params
      const parsed = this.mapper.mapJSONToEntity(
        req.body
      ) as Updateable<Supplier>

      const result = await this.service.update(slug, parsed)

      return res.status(200).json(this.mapper.mapEntityToJSON(result))
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
