import isDate from 'lodash.isdate'
import isEmpty from 'lodash.isempty'
import isPlainObject from 'lodash.isplainobject'
import strftime from 'strftime'

interface Options {
  indent?: number
  newlineAfterSection?: boolean
}

function format(obj: unknown): string {
  return isDate(obj) ? strftime('%FT%TZ', obj) : JSON.stringify(obj)
}

function isArrayOfTables(simplePairs: readonly [string, unknown][]): boolean {
  return simplePairs.some(function (array) {
    const value = array[1]
    return Array.isArray(value) && isPlainObject(value[0])
  })
}

function isObjectArrayOfTables(obj: readonly unknown[]): boolean {
  return Array.isArray(obj) && obj.length === 2 && isPlainObject(obj[1][0])
}

function isLastObjectArrayOfTables(simplePairs: readonly unknown[][]): boolean {
  const array = simplePairs[simplePairs.length - 1]
  return isObjectArrayOfTables(array)
}

function escapeKey(key: string): string {
  return /^[a-zA-Z0-9-_]*$/.test(key) ? key : `"${key}"`
}

export function tomlWriter(hash: object, options: Options = {}): string {
  function visit(hash: object, prefix: string): void {
    const nestedPairs: [string, object][] = []

    const simplePairs: [string, unknown][] = []
    const indentStr = ''.padStart(options.indent || 0, ' ')

    Object.keys(hash).forEach((key) => {
      // @ts-expect-error
      const value = hash[key]

      if (value === undefined) {
        throw new TypeError(
          `Cannot convert \`undefined\` at key "${key}" to TOML.`
        )
      }

      if (value === null) {
        throw new TypeError(`Cannot convert \`null\` at key "${key}" to TOML.`)
      }

      if (
        Array.isArray(value) &&
        value.length > value.filter(() => true).length
      ) {
        throw new TypeError(
          `Cannot convert sparse array at key "${key}" to TOML.`
        )
      }

      ;(isPlainObject(value) ? nestedPairs : simplePairs).push([key, value])
    })

    if (
      !isEmpty(prefix) &&
      !isEmpty(simplePairs) &&
      !isArrayOfTables(simplePairs)
    ) {
      toml += '[' + prefix + ']\n'
    }

    simplePairs.forEach((array) => {
      const key = array[0]
      const value = array[1]

      if (isObjectArrayOfTables(array)) {
        if (simplePairs.indexOf(array) > 0 && options.newlineAfterSection) {
          const lastObj = simplePairs[simplePairs.indexOf(array) - 1]
          if (!isObjectArrayOfTables(lastObj)) {
            toml += '\n'
          }
        }

        // @ts-expect-error Asserted to be an array at this point.
        value.forEach((obj) => {
          if (!isEmpty(prefix)) {
            toml += '[[' + prefix + '.' + key + ']]\n'
          } else {
            toml += '[[' + key + ']]\n'
          }
          visit(obj, '')
        })
      } else {
        toml += indentStr + escapeKey(key) + ' = ' + format(value) + '\n'
      }
    })

    if (
      !isEmpty(simplePairs) &&
      !isLastObjectArrayOfTables(simplePairs) &&
      options.newlineAfterSection
    ) {
      toml += '\n'
    }

    nestedPairs.forEach((array) => {
      const key = array[0]
      const value = array[1]

      visit(
        value,
        isEmpty(prefix)
          ? escapeKey(key.toString())
          : `${prefix}.${escapeKey(key.toString())}`
      )
    })
  }

  let toml = ''

  visit(hash, '')

  return toml
}
