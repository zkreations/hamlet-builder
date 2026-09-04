/**
 * Extract error message, line, and column numbers from Error object.
 *
 * @param {Error | any} error - The error object
 * @returns {{ message: string, line: string | null, column: string | null }} Error details object
 */
export function getErrorDetails(error) {
  const errorMessage = error?.message || String(error)
  const stack = error?.stack || ''
  const lineNumber = stack.match(/<anonymous>:(\d+):(\d+)/)

  return {
    message: errorMessage,
    line: lineNumber ? lineNumber[1] : null,
    column: lineNumber ? lineNumber[2] : null,
  }
}
