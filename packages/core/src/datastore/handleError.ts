import { NotFound } from '@hndlr/errors'
import { QueryNode } from 'kysely'

export function handleError(
  key: string | Record<string, any>,
  data?: Record<string, any>
) {
  if (typeof key === 'object') {
    data = key
    key = 'plan'
  }

  const message = `Unable to find ${key} that matches (${Object.entries(
    data || {}
  )
    .map(([key, value]) => `\`${key}=${value}\``)
    .join(', ')})`

  // Adjust the stack, this helps with better error handling, or at least directs
  // us to the correct service method that called this, rather than the kysely function
  const error = new NotFound(message)
  Error.captureStackTrace(error, handleError)

  // Only call the `captureStackTrace` when an `notFound` event is handled
  return (node: QueryNode) => {
    return Object.assign(error, { meta: data })
  }
}
