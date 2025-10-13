import type { WriteStream } from 'tty'

import chalk from 'chalk'

import BaseReporter from './BaseReporter'

import os from 'os'
import type { RecipeWithIngredients } from '../../../services/recipe'
import { RecipeCostNode } from '../types'
import type { AggregatedResults, CalculationResult } from './types'

type Write = WriteStream['write']

export class DefaultReporter extends BaseReporter {
  onStart(recipes: RecipeWithIngredients<false>[]): void | Promise<void> {
    this.log('')
    this.log(`⚙ Calculating ${recipes.length} recipe(s)...`)
    this.log('')
  }

  onFinish(aggregated: AggregatedResults): void | Promise<void> {
    const elapsed = Date.now() - aggregated.startTime
    const succeeded = aggregated.results.filter((r) => r.success).length
    const failed = aggregated.results.filter((r) => r.failureMessage).length

    this.log('')
    this.log(chalk.bold(`Summary:`))
    this.log('')

    this.log(`${chalk.green('✓')} ${succeeded} succeeded`)
    if (failed > 0) this.log(`${chalk.red('✗')} ${failed} failed`)
    this.log(`⏱ Completed in ${elapsed}ms`)
    this.log(chalk.reset``)
  }

  onCalculation(
    recipe: RecipeWithIngredients<true>,
    result: CalculationResult,
    aggregated: AggregatedResults
  ): void | Promise<void> {
    if (result.failureMessage) return this.logFailureMessage(recipe, result)

    // Assume it's a dodgy failure, just return out. Could log it?
    if (!result.success) return

    const { cost, margin } = result.success

    this.log(`> ${chalk.bold(recipe.name)} (${recipe.slug})`)
    this.log(`${os.EOL}Cost Breakdown:`)
    this.prettyTree(cost.tree)
    this.log(`  ✨ Total Cost: £${margin.cost}`)

    this.log('')
    this.log('Pricing & Margin')
    this.log(`  Sell Price: £${margin.sellPrice} (ex-VAT)`)
    this.log(
      `  Customer Price: £${margin.customerPrice} (${margin.vatApplicable ? `inc VAT £${margin.vatAmount}` : 'VAT not applicable'})`
    )
    this.log(`  Profit: £${margin.profit}`)
    this.log(
      `  Margin: ${(margin.meetsTarget ? chalk.green : chalk.red)(`${margin.actualMargin}%`)} (target: ${margin.targetMargin}%)`
    )

    this.log('')
    this.log(
      chalk.italic`(${aggregated.numComplete}/${aggregated.numTotal} complete)`
    )
    this.log('')
  }

  private prettyTree(
    nodes: RecipeCostNode[],
    depth: number = 0,
    prefix: string = '  '
  ) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const isLast = i === nodes.length - 1

      // Build the current line
      const connector = isLast ? '└── ' : '├── '
      const line =
        prefix +
        connector +
        `${node.name}: £${node.cost} (${node.amount} ${node.unit})`
      this.log(line)

      // Recursively print children with updated prefix
      if (node.children) {
        const childPrefix = prefix + (isLast ? '    ' : '│   ')
        this.prettyTree(node.children, depth + 1, childPrefix)
      }
    }
  }

  private logFailureMessage(
    recipe: RecipeWithIngredients<true>,
    result: CalculationResult
  ): void {
    const name = recipe?.name || result.recipe?.name || 'Unknown'
    this.log(`${chalk.red`✗`} ${chalk.bold(name)}: ${result.failureMessage}`)
  }
}
