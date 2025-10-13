import { WriteStream } from 'tty'

import { AggregatedResults, CalculationResult, Reporter } from './types'

import { RecipeWithIngredients } from '../../../services/recipe'
import isInteractive from '../../../utils/isInteractive'

export default class BaseReporter implements Reporter {
  log(message: string): void {
    process.stderr.write(`${message}\n`)
  }

  onStart(recipes: RecipeWithIngredients<false>[]): void | Promise<void> {}

  onCalculation(
    recipe: RecipeWithIngredients<true>,
    result: CalculationResult,
    aggregated: AggregatedResults
  ): void | Promise<void> {}

  onFinish(aggregated: AggregatedResults): void | Promise<void> {}

  protected __beginSynchronizedUpdate(write: WriteStream['write']): void {
    if (isInteractive) {
      write('\u001B[?2026h')
    }
  }

  protected __endSynchronizedUpdate(write: WriteStream['write']): void {
    if (isInteractive) {
      write('\u001B[?2026l')
    }
  }
}
