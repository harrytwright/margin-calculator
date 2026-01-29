import { Inject, register } from '@harrytwright/api/dist/core'
import type { DatabaseContext } from '@menubook/core'

import { DemoPersistenceManager } from '../datastore/sqlite.demo'

/**
 * Allowed fields for RSQL filtering on recipes
 * This whitelist prevents querying sensitive data
 */
const ALLOWED_RECIPE_FIELDS = [
  'stage',
  'class',
  'category',
  'sellPrice',
  'targetMargin',
  'includesVat',
  'yieldAmount',
] as const

type AllowedField = (typeof ALLOWED_RECIPE_FIELDS)[number]

/**
 * RSQL operators mapping to SQL operators
 */
const RSQL_OPERATORS: Record<string, string> = {
  '==': '=',
  '!=': '!=',
  '>': '>',
  '>=': '>=',
  '<': '<',
  '<=': '<=',
}

interface ParsedFilter {
  field: AllowedField
  operator: string
  value: string | number | boolean | string[]
}

interface AnalyticsQuery {
  filter?: string
  groupBy?: string
}

interface AnalyticsResult {
  data: Record<string, unknown>[]
  meta: {
    total: number
    groupBy?: string
    filter?: string
  }
}

@register('singleton')
export default class AnalyticsServiceImpl {
  constructor(
    @Inject('database') private readonly ctx: DatabaseContext,
    private readonly demo: DemoPersistenceManager
  ) {}

  private get database() {
    const demoCtx = this.demo.ctx()
    return demoCtx ? demoCtx.db : this.ctx.db
  }

  /**
   * Parse a simple RSQL filter string
   * Supports: ==, !=, >, >=, <, <=, =in=
   * Examples:
   *   - stage==active
   *   - targetMargin>20
   *   - class=in=(menu_item,sub_recipe)
   */
  private parseFilter(filter: string): ParsedFilter[] {
    const filters: ParsedFilter[] = []

    // Split by ; (AND) - for simplicity, we only support AND in v1
    const conditions = filter.split(';').filter(Boolean)

    for (const condition of conditions) {
      // Try to match =in= operator first (list values)
      const inMatch = condition.match(/^(\w+)=in=\(([^)]+)\)$/)
      if (inMatch) {
        const [, field, values] = inMatch
        if (this.isAllowedField(field)) {
          filters.push({
            field: field as AllowedField,
            operator: 'in',
            value: values.split(',').map((v) => v.trim()),
          })
        }
        continue
      }

      // Try to match =out= operator (not in list)
      const outMatch = condition.match(/^(\w+)=out=\(([^)]+)\)$/)
      if (outMatch) {
        const [, field, values] = outMatch
        if (this.isAllowedField(field)) {
          filters.push({
            field: field as AllowedField,
            operator: 'not in',
            value: values.split(',').map((v) => v.trim()),
          })
        }
        continue
      }

      // Match standard operators: ==, !=, >=, <=, >, <
      const standardMatch = condition.match(/^(\w+)(==|!=|>=|<=|>|<)(.+)$/)
      if (standardMatch) {
        const [, field, op, rawValue] = standardMatch
        if (this.isAllowedField(field)) {
          // Try to parse as number
          const numValue = Number(rawValue)
          const value = isNaN(numValue) ? rawValue : numValue

          filters.push({
            field: field as AllowedField,
            operator: RSQL_OPERATORS[op],
            value,
          })
        }
      }
    }

    return filters
  }

  private isAllowedField(field: string): field is AllowedField {
    return ALLOWED_RECIPE_FIELDS.includes(field as AllowedField)
  }

  /**
   * Execute an analytics query on recipes
   */
  async query(params: AnalyticsQuery): Promise<AnalyticsResult> {
    let query = this.database
      .selectFrom('Recipe')
      .leftJoin('Recipe as ParentRecipe', 'Recipe.parentId', 'ParentRecipe.id')

    // Apply filters if provided
    if (params.filter) {
      const filters = this.parseFilter(params.filter)

      for (const filter of filters) {
        const columnName = `Recipe.${filter.field}` as const

        if (filter.operator === 'in' && Array.isArray(filter.value)) {
          query = query.where(columnName as any, 'in', filter.value)
        } else if (
          filter.operator === 'not in' &&
          Array.isArray(filter.value)
        ) {
          query = query.where(columnName as any, 'not in', filter.value)
        } else {
          query = query.where(
            columnName as any,
            filter.operator as any,
            filter.value
          )
        }
      }
    }

    // Handle groupBy aggregation
    if (params.groupBy && this.isAllowedField(params.groupBy)) {
      const groupByColumn = `Recipe.${params.groupBy}` as const

      const results = await query
        .select([
          groupByColumn as any,
          this.database.fn.count<number>('Recipe.id').as('count'),
          this.database.fn.avg<number>('Recipe.sellPrice').as('avgSellPrice'),
          this.database.fn
            .avg<number>('Recipe.targetMargin')
            .as('avgTargetMargin'),
        ])
        .groupBy(groupByColumn as any)
        .execute()

      return {
        data: results as unknown as Record<string, unknown>[],
        meta: {
          total: results.length,
          groupBy: params.groupBy,
          filter: params.filter,
        },
      }
    }

    // Default: return all matching recipes
    const results = await query
      .select([
        'Recipe.id',
        'Recipe.slug',
        'Recipe.name',
        'Recipe.stage',
        'Recipe.class',
        'Recipe.category',
        'Recipe.sellPrice',
        'Recipe.includesVat',
        'Recipe.targetMargin',
        'Recipe.yieldAmount',
        'Recipe.yieldUnit',
        'ParentRecipe.slug as parent',
      ])
      .execute()

    return {
      data: results as unknown as Record<string, unknown>[],
      meta: {
        total: results.length,
        filter: params.filter,
      },
    }
  }
}
