import type { CacheAdapter } from '../cache'
import type { DatabaseContext } from '../datastore/context'
import { Calculator } from '../lib/calculation/calculator'
import type { ConfigService } from './config'
import type { IngredientService } from './ingredient'
import type { RecipeService } from './recipe'

export interface DashboardStats {
  totalRecipes: number
  averageMargin: number
  belowTarget: number
  meetsTarget: number
  marginDistribution: {
    range: string
    count: number
  }[]
  topProfitable: {
    name: string
    margin: number
    profit: number
  }[]
  categoryBreakdown: {
    category: string
    count: number
  }[]
}

/** Cache key for dashboard statistics */
const CACHE_KEY = 'dashboard:stats'

/** Default cache TTL: 5 minutes */
const DEFAULT_CACHE_TTL = 5 * 60 * 1000

export interface DashboardServiceOptions {
  /** Cache adapter for storing computed statistics */
  cache?: CacheAdapter
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTTL?: number
}

export class DashboardService {
  private cache?: CacheAdapter
  private cacheTTL: number

  constructor(
    private context: DatabaseContext,
    private recipeService: RecipeService,
    private ingredientService: IngredientService,
    private configService: ConfigService,
    options: DashboardServiceOptions = {}
  ) {
    this.cache = options.cache
    this.cacheTTL = options.cacheTTL ?? DEFAULT_CACHE_TTL
  }

  private get database() {
    return this.context.db
  }

  /**
   * Invalidate the cache to force recalculation on next request.
   * Safe to call even if no cache is configured.
   */
  async invalidateCache(): Promise<void> {
    if (this.cache) {
      await this.cache.delete(CACHE_KEY)
    }
  }

  async getStatistics(): Promise<DashboardStats> {
    // Try to get from cache
    if (this.cache) {
      const cached = await this.cache.get<DashboardStats>(CACHE_KEY)
      if (cached) {
        return cached
      }
    }

    // Cache miss or no cache configured - recalculate
    const stats = await this.calculateStatistics()

    // Store in cache if available
    if (this.cache) {
      await this.cache.set(CACHE_KEY, stats, this.cacheTTL)
    }

    return stats
  }

  private async calculateStatistics(): Promise<DashboardStats> {
    // Fetch all recipes
    const recipes = await this.database
      .selectFrom('Recipe')
      .selectAll()
      .execute()

    if (recipes.length === 0) {
      return this.getEmptyStats()
    }

    // Calculate costs and margins for all recipes
    const calculator = new Calculator(
      this.recipeService,
      this.ingredientService,
      this.configService
    )

    const calculations = await Promise.allSettled(
      recipes
        .filter((r) => r.sellPrice && r.sellPrice > 0)
        .map(async (recipe) => {
          try {
            const costResult = await calculator.cost(recipe.slug)
            const marginResult = await calculator.margin(costResult)
            return {
              recipe,
              ...marginResult,
            }
          } catch (error) {
            return null
          }
        })
    )

    const validCalculations = calculations
      .filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' && result.value !== null
      )
      .map((result) => result.value)

    if (validCalculations.length === 0) {
      return this.getEmptyStats()
    }

    // Calculate statistics
    const defaultMargin = await this.configService.getMarginTarget()
    const totalRecipes = recipes.length
    const margins = validCalculations.map((c) => c.actualMargin)
    const averageMargin =
      margins.reduce((sum, m) => sum + m, 0) / margins.length
    const belowTarget = validCalculations.filter(
      (c) => c.actualMargin < defaultMargin
    ).length
    const meetsTarget = validCalculations.filter(
      (c) => c.actualMargin >= defaultMargin
    ).length

    // Margin distribution (buckets)
    const marginDistribution = this.calculateMarginDistribution(margins)

    // Top 5 profitable recipes
    const topProfitable = validCalculations
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5)
      .map((c) => ({
        name: c.recipe.name,
        margin: c.actualMargin,
        profit: c.profit,
      }))

    // Category breakdown
    const categoryBreakdown = this.calculateCategoryBreakdown(recipes)

    return {
      totalRecipes,
      averageMargin,
      belowTarget,
      meetsTarget,
      marginDistribution,
      topProfitable,
      categoryBreakdown,
    }
  }

  private getEmptyStats(): DashboardStats {
    return {
      totalRecipes: 0,
      averageMargin: 0,
      belowTarget: 0,
      meetsTarget: 0,
      marginDistribution: [],
      topProfitable: [],
      categoryBreakdown: [],
    }
  }

  private calculateMarginDistribution(
    margins: number[]
  ): { range: string; count: number }[] {
    const buckets = [
      { range: '0-20%', min: 0, max: 20, count: 0 },
      { range: '20-40%', min: 20, max: 40, count: 0 },
      { range: '40-60%', min: 40, max: 60, count: 0 },
      { range: '60-80%', min: 60, max: 80, count: 0 },
      { range: '80-100%', min: 80, max: 100, count: 0 },
    ]

    margins.forEach((margin) => {
      const bucket = buckets.find((b) => margin >= b.min && margin < b.max)
      if (bucket) {
        bucket.count++
      } else if (margin >= 100) {
        buckets[buckets.length - 1].count++
      }
    })

    return buckets.map(({ range, count }) => ({ range, count }))
  }

  private calculateCategoryBreakdown(
    recipes: any[]
  ): { category: string; count: number }[] {
    const categories = new Map<string, number>()

    recipes.forEach((recipe) => {
      const category = recipe.category || 'Uncategorized'
      categories.set(category, (categories.get(category) || 0) + 1)
    })

    return Array.from(categories.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
  }
}
