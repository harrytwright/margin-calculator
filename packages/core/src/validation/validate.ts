import { ZodError, ZodSchema } from 'zod'

export function validationError(
  error: ZodError,
  message = 'Invalid data provided'
) {
  return Object.assign(new Error(message), {
    code: 'ERR_BAD_REQUEST_400',
    issues: error.issues,
  })
}

export function parseWithSchema<T>(
  schema: ZodSchema<T>,
  input: unknown,
  message?: string
): T {
  try {
    return schema.parse(input)
  } catch (error) {
    if (error instanceof ZodError) {
      throw validationError(error, message)
    }
    throw error
  }
}
