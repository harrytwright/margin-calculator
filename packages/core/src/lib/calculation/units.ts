import configureMeasurements from 'convert-units'
import pluralize from 'pluralize'

import log from '@harrytwright/logger'
import allMeasures, {
  AllMeasures,
  AllMeasuresSystems,
  AllMeasuresUnits,
} from 'convert-units/definitions/all'
import { Branded } from '../../types'

const convert = configureMeasurements<
  AllMeasures,
  AllMeasuresSystems,
  AllMeasuresUnits
>(allMeasures)

const descriptivePatterns = ['to taste', 'pinch', 'handful', 'dash', 'splash']

export type Unit = {
  amount: number
  unit: string
}

export type Range = Branded<Unit, 'range'>

export type Fraction = Branded<Unit, 'fraction'>

export type Default = Branded<Unit, 'default'>

export type Custom = Branded<Unit, 'custom'>

export function parseUnit(
  str: string
): Range | Fraction | Default | Custom | null {
  const cleaned = str.trim().replace(/\s+/g, ' ')
  if (
    descriptivePatterns.some((pattern) =>
      cleaned.toLowerCase().includes(pattern)
    )
  )
    return null

  const isRange = cleaned.match(/^([\d.]+)-([\d.]+)\s*(.+)$/)
  if (isRange) {
    const [, min, max, unit] = isRange
    // Validate that unit is meaningful (contains at least one letter)
    if (!/[a-zA-Z]/.test(unit)) return null
    const amount = Math.max(parseFloat(min), parseFloat(max))
    return { amount, unit: unit.toLowerCase() } as Range
  }

  const isFraction = cleaned.match(/^(\d+)\s+(\d+)\/(\d+)\s*(.+)$/)
  if (isFraction) {
    const [, whole, num, den, unit] = isFraction
    const amount = parseInt(whole) + parseInt(num) / parseInt(den)
    return { amount, unit: unit.toLowerCase() } as Fraction
  }

  const match = cleaned.match(/^([\d.\/]+)\s*(.+)$/)
  if (!match) return null

  const [, amountStr, unit] = match

  // Validate that unit is meaningful (contains at least one letter)
  if (!/[a-zA-Z]/.test(unit)) return null

  // Handle fractions (e.g., "1/2 cup")
  let amount: number
  if (amountStr.includes('/')) {
    const [num, den] = amountStr.split('/').map(Number)
    amount = num / den
  } else {
    amount = parseFloat(amountStr)
  }

  // @ts-ignore
  if (convert().possibilities().includes(unit))
    return { amount, unit: unit.toLowerCase() } as Default

  return { amount, unit: unit.toLowerCase() } as Custom
}

export function parseConversionRule(
  rule: string
): { from: Unit; to: Unit } | null {
  // Parse "1 loaf = 16 slices" format
  const match = rule.match(/^([\d.]+)\s*(.+?)\s*=\s*([\d.]+)\s*(.+)$/)

  if (!match) return null

  const [, fromAmountStr, fromUnit, toAmountStr, toUnit] = match

  return {
    from: {
      amount: parseFloat(fromAmountStr),
      unit: pluralize.singular(fromUnit.trim().toLowerCase()),
    },
    to: {
      amount: parseFloat(toAmountStr),
      unit: pluralize.singular(toUnit.trim().toLowerCase()),
    },
  }
}

export function convertUnits(
  from: Unit,
  to: string,
  conversionRule?: string
): number | null {
  const normalizedFrom = pluralize.singular(from.unit)
  const normalizedTo = pluralize.singular(to)

  // If units are the same after normalization, no conversion needed
  if (normalizedFrom === normalizedTo) {
    return from.amount
  }

  try {
    return convert(from.amount).from(normalizedFrom).to(normalizedTo)
  } catch (e) {
    log.silly(
      'unit.conversion',
      'No standard conversion available for %s -> %s',
      normalizedFrom,
      normalizedTo
    )
  }

  if (conversionRule) {
    const rule = parseConversionRule(conversionRule)
    if (rule == null) return null

    if (rule.from.unit === normalizedFrom && rule.to.unit === normalizedTo) {
      const ratio = rule.to.amount / rule.from.amount
      return from.amount * ratio
    } else if (
      rule.from.unit === normalizedTo &&
      rule.to.unit === normalizedFrom
    ) {
      const ratio = rule.from.amount / rule.to.amount
      return from.amount * ratio
    }
  }

  log.silly(
    'unit.conversion',
    'No conversion available for %s -> %s',
    normalizedFrom,
    normalizedTo
  )
  return null
}
