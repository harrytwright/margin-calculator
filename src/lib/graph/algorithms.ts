import { INode } from './type'

export interface GraphSearch<Result> {
  edges: Map<INode, Set<INode>>

  resolve(...args: any[]): Result | undefined
}

export class BackTracking implements GraphSearch<INode[][]> {
  edges: Map<INode, Set<INode>>

  constructor(edges: Map<INode, Set<INode>>) {
    this.edges = edges
  }

  resolve(start: INode, end: INode): INode[][] {
    const internal = (
      start: INode,
      end: INode,
      path: INode[] = []
    ): INode[][] => {
      path = [...path, start]
      if (start === end) {
        return [path]
      }

      if (!this.edges.has(start)) {
        return []
      }

      const paths = []
      for (const node of this.edges.get(start)!) {
        let newPath = internal(node, end, path)
        for (const path of newPath) {
          path.length && paths.push(path)
        }
      }

      return paths
    }

    return internal(start, end)
  }
}

export class DFS implements GraphSearch<INode[]> {
  edges: Map<INode, Set<INode>>

  visited: Set<INode> = new Set([])

  constructor(edges: Map<INode, Set<INode>>) {
    this.edges = edges
  }

  resolve(start: INode): INode[] {
    if (this.visited.has(start)) return []

    // The current path
    const path: INode[] = []
    const result: INode[] = []

    // The stack
    const stack: { node: INode; processed: boolean }[] = [
      { node: start, processed: false },
    ]

    while (stack.length > 0) {
      const current = peek(stack)
      if (!current.processed) {
        if (this.visited.has(current.node)) {
          stack.pop()
          continue
        } else if (path.includes(current.node)) {
          path.push(current.node)
          throw DFSAlgorithmCycleError(path)
        }

        path.push(current.node)
        const edges = this.edges.get(current.node) ?? new Set([])
        for (const edge of edges) {
          stack.push({ node: edge, processed: false })
        }
        current.processed = true
      } else {
        stack.pop()
        path.pop()

        this.visited.add(current.node)
        if (true) {
          result.push(current.node)
        }
      }
    }

    return result
  }
}

function DFSAlgorithmCycleError(path: Array<INode>) {
  const message =
    'Dependency Cycle Found: ' + path.map((el) => el.id).join(' -> ')
  const err = Object.assign(new Error(message), { path })
  Error.captureStackTrace(err, DFSAlgorithmCycleError)
  return err
}

export function peek<T>(arr: T[]): T {
  return arr[arr.length - 1]
}
