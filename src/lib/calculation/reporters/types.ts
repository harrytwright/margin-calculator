// import { MarginResult, RecipeResult } from '../../../../example'
import { RecipeWithIngredients } from '../../../services/recipe'
import {RecipeResult, MarginResult} from "../types";

export interface CalculationSuccess {
  cost: RecipeResult
  margin: MarginResult
}

export interface CalculationResult {
  recipe: RecipeWithIngredients<true>
  success?: CalculationSuccess
  failureMessage?: string
}

export interface AggregatedResults {
  startTime: number
  results: CalculationResult[]
  numComplete: number
  numPending: number
  numTotal: number
}

export interface Reporter {
  onStart(recipes: RecipeWithIngredients<false>[]): void | Promise<void>
  onCalculation(
    recipe: RecipeWithIngredients<true>,
    result: CalculationResult,
    aggregated: AggregatedResults
  ): void | Promise<void>
  onFinish(aggregated: AggregatedResults): void | Promise<void>
}
