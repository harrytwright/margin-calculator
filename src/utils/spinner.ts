import ora from 'ora'

export default ora

export type Options<T> = ora.Options & {
  successText?: string | ((result: T) => string)
  failText?: string | ((text: unknown) => string)
}

export type SpinFunction<T> = (spinner: ora.Ora) => PromiseLike<T>

export async function spin<T>(
  action: PromiseLike<T> | SpinFunction<T>,
  options: string | Options<T> | undefined
): Promise<T> {
  const actionIsFunction = typeof action === 'function'
  const actionIsPromise = 'then' in action && typeof action.then === 'function'

  if (!actionIsFunction && !actionIsPromise) {
    throw new TypeError('Parameter `action` must be a Function or a Promise')
  }

  const { successText, failText } =
    typeof options === 'object'
      ? options
      : { successText: undefined, failText: undefined }

  const spinner = ora(options).start()

  try {
    const result = await (actionIsFunction ? action(spinner) : action)

    spinner.succeed(
      successText === undefined
        ? undefined
        : typeof successText === 'string'
          ? successText
          : successText(result)
    )

    return result
  } catch (error) {
    spinner.fail(
      failText === undefined
        ? undefined
        : typeof failText === 'string'
          ? failText
          : failText(error)
    )

    throw error
  }
}
