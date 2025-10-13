import { RecipeService, RecipeWithIngredients } from '../services/recipe'
import { Calculator } from './calculation/calculator'
import type {
  AggregatedResults,
  CalculationResult,
  Reporter,
} from './calculation/reporters/types'

// This could become its own class at some point, but this will work for now
export async function runCalculations(
  calculator: Calculator,
  recipeService: RecipeService,
  slugs: string[],
  reporter: Reporter
): Promise<AggregatedResults> {
  const aggregated: AggregatedResults = {
    startTime: Date.now(),
    results: [],
    numComplete: 0,
    numPending: slugs.length,
    numTotal: slugs.length,
  }

  // Fetch all recipes
  const recipes: RecipeWithIngredients<false>[] = []
  for (const slug of slugs) {
    const r = await recipeService.findById(slug, false)
    if (r) recipes.push(r)
  }

  await reporter.onStart(recipes)

  for (const slug of slugs) {
    const recipeData = await recipeService.findById(slug, true)

    if (!recipeData) {
      const result: CalculationResult = {
        recipe: null as any,
        failureMessage: `Recipe '${slug}' not found`,
      }
      aggregated.results.push(result)
      aggregated.numComplete++
      aggregated.numPending--
      await reporter.onCalculation(null as any, result, aggregated)
      continue
    }

    try {
      const cost = await calculator.cost(slug)
      const margin = await calculator.margin(cost)

      const result: CalculationResult = {
        recipe: recipeData,
        success: { cost, margin },
      }

      aggregated.results.push(result)
      aggregated.numComplete++
      aggregated.numPending--

      await reporter.onCalculation(recipeData, result, aggregated)
    } catch (error: any) {
      const result: CalculationResult = {
        recipe: recipeData,
        failureMessage: error.message,
      }

      aggregated.results.push(result)
      aggregated.numComplete++
      aggregated.numPending--

      await reporter.onCalculation(recipeData, result, aggregated)
    }
  }

  await reporter.onFinish(aggregated)

  return aggregated
}
