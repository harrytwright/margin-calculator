/**
 * UK/EU 14 allergens bit mapping (stable contract)
 *
 * DO NOT MODIFY UNLESS YOU KNOW WHAT YOU ARE DOING
 * Keep these bit positions unchanged once released.
 *
 * */

export const ALLERGEN_BITS = {
  celery: 0,
  cereals_gluten: 1,
  crustaceans: 2,
  eggs: 3,
  fish: 4,
  lupin: 5,
  milk: 6,
  molluscs: 7,
  mustard: 8,
  peanuts: 9,
  sesame: 10,
  soybeans: 11,
  sulphites: 12,
  tree_nuts: 13,
} as const

export type AllergenSlug = keyof typeof ALLERGEN_BITS

/** Bit flag for a given allergen slug */
export function allergenFlag(slug: AllergenSlug): bigint {
  return 1n << BigInt(ALLERGEN_BITS[slug])
}

/** Turn a list of slugs into a bitmask */
export function slugsToMask(slugs: readonly AllergenSlug[]): bigint {
  let mask = 0n
  for (const slug of slugs) mask |= allergenFlag(slug)
  return mask
}

/** Turn a bitmask into a list of slugs (sorted by bit index) */
export function maskToSlugs(mask: bigint): AllergenSlug[] {
  const entries = Object.entries(ALLERGEN_BITS) as [AllergenSlug, number][]
  entries.sort((a, b) => a[1] - b[1])

  const out: AllergenSlug[] = []
  for (const [slug] of entries) {
    if ((mask & allergenFlag(slug)) !== 0n) out.push(slug)
  }
  return out
}

/** Convenience checks */
export function hasAllergen(mask: bigint, slug: AllergenSlug): boolean {
  return (mask & allergenFlag(slug)) !== 0n
}

export function addAllergen(mask: bigint, slug: AllergenSlug): bigint {
  return mask | allergenFlag(slug)
}

export function removeAllergen(mask: bigint, slug: AllergenSlug): bigint {
  return mask & ~allergenFlag(slug)
}

/** Client-facing display mapping (UI + PDF export) */
export const ALLERGEN_DISPLAY: Record<AllergenSlug, string> = {
  celery: 'Celery',
  cereals_gluten: 'Cereals containing gluten',
  crustaceans: 'Crustaceans',
  eggs: 'Eggs',
  fish: 'Fish',
  lupin: 'Lupin',
  milk: 'Milk',
  molluscs: 'Molluscs',
  mustard: 'Mustard',
  peanuts: 'Peanuts',
  sesame: 'Sesame',
  soybeans: 'Soybeans',
  sulphites: 'Sulphur dioxide / sulphites',
  tree_nuts: 'Tree nuts',
}

/** Optional: FSA-style column order for exports */
export const ALLERGEN_ORDER: AllergenSlug[] = [
  'cereals_gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soybeans',
  'milk',
  'tree_nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
]
