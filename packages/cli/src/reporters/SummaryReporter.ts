import chalk from 'chalk'

import type { RecipeWithIngredients } from '@menubook/core'
import BaseReporter from './BaseReporter'
import type { AggregatedResults, CalculationResult } from './types'

export class SummaryReporter extends BaseReporter {
  onStart(recipes: RecipeWithIngredients<false>[]): void | Promise<void> {
    this.log('')
    this.log(`⚙ Calculating ${recipes.length} recipe(s)...`)
    this.log('')
  }

  onCalculation(
    recipe: RecipeWithIngredients<true>,
    result: CalculationResult,
    aggregated: AggregatedResults
  ): void | Promise<void> {
    // Just show progress indicator
    const icon = result.success ? chalk.green('✓') : chalk.red('✗')
    const name = recipe?.name || result.recipe?.name || 'Unknown'
    this.log(`${icon} ${name}`)

    if (result.failureMessage) {
      this.log(chalk.red(result.failureMessage))
    }
  }

  onFinish(aggregated: AggregatedResults): void | Promise<void> {
    const elapsed = Date.now() - aggregated.startTime
    const succeeded = aggregated.results.filter((r) => r.success)
    const failed = aggregated.results.filter((r) => r.failureMessage)

    this.log('')
    this.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
    this.log(chalk.bold('Summary'))
    this.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
    this.log('')

    // Success/failure counts
    this.log(`${chalk.green('✓')} ${succeeded.length} succeeded`)
    if (failed.length > 0) {
      this.log(`${chalk.red('✗')} ${failed.length} failed`)
    }
    this.log(`⏱ Completed in ${elapsed}ms`)

    // Calculate aggregates from successful results
    if (succeeded.length > 0) {
      const margins = succeeded.map((r) => r.success!.margin.actualMargin)
      const costs = succeeded.map((r) => r.success!.margin.cost)
      const profits = succeeded.map((r) => r.success!.margin.profit)

      const avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length
      const minMargin = Math.min(...margins)
      const maxMargin = Math.max(...margins)

      const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length
      const minCost = Math.min(...costs)
      const maxCost = Math.max(...costs)

      const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length

      const belowTarget = succeeded.filter(
        (r) => !r.success!.margin.meetsTarget
      ).length

      this.log('')
      this.log(chalk.bold('Statistics:'))
      this.log(
        `  Average Margin: ${chalk.cyan(`${avgMargin.toFixed(2)}%`)} (range: ${minMargin.toFixed(2)}% - ${maxMargin.toFixed(2)}%)`
      )
      this.log(
        `  Average Cost: ${chalk.cyan(`£${avgCost.toFixed(2)}`)} (range: £${minCost.toFixed(2)} - £${maxCost.toFixed(2)})`
      )
      this.log(`  Average Profit: ${chalk.cyan(`£${avgProfit.toFixed(2)}`)}`)

      if (belowTarget > 0) {
        this.log('')
        this.log(
          `  ${chalk.yellow('⚠')} ${belowTarget} recipe(s) below target margin`
        )
      }
    }

    this.log('')
  }
}
