import { BackTracking, DFS } from './algorithms'
import type { INode } from './type'

class Node<V extends any = unknown> implements INode {
  constructor(
    public id: string,
    public value: V
  ) {}
}

export class DependencyGraph<T> {
  protected readonly nodes: Map<string, Node<T>>

  protected readonly adjacentEdges: Map<Node<T>, Set<Node<T>>>

  public get size(): number {
    return this.nodes.size
  }

  constructor() {
    this.nodes = new Map([])
    this.adjacentEdges = new Map([])
  }

  clear() {
    this.nodes.clear()
    this.adjacentEdges.clear()
  }

  has(key: string): boolean {
    return this.nodes.has(key)
  }

  get(key: string): T | undefined {
    return this.nodes.get(key)?.value
  }

  setValue(key: string, value: T) {
    if (!this.has(key)) throw MissingNodeError(key, this.setValue)

    // Allow for retrospectively changing a value
    this.nodes.get(key)!.value = value
  }

  addNode(key: string, value: T) {
    const node = new Node(key, value)

    if (this.has(key)) return

    this.nodes.set(key, node)
    this.adjacentEdges.set(node, new Set([]))
  }

  setDependency(from: string, to: string): void {
    if (!this.has(from)) {
      throw MissingNodeError(from, this.setDependency)
    } else if (!this.has(to)) {
      throw MissingNodeError(to, this.setDependency)
    }

    this.adjacentEdges.get(this.nodes.get(from)!)?.add(this.nodes.get(to)!)
  }

  // Back track to find all paths for dependencies inside a service
  find(service: string, inside: string): Node[][] {
    if (!this.has(service)) {
      throw MissingNodeError(service, this.find)
    } else if (!this.has(inside)) {
      throw MissingNodeError(inside, this.find)
    }

    return new BackTracking(this.adjacentEdges).resolve(
      this.nodes.get(inside)!,
      this.nodes.get(service)!
    )
  }

  // Run a DFS to check for all dependencies of a node
  dependencies(of: string, output: 'value'): unknown[]
  dependencies(of: string, output: 'id'): string[]
  dependencies(of: string, output?: 'value' | 'id'): unknown[] | string[]
  dependencies(
    of: string,
    output: 'value' | 'id' | undefined
  ): unknown[] | string[] {
    if (!this.has(of)) {
      throw MissingNodeError(of, this.dependencies)
    }

    const node = this.nodes.get(of)!

    let results = new DFS(this.adjacentEdges).resolve(node)
    const idx = results.indexOf(node)
    if (idx >= 0) {
      results.splice(idx, 1)
    }

    return output
      ? output === 'id'
        ? results.map((el) => el.id)
        : results.map((el) => el.value)
      : results
  }
}

function MissingNodeError(node: string, stackFn?: Function): Error {
  let err = new TypeError(`Cannot find '${node.toString()}' inside graph`)
  stackFn && Error.captureStackTrace(err, stackFn)
  return err
}
