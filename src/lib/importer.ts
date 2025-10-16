import fs from 'fs/promises'
import path from 'path'

import log from '@harrytwright/logger'
import { Kysely } from 'kysely'
import yaml from 'yaml'

import { DB } from '../datastore/types'
import {
  ImportData,
  isIngredientImport,
  isPathReference,
  isRecipeImport,
  isSupplierImport,
  parseImportFile,
  parseReference,
  ResolvedImportData,
} from '../schema'
import { slugify as slugifyUtil } from '../utils/slugify'
import { DependencyGraph } from './graph/dependency'

export type ImportOutcome = 'ignored' | 'upserted' | 'created'
export type ImporterFunction<T> = (
  this: Importer,
  data: T,
  filePath?: string
) => Promise<ImportOutcome>

export type ImportObjectType = ImportData['object']

export interface ResolvedData<T> {
  slug: string
  type: ImportObjectType
  path: string
  data: T
}

export interface ImportStats {
  created: number
  upserted: number
  ignored: number
  failed: number
}

export interface ImportResult {
  stats: ImportStats
  resolved?: Map<string, ResolvedData<ResolvedImportData>>
}

export interface ImportError {
  file: string
  error: string
}

export interface BaseImportOptions {
  failFast?: boolean
  projectRoot?: string // Root directory for @/ references (defaults to cwd)
  processors?: [
    string,
    (
      | ImporterFunction<any>
      | {
          processor: (
            importer: Importer,
            data: any,
            filePath: string | undefined
          ) => Promise<ImportOutcome>
        }
    ),
  ][]
}

export interface ImportOptions extends BaseImportOptions {
  importOnly?: boolean
}

const defaultProjectRoot = process.cwd()

/**
 * Centralized importer for all entity types
 *
 * Supports:
 * - Multiple entity types via processors
 * - Dependency resolution (uses/extends)
 * - Statistics tracking
 * - Error handling with fail-fast mode
 *
 * Usage:
 * ```ts
 * const importer = new Importer(db, { verbose: true })
 *
 * // Register processors
 * importer.addProcessor<SupplierImportData>('supplier', async function(data) {
 *   const slug = data.slug || await this.slugify(data.name)
 *   // ... import logic
 *   return 'created'
 * })
 *
 * // Import files
 * const { stats } = await importer.import(['file1.yaml', 'file2.yaml'])
 * ```
 */
export class Importer {
  private processors = new Map<string, ImporterFunction<any>>()

  private stats: ImportStats = {
    created: 0,
    upserted: 0,
    ignored: 0,
    failed: 0,
  }

  private readonly options: ImportOptions

  private errors: ImportError[] = []

  private graph: DependencyGraph<ImportData> = new DependencyGraph()

  private importedFiles = new Set<string>() // Track already imported files
  private slugMap = new Map<string, string>() // absolutePath -> slug
  private slugToPath = new Map<string, string>() // slug -> absolutePath
  private resolvedDataCache = new Map<string, ResolvedImportData>() // Cache for faster lookup

  constructor(
    public database: Kysely<DB>,
    options: ImportOptions = {}
  ) {
    this.options = {
      failFast: false,
      importOnly: false,
      projectRoot: defaultProjectRoot,
      processors: [],
      ...options,
    }

    this.options.processors?.forEach(([object, processor]) => {
      this.addProcessor(
        object,
        typeof processor === 'function'
          ? processor
          : (data, filePath) => processor.processor(this, data, filePath)
      )
    })
  }
  /**
   * Register a processor for an entity type
   */
  addProcessor<T>(object: string, fn: ImporterFunction<T>): this {
    if (this.processors.has(object)) {
      log.warn(
        'importer',
        `Processor for '${object}' already registered. Overwriting.`
      )
    }

    this.processors.set(object, fn)
    return this
  }

  /**
   * Get a registered processor
   */
  getProcessor<T>(object: string): ImporterFunction<T> | undefined {
    return this.processors.get(object)
  }

  /**
   * Check if a processor is registered
   */
  hasProcessor(object: string): boolean {
    return this.processors.has(object)
  }

  /**
   * Slugify helper (accessible to all processors)
   */
  async slugify(value: string): Promise<string> {
    return slugifyUtil(value)
  }

  /**
   * Ensure slug exists for import data
   * Either uses provided slug or generates from name
   */
  private async ensureSlug(data: ImportData): Promise<string> {
    if ('slug' in data.data && data.data.slug) {
      return data.data.slug
    }

    if ('name' in data.data && typeof data.data.name === 'string') {
      return await this.slugify(data.data.name)
    }

    throw new Error(
      `Cannot generate slug for ${data.object}: missing slug and name fields`
    )
  }

  /**
   * Resolve a reference string to an absolute file path
   * Returns null for slug references (no file path)
   */
  resolveReferenceToPath(currentFile: string, ref: string): string | null {
    const parsed = parseReference(ref)
    const projectRoot = this.options.projectRoot || defaultProjectRoot

    switch (parsed.type) {
      case 'absolute':
        // @/ingredients/ham.yaml → /project/ingredients/ham.yaml
        return path.join(projectRoot, ref.slice(2))

      case 'relative':
        // ./cheese.yaml → resolve from current file's directory
        return path.resolve(path.dirname(currentFile), ref)

      case 'slug':
        // slug:name → no file path, handled via DB lookup
        return null
    }
  }

  /**
   * Resolve a reference to a slug
   * Uses slugMap for path references, extracts slug for slug references
   */
  private async resolveReferenceToSlug(
    fromFile: string,
    ref: string
  ): Promise<string> {
    const parsed = parseReference(ref)

    if (parsed.type === 'slug') {
      // Direct slug reference - extract slug value
      return parsed.slug!
    }

    // Path reference - lookup in slugMap
    const absolutePath = this.resolveReferenceToPath(fromFile, ref)
    if (!absolutePath) {
      throw new Error(`Cannot resolve reference ${ref} to a path`)
    }

    const slug = this.slugMap.get(absolutePath)
    if (!slug) {
      log.error(
        'importer.resolution',
        'Failure to resolve ref %s from %s',
        ref,
        fromFile
      )
      throw new Error(
        `Cannot resolve reference ${ref}: file ${absolutePath} not in dependency graph. Ensure the file exists and is being imported.`
      )
    }

    return slug
  }

  /**
   * Resolve all references in ImportData to slugs
   * Returns ResolvedImportData with all references converted to slugs
   */
  private async resolveReferences(
    data: ImportData,
    filePath: string
  ): Promise<ResolvedImportData> {
    if (this.resolvedDataCache.has(filePath)) {
      return this.resolvedDataCache.get(filePath)!
    }

    const slug = this.slugMap.get(filePath)
    if (!slug) {
      throw new Error(`No slug found for ${filePath}`)
    }

    let resolution: ResolvedImportData | undefined = undefined
    if (isSupplierImport(data)) {
      resolution = {
        ...data.data,
        slug,
      }
    }

    if (isIngredientImport(data)) {
      const resolved: any = {
        ...data.data,
        slug,
      }

      // Resolve supplier reference if present
      if (data.data.supplier) {
        const supplierSlug = await this.resolveReferenceToSlug(
          filePath,
          data.data.supplier.uses
        )
        resolved.supplier = { slug: supplierSlug }
      }

      resolution = resolved
    }

    if (isRecipeImport(data)) {
      const resolved: any = {
        ...data.data,
        slug,
      }

      // Resolve parent recipe reference if present
      if (data.data.extends) {
        resolved.parentSlug = await this.resolveReferenceToSlug(
          filePath,
          data.data.extends
        )
        delete resolved.extends
      }

      // Resolve ingredient references
      resolved.ingredients = await Promise.all(
        data.data.ingredients.map(async (ingredient) => {
          const ingredientSlug = await this.resolveReferenceToSlug(
            filePath,
            ingredient.uses
          )

          const absolutePath = this.resolveReferenceToPath(
            filePath,
            ingredient.uses
          )
          const detectedType =
            (absolutePath && this.graph.get(absolutePath)?.object) ||
            'ingredient'

          return {
            type: detectedType as 'ingredient' | 'recipe',
            slug: ingredientSlug,
            with: ingredient.with,
          }
        })
      )

      resolution = resolved
    }

    if (resolution) {
      this.resolvedDataCache.set(filePath, resolution)
      return resolution
    }

    throw new Error(`Unknown import type: ${(data as any)?.object}`)
  }

  /**
   * Extract all file dependencies from an ImportData object
   * Returns absolute file paths for all path-based references
   */
  extractFileDependencies(data: ImportData, currentFile: string): string[] {
    const paths: string[] = []

    if (isRecipeImport(data)) {
      // extends reference
      if (data.data.extends && isPathReference(data.data.extends)) {
        const resolvedPath = this.resolveReferenceToPath(
          currentFile,
          data.data.extends
        )
        if (resolvedPath) paths.push(resolvedPath)
      }

      // ingredient uses references
      for (const ingredient of data.data.ingredients) {
        if (isPathReference(ingredient.uses)) {
          const resolvedPath = this.resolveReferenceToPath(
            currentFile,
            ingredient.uses
          )
          if (resolvedPath) paths.push(resolvedPath)
        }
      }
    }

    if (isIngredientImport(data)) {
      // supplier reference
      if (data.data.supplier && isPathReference(data.data.supplier.uses)) {
        const resolvedPath = this.resolveReferenceToPath(
          currentFile,
          data.data.supplier.uses
        )
        if (resolvedPath) paths.push(resolvedPath)
      }
    }

    return paths
  }

  /**
   * Build dependency graph by scanning files
   */
  private async buildDependencyGraph(
    files: string[],
    graph: DependencyGraph<ImportData>,
    visited = new Set<string>()
  ): Promise<void> {
    for (const file of files) {
      log.verbose('importer', `Building dependency graph for '%s'`, file)

      const absolutePath = path.isAbsolute(file)
        ? file
        : path.resolve(process.cwd(), file)

      // Skip if already visited
      if (visited.has(absolutePath)) continue
      visited.add(absolutePath)

      try {
        // Read and parse the file
        const content = await fs.readFile(absolutePath, { encoding: 'utf8' })
        const parsed = yaml.parse(content)
        const data = parseImportFile(parsed)

        // Generate slug immediately and store in map
        const slug = await this.ensureSlug(data)
        const previousSlug = this.slugMap.get(absolutePath)
        if (previousSlug && previousSlug !== slug) {
          this.slugToPath.delete(previousSlug)
        }
        this.slugMap.set(absolutePath, slug)
        this.slugToPath.set(slug, absolutePath)

        // Add node to graph with full data
        graph.addNode(absolutePath, data)

        // Extract dependencies
        const dependencies = this.extractFileDependencies(data, absolutePath)

        // Add edges and recursively build graph
        for (const depPath of dependencies) {
          // Add dependency node if not exists
          if (!graph.has(depPath)) {
            await this.buildDependencyGraph([depPath], graph, visited)
          }

          // Add edge: current file depends on depPath
          graph.setDependency(absolutePath, depPath)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        log.warn(
          'importer',
          `Failed to scan ${path.basename(absolutePath)}: ${errorMsg}`
        )

        if (this.options.failFast) {
          throw error
        }
      }
    }
  }

  /**
   * Import multiple files with automatic dependency resolution
   * Uses 3-phase approach:
   * 1. Build dependency graph + generate slugs
   * 2. Resolve all references to slugs
   * 3. Save to database in dependency order
   */
  async import(files: string[]): Promise<ImportResult> {
    // Reset stats for this import run
    this.resetStats()
    const resolved = new Map<string, ResolvedData<ResolvedImportData>>()
    const importOnly = this.options.importOnly ?? false

    // Phase 1: Build dependency graph + generate slugs
    log.verbose('importer', 'Building dependency graph...')

    this.graph = new DependencyGraph<ImportData>()
    await this.buildDependencyGraph(files, this.graph)

    log.verbose('importer', `Found ${this.graph.size} files to import`)

    // Phase 2: Save to the database in dependency order
    log.verbose('importer', 'Saving to database...')

    const processed = new Set<string>()

    const processFile = async (filePath: string) => {
      if (processed.has(filePath)) {
        return
      }
      processed.add(filePath)

      const fileData = this.graph.get(filePath) as ImportData
      const resolvedData = await this.resolveReferences(fileData, filePath)
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath)

      resolved.set(resolvedData.slug, {
        slug: resolvedData.slug,
        type: fileData.object,
        path: absolutePath,
        data: resolvedData,
      })

      if (importOnly) {
        this.importedFiles.add(absolutePath)
        return
      }

      await this.save(filePath, resolvedData, fileData.object)
    }

    for (const filePath of Array.from(this.graph['nodes'].keys())) {
      // Get dependencies in DFS order (as file paths)
      const deps = this.graph.dependencies(filePath, 'id')

      // Save dependencies first
      for (const depPath of deps) {
        await processFile(depPath)
      }

      // Save the file itself
      await processFile(filePath)
    }

    return {
      stats: this.getStats(),
      resolved: importOnly ? resolved : undefined,
    }
  }

  /**
   * Save resolved import data to database
   * Called after all references have been resolved to slugs
   */
  private async save(
    filePath: string,
    data: ResolvedImportData,
    type: 'ingredient' | 'recipe' | 'supplier'
  ): Promise<ImportOutcome | null> {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath)

    // Skip if already saved
    if (this.importedFiles.has(absolutePath)) {
      log.verbose(
        'importer',
        `Skipping already saved: ${path.basename(absolutePath)}`
      )
      return null
    }

    this.importedFiles.add(absolutePath)

    try {
      // Find a processor for this object type
      const processor = this.processors.get(type)
      if (!processor) {
        throw new Error(`No processor registered for object type '${type}'`)
      }

      // Call processor with resolved data
      const result = await processor.call(this, data, absolutePath)

      // Update stats
      this.stats[result]++

      log.verbose('importer', `${result}: ${path.basename(absolutePath)}`)

      return result
    } catch (error) {
      this.stats.failed++
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.errors.push({ file: absolutePath, error: errorMsg })

      if (this.options.failFast) {
        log.error(
          'importer',
          `Failed to save ${path.basename(absolutePath)}: ${errorMsg}`
        )
        throw error
      }

      log.warn(
        'importer',
        `Failed to save ${path.basename(absolutePath)}: ${errorMsg}`
      )
      return null
    }
  }

  /**
   * Get import statistics
   */
  getStats(): ImportStats {
    return { ...this.stats }
  }

  /**
   * Get import errors
   */
  getErrors(): ImportError[] {
    return [...this.errors]
  }

  /**
   * Check if there were any failures
   */
  hasErrors(): boolean {
    return this.errors.length > 0
  }

  /**
   * Get the file path for a given slug
   */
  getPathForSlug(slug: string): string | undefined {
    return this.slugToPath.get(slug)
  }

  /**
   * Get all slug to path mappings
   */
  getAllMappings(): Record<string, string> {
    return Object.fromEntries(this.slugToPath)
  }

  /**
   * Reset statistics (called before each import run)
   */
  private resetStats(): void {
    this.stats = {
      created: 0,
      upserted: 0,
      ignored: 0,
      failed: 0,
    }
    this.errors = []
    this.importedFiles.clear()
    this.slugToPath.clear()
    this.slugMap.clear()
    this.resolvedDataCache.clear()
  }
}
