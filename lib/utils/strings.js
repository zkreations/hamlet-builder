export function sanitizeSpacing(string) {
  if (typeof string !== 'string')
    return ''

  return string
    .replace(/\n/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function capitalize(str) {
  if (typeof str !== 'string')
    return ''

  return str.charAt(0).toUpperCase() + str.slice(1)
}
