import BaseReporter from './BaseReporter'
import type { AggregatedResults } from './types'

export class JSONReporter extends BaseReporter {
  onFinish(aggregated: AggregatedResults): void | Promise<void> {
    const output = {
      summary: {
        total: aggregated.numTotal,
        succeeded: aggregated.results.filter((r) => r.success).length,
        failed: aggregated.results.filter((r) => r.failureMessage).length,
        duration: Date.now() - aggregated.startTime,
      },
      results: aggregated.results.map((result) => {
        if (result.failureMessage) {
          return {
            slug: result.recipe?.slug || 'unknown',
            name: result.recipe?.name || 'Unknown',
            success: false,
            error: result.failureMessage,
          }
        }

        const { cost, margin } = result.success!

        return {
          slug: result.recipe.slug,
          name: result.recipe.name,
          success: true,
          cost: {
            total: margin.cost,
            breakdown: cost.tree,
          },
          margin: {
            sellPrice: margin.sellPrice,
            customerPrice: margin.customerPrice,
            vatAmount: margin.vatAmount,
            profit: margin.profit,
            actualMargin: margin.actualMargin,
            targetMargin: margin.targetMargin,
            meetsTarget: margin.meetsTarget,
            vatApplicable: margin.vatApplicable,
          },
        }
      }),
    }

    // Write to stdout (not stderr like log())
    process.stdout.write(JSON.stringify(output, null, 2) + '\n')
  }
}
