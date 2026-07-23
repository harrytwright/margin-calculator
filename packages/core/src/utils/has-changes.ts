/**
 * Generic utility to compare database values with import data
 * Returns true if any values have changed
 */

type ComparisonMap<T, U> = {
  [K in keyof T]?: keyof U | ((importData: U) => T[K] | null | undefined)
}

const isEqual = <T>(a: T, b: T): boolean => {
  if (a === b) {
    return true
  }

  const bothAreObjects =
    a &&
    b &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    Array.isArray(a) === Array.isArray(b)

  return Boolean(
    bothAreObjects &&
    Object.keys(a).length === Object.keys(b).length &&
    Object.entries(a).every(([k, v]) => isEqual(v, b[k as keyof T]))
  )
}

export function hasChanges<TDatabase, TImport>(
  existing: TDatabase | undefined,
  importData: TImport,
  fieldMap: ComparisonMap<TDatabase, TImport>
): boolean {
  if (!existing) {
    return true // New record, definitely has changes
  }

  for (const [dbField, importField] of Object.entries(fieldMap) as Array<
    [keyof TDatabase, keyof TImport | ((data: TImport) => any)]
  >) {
    const dbValue = existing[dbField]
    const importValue =
      typeof importField === 'function'
        ? importField(importData)
        : importData[importField]

    // Normalize null/undefined for comparison
    const normalizedDbValue = dbValue ?? null
    const normalizedImportValue = importValue ?? null

    if (!isEqual(normalizedDbValue, normalizedImportValue)) {
      return true
    }
  }

  return false
}
