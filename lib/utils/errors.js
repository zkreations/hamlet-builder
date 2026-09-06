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
