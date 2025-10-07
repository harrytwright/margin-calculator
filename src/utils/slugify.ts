/**
 * Wrapper for @sindresorhus/slugify to handle ESM import in CommonJS context
 */

let slugifyFn: ((input: string, options?: any) => string) | null = null

export async function slugify(input: string, options?: any): Promise<string> {
  if (!slugifyFn) {
    const module = await import('@sindresorhus/slugify')
    slugifyFn = module.default
  }
  return slugifyFn(input, options)
}

/**
 * Synchronous version using github-slugger as fallback
 * Use this only if you can't use async/await
 */
export function slugifySync(input: string): string {
  // Simple slugify implementation as fallback
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}
