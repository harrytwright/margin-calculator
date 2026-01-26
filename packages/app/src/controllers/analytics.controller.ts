import { controller, path } from '@harrytwright/api/dist/core'
import express from 'express'
import AnalyticsServiceImpl from '../services/analytics.service'

/**
 * Analytics controller providing RSQL-based query interface
 *
 * RSQL (RESTful Service Query Language) operators:
 *   ==    equals
 *   !=    not equals
 *   >     greater than
 *   >=    greater than or equal
 *   <     less than
 *   <=    less than or equal
 *   =in=  in list
 *   =out= not in list
 *   ;     AND (combining filters)
 *
 * Example queries:
 *   GET /api/analytics?filter=stage==active
 *   GET /api/analytics?filter=targetMargin>20
 *   GET /api/analytics?filter=class=in=(menu_item,sub_recipe)
 *   GET /api/analytics?filter=stage==active;category==Mains
 *   GET /api/analytics?groupBy=category
 *   GET /api/analytics?filter=stage==active&groupBy=category
 */
@controller('/api/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsServiceImpl) {}

  @path('/')
  async getAnalytics(req: express.Request, res: express.Response) {
    const { filter, groupBy } = req.query

    const result = await this.analytics.query({
      filter: typeof filter === 'string' ? filter : undefined,
      groupBy: typeof groupBy === 'string' ? groupBy : undefined,
    })

    return res.status(200).json(result)
  }
}
