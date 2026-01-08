import { RecipeWithIngredients } from '../../services/recipe'

export interface RecipeCostNode {
  type: 'ingredient' | 'recipe'
  name: string
  amount: number
  unit: string
  cost: number
  children?: RecipeCostNode[]
}

export type RecipeResult = {
  recipe: RecipeWithIngredients<true>
  tree: RecipeCostNode[]
  totalCost: number
}

export interface MarginResult {
  cost: number
  sellPrice: number
  customerPrice: number
  vatAmount: number
  profit: number
  actualMargin: number
  targetMargin: number
  marginDelta: number
  meetsTarget: boolean
  vatApplicable: boolean
}
