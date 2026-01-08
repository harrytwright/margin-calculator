import { BackTracking, DFS, peek } from '../algorithms'
import { INode } from '../type'

describe('peek', () => {
  it('should return the last element of an array', () => {
    expect(peek([1, 2, 3])).toBe(3)
    expect(peek(['a', 'b', 'c'])).toBe('c')
  })

  it('should return undefined for empty array', () => {
    expect(peek([])).toBeUndefined()
  })

  it('should return the only element for single-element array', () => {
    expect(peek([42])).toBe(42)
  })
})

describe('BackTracking', () => {
  function createNode(id: string): INode {
    return { id, value: null }
  }

  describe('simple paths', () => {
    it('should find a direct path between two nodes', () => {
      const nodeA = createNode('A')
      const nodeB = createNode('B')

      const edges = new Map<INode, Set<INode>>()
      edges.set(nodeA, new Set([nodeB]))

      const bt = new BackTracking(edges)
      const paths = bt.resolve(nodeA, nodeB)

      expect(paths).toEqual([[nodeA, nodeB]])
    })

    it('should find a path through intermediate nodes', () => {
      const nodeA = createNode('A')
      const nodeB = createNode('B')
      const nodeC = createNode('C')

      const edges = new Map<INode, Set<INode>>()
      edges.set(nodeA, new Set([nodeB]))
      edges.set(nodeB, new Set([nodeC]))

      const bt = new BackTracking(edges)
      const paths = bt.resolve(nodeA, nodeC)

      expect(paths).toEqual([[nodeA, nodeB, nodeC]])
    })

    it('should return path with single node when start equals end', () => {
      const nodeA = createNode('A')

      const edges = new Map<INode, Set<INode>>()
      const bt = new BackTracking(edges)
      const paths = bt.resolve(nodeA, nodeA)

      expect(paths).toEqual([[nodeA]])
    })
  })

  describe('multiple paths', () => {
    it('should find all paths between nodes', () => {
      const nodeA = createNode('A')
      const nodeB = createNode('B')
      const nodeC = createNode('C')
      const nodeD = createNode('D')

      // A -> B -> D
      // A -> C -> D
      const edges = new Map<INode, Set<INode>>()
      edges.set(nodeA, new Set([nodeB, nodeC]))
      edges.set(nodeB, new Set([nodeD]))
      edges.set(nodeC, new Set([nodeD]))

      const bt = new BackTracking(edges)
      const paths = bt.resolve(nodeA, nodeD)

      expect(paths).toHaveLength(2)
      expect(paths).toContainEqual([nodeA, nodeB, nodeD])
      expect(paths).toContainEqual([nodeA, nodeC, nodeD])
    })

    it('should find paths of different lengths', () => {
      const nodeA = createNode('A')
      const nodeB = createNode('B')
      const nodeC = createNode('C')
      const nodeD = createNode('D')

      // A -> D (direct)
      // A -> B -> C -> D (longer)
      const edges = new Map<INode, Set<INode>>()
      edges.set(nodeA, new Set([nodeB, nodeD]))
      edges.set(nodeB, new Set([nodeC]))
      edges.set(nodeC, new Set([nodeD]))

      const bt = new BackTracking(edges)
      const paths = bt.resolve(nodeA, nodeD)

      expect(paths).toHaveLength(2)
      expect(paths).toContainEqual([nodeA, nodeD])
      expect(paths).toContainEqual([nodeA, nodeB, nodeC, nodeD])
    })
  })

  describe('no path scenarios', () => {
    it('should return empty array when no path exists', () => {
      const nodeA = createNode('A')
      const nodeB = createNode('B')
      const nodeC = createNode('C')

      // A -> B (B and C are disconnected)
      const edges = new Map<INode, Set<INode>>()
      edges.set(nodeA, new Set([nodeB]))

      const bt = new BackTracking(edges)
      const paths = bt.resolve(nodeA, nodeC)

      expect(paths).toEqual([])
    })

    it('should return empty array when start node has no edges', () => {
      const nodeA = createNode('A')
      const nodeB = createNode('B')

      const edges = new Map<INode, Set<INode>>()
      const bt = new BackTracking(edges)
      const paths = bt.resolve(nodeA, nodeB)

      expect(paths).toEqual([])
    })
  })

  describe('complex graphs', () => {
    it('should handle diamond-shaped graph', () => {
      const nodeA = createNode('A')
      const nodeB = createNode('B')
      const nodeC = createNode('C')
      const nodeD = createNode('D')

      //   A
      //  / \
      // B   C
      //  \ /
      //   D
      const edges = new Map<INode, Set<INode>>()
      edges.set(nodeA, new Set([nodeB, nodeC]))
      edges.set(nodeB, new Set([nodeD]))
      edges.set(nodeC, new Set([nodeD]))

      const bt = new BackTracking(edges)
      const paths = bt.resolve(nodeA, nodeD)

      expect(paths).toHaveLength(2)
      expect(paths).toContainEqual([nodeA, nodeB, nodeD])
      expect(paths).toContainEqual([nodeA, nodeC, nodeD])
    })
  })
})

describe('DFS', () => {
  function createNode(id: string): INode {
    return { id, value: null }
  }

  describe('simple traversals', () => {
    it('should traverse a single node', () => {
      const nodeA = createNode('A')

      const edges = new Map<INode, Set<INode>>()
      const dfs = new DFS(edges)
      const result = dfs.resolve(nodeA)

      expect(result).toEqual([nodeA])
    })

    it('should traverse a linear chain', () => {
      const nodeA = createNode('A')
      const nodeB = createNode('B')
      const nodeC = createNode('C')

      // A -> B -> C
      const edges = new Map<INode, Set<INode>>()
      edges.set(nodeA, new Set([nodeB]))
      edges.set(nodeB, new Set([nodeC]))

      const dfs = new DFS(edges)
      const result = dfs.resolve(nodeA)

      // DFS should visit in depth-first order
      expect(result).toHaveLength(3)
      expect(result).toContain(nodeA)
      expect(result).toContain(nodeB)
      expect(result).toContain(nodeC)
    })

    it('should not revisit already visited nodes', () => {
      const nodeA = createNode('A')
      const edges = new Map<INode, Set<INode>>()

      const dfs = new DFS(edges)
      dfs.resolve(nodeA)

      // Second call should return empty since A is already visited
      const result = dfs.resolve(nodeA)
      expect(result).toEqual([])
    })
  })

  describe('tree traversals', () => {
    it('should traverse a binary tree', () => {
      const nodeA = createNode('A')
      const nodeB = createNode('B')
      const nodeC = createNode('C')
      const nodeD = createNode('D')
      const nodeE = createNode('E')

      //     A
      //    / \
      //   B   C
      //  / \
      // D   E
      const edges = new Map<INode, Set<INode>>()
      edges.set(nodeA, new Set([nodeB, nodeC]))
      edges.set(nodeB, new Set([nodeD, nodeE]))

      const dfs = new DFS(edges)
      const result = dfs.resolve(nodeA)

      expect(result).toHaveLength(5)
      expect(result).toContain(nodeA)
      expect(result).toContain(nodeB)
      expect(result).toContain(nodeC)
      expect(result).toContain(nodeD)
      expect(result).toContain(nodeE)
    })

    it('should handle diamond-shaped DAG', () => {
      const nodeA = createNode('A')
      const nodeB = createNode('B')
      const nodeC = createNode('C')
      const nodeD = createNode('D')

      //   A
      //  / \
      // B   C
      //  \ /
      //   D
      const edges = new Map<INode, Set<INode>>()
      edges.set(nodeA, new Set([nodeB, nodeC]))
      edges.set(nodeB, new Set([nodeD]))
      edges.set(nodeC, new Set([nodeD]))

      const dfs = new DFS(edges)
      const result = dfs.resolve(nodeA)

      // D should appear only once even though it has two parents
      expect(result).toHaveLength(4)
      expect(result.filter((n) => n.id === 'D')).toHaveLength(1)
    })
  })

  describe('cycle detection', () => {
    it('should detect a simple cycle', () => {
      const nodeA = createNode('A')
      const nodeB = createNode('B')

      // A -> B -> A (cycle)
      const edges = new Map<INode, Set<INode>>()
      edges.set(nodeA, new Set([nodeB]))
      edges.set(nodeB, new Set([nodeA]))

      const dfs = new DFS(edges)

      expect(() => dfs.resolve(nodeA)).toThrow('Dependency Cycle Found')
    })

    it('should detect a cycle in a longer chain', () => {
      const nodeA = createNode('A')
      const nodeB = createNode('B')
      const nodeC = createNode('C')

      // A -> B -> C -> A (cycle)
      const edges = new Map<INode, Set<INode>>()
      edges.set(nodeA, new Set([nodeB]))
      edges.set(nodeB, new Set([nodeC]))
      edges.set(nodeC, new Set([nodeA]))

      const dfs = new DFS(edges)

      expect(() => dfs.resolve(nodeA)).toThrow('Dependency Cycle Found')
    })

    it('should include the cycle path in error', () => {
      const nodeA = createNode('A')
      const nodeB = createNode('B')
      const nodeC = createNode('C')

      // A -> B -> C -> B (cycle)
      const edges = new Map<INode, Set<INode>>()
      edges.set(nodeA, new Set([nodeB]))
      edges.set(nodeB, new Set([nodeC]))
      edges.set(nodeC, new Set([nodeB]))

      const dfs = new DFS(edges)

      try {
        dfs.resolve(nodeA)
        fail('Should have thrown cycle error')
      } catch (error: any) {
        expect(error.path).toBeDefined()
        expect(error.path.length).toBeGreaterThan(2)
        expect(error.message).toContain('A -> B -> C -> B')
      }
    })

    it('should detect self-loop', () => {
      const nodeA = createNode('A')

      // A -> A (self-loop)
      const edges = new Map<INode, Set<INode>>()
      edges.set(nodeA, new Set([nodeA]))

      const dfs = new DFS(edges)

      expect(() => dfs.resolve(nodeA)).toThrow('Dependency Cycle Found')
    })
  })

  describe('disconnected graphs', () => {
    it('should only traverse reachable nodes', () => {
      const nodeA = createNode('A')
      const nodeB = createNode('B')
      const nodeC = createNode('C')
      const nodeD = createNode('D')

      // A -> B, C -> D (two disconnected components)
      const edges = new Map<INode, Set<INode>>()
      edges.set(nodeA, new Set([nodeB]))
      edges.set(nodeC, new Set([nodeD]))

      const dfs = new DFS(edges)
      const result = dfs.resolve(nodeA)

      expect(result).toHaveLength(2)
      expect(result).toContain(nodeA)
      expect(result).toContain(nodeB)
      expect(result).not.toContain(nodeC)
      expect(result).not.toContain(nodeD)
    })
  })

  describe('topological ordering', () => {
    it('should return nodes in valid topological order', () => {
      const nodeA = createNode('A')
      const nodeB = createNode('B')
      const nodeC = createNode('C')

      // A -> B -> C
      const edges = new Map<INode, Set<INode>>()
      edges.set(nodeA, new Set([nodeB]))
      edges.set(nodeB, new Set([nodeC]))

      const dfs = new DFS(edges)
      const result = dfs.resolve(nodeA)

      // In a valid topological order, C should come before B, and B before A
      const indexA = result.indexOf(nodeA)
      const indexB = result.indexOf(nodeB)
      const indexC = result.indexOf(nodeC)

      expect(indexC).toBeLessThan(indexB)
      expect(indexB).toBeLessThan(indexA)
    })

    it('should handle dependencies with common child', () => {
      const nodeA = createNode('A')
      const nodeB = createNode('B')
      const nodeC = createNode('C')
      const nodeD = createNode('D')

      //   A
      //  / \
      // B   C
      //  \ /
      //   D
      const edges = new Map<INode, Set<INode>>()
      edges.set(nodeA, new Set([nodeB, nodeC]))
      edges.set(nodeB, new Set([nodeD]))
      edges.set(nodeC, new Set([nodeD]))

      const dfs = new DFS(edges)
      const result = dfs.resolve(nodeA)

      // D should come before both B and C
      const indexA = result.indexOf(nodeA)
      const indexB = result.indexOf(nodeB)
      const indexC = result.indexOf(nodeC)
      const indexD = result.indexOf(nodeD)

      expect(indexD).toBeLessThan(indexB)
      expect(indexD).toBeLessThan(indexC)
      expect(indexB).toBeLessThan(indexA)
      expect(indexC).toBeLessThan(indexA)
    })
  })
})
