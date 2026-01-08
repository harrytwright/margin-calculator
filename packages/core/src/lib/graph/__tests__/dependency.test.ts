import { describe, expect, test } from '@jest/globals'

import { DependencyGraph } from '../dependency'

class Recipe {}
class Ingredient1 {}
class ParentRecipe {}
class Ingredient2 {}
class Ingredient3 {}

describe('DependencyGraph', function () {
  test('should create valid graph', function () {
    const graph = new DependencyGraph()
    expect(graph.size).toEqual(0)
  })

  test('should add nodes', function () {
    const graph = new DependencyGraph()
    graph.addNode('Recipe', function Recipe() {})
    graph.addNode('Ingredient1', function Ingredient1() {})
    graph.addNode('Ingredient2', function Ingredient2() {})
    graph.addNode('ParentRecipe', function ParentRecipe() {})
    graph.addNode('Ingredient3', function Ingredient3() {})

    expect(graph.size).toEqual(5)
  })

  test('should change node value', function () {
    const graph = new DependencyGraph()
    graph.addNode('pepperoni-pizza', Recipe)

    expect(graph.size).toEqual(1)
    expect(graph.get('pepperoni-pizza')).toEqual(Recipe)

    graph.setValue('pepperoni-pizza', Ingredient3)
    expect(graph.size).toEqual(1)
    expect(graph.get('pepperoni-pizza')).toEqual(Ingredient3)
  })

  test('should create basic graph', function () {
    const graph = new DependencyGraph()
    graph.addNode('pepperoni-pizza', Recipe)
    graph.addNode('pepperoni', Ingredient1)

    graph.setDependency('pepperoni-pizza', 'pepperoni')
    expect(graph.dependencies('pepperoni-pizza', 'value')).toEqual([
      Ingredient1,
    ])
  })

  test('should create complex graph', function () {
    const graph = new DependencyGraph()
    graph.addNode('pepperoni-pizza', Recipe)
    graph.addNode('pepperoni', Ingredient1)
    graph.addNode('base-pizza', ParentRecipe)
    graph.addNode('cheese', Ingredient2)
    graph.addNode('tomato-sauce', Ingredient3)

    graph.setDependency('pepperoni-pizza', 'pepperoni')
    graph.setDependency('pepperoni-pizza', 'base-pizza')
    graph.setDependency('base-pizza', 'cheese')
    graph.setDependency('base-pizza', 'tomato-sauce')

    expect(graph.dependencies('pepperoni-pizza', 'value')).toEqual([
      Ingredient3,
      Ingredient2,
      ParentRecipe,
      Ingredient1,
    ])
  })

  test('should throw with circular deps', function () {
    const graph = new DependencyGraph()
    graph.addNode('pepperoni-pizza', Recipe)
    graph.addNode('pepperoni', Ingredient1)
    graph.addNode('base-pizza', ParentRecipe)
    graph.addNode('cheese', Ingredient2)
    graph.addNode('tomato-sauce', Ingredient3)

    graph.setDependency('pepperoni-pizza', 'pepperoni')
    graph.setDependency('pepperoni-pizza', 'base-pizza')
    graph.setDependency('base-pizza', 'cheese')
    graph.setDependency('cheese', 'base-pizza')
    graph.setDependency('base-pizza', 'tomato-sauce')

    expect(() => graph.dependencies('pepperoni-pizza', 'value')).toThrow()
  })
})
