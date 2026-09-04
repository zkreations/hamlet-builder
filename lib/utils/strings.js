/**
 * Sanitize spacing by removing newlines and collapsing whitespace.
 *
 * @param {string} string - The input string
 * @returns {string} Sanitized string without excessive spaces
 */
export function sanitizeSpacing(string) {
  if (typeof string !== 'string')
    return ''

  return string
    .replace(/\n/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Capitalize the first letter of a string.
 *
 * @param {string} str - The input string
 * @returns {string} Capitalized string
 */
export function capitalize(str) {
  if (typeof str !== 'string')
    return ''

  return str.charAt(0).toUpperCase() + str.slice(1)
}
