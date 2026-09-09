import { logger } from '../utils/logger.js'

/**
 * Known document-level directives that can be configured via `h:*` on `<html>`.
 */
export const KNOWN_DOCUMENT_DIRECTIVES = new Set([
  'resolveMarkups',
])

/**
 * Regular expression matching root `<html ...>` tag.
 */
const HTML_ROOT_REGEX = /<html\b([^>]*)>/i

/**
 * Regular expression matching `h:*` attributes within an html tag.
 */
const DIRECTIVE_ATTR_REGEX = /\bh:([\w-]+)(?:=(?:(['"])(.*?)\2|([^\s>]+)))?/g

/**
 * Parse a boolean-like directive value.
 *
 * @param {unknown} value
 * @param {boolean} [defaultValue]
 * @returns {boolean} The parsed boolean value.
 */
export function parseBooleanDirective(value, defaultValue = true) {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase()
    if (trimmed === 'false' || trimmed === '0') {
      return false
    }
    if (trimmed === 'true' || trimmed === '1' || trimmed === '') {
      return true
    }
  }
  return defaultValue
}

/**
 * Extracts `h:*` root directives from the `<html ...>` tag of a template.
 * Emits a warning for unknown directives.
 *
 * @param {string} template - The template or HTML tag string.
 * @param {object} [options]
 * @param {string} [options.file] - Optional file path for diagnostic warning location.
 * @returns {Record<string, string | boolean>} Dictionary of extracted raw directives.
 */
export function extractRootDirectives(template, { file } = {}) {
  const directives = {}
  if (typeof template !== 'string') {
    return directives
  }

  const htmlMatch = template.match(HTML_ROOT_REGEX)
  if (!htmlMatch) {
    return directives
  }

  const htmlAttrs = htmlMatch[1]
  const matches = htmlAttrs.matchAll(DIRECTIVE_ATTR_REGEX)

  for (const match of matches) {
    const name = match[1]
    // Quoted string (match[3]), unquoted string (match[4]), or bare attribute (boolean true)
    const rawValue = match[3] ?? match[4] ?? true
    directives[name] = rawValue

    if (!KNOWN_DOCUMENT_DIRECTIVES.has(name)) {
      const knownList = [...KNOWN_DOCUMENT_DIRECTIVES].map(d => `h:${d}`).join(', ')
      logger.warn(
        `Unknown Hamlet root directive 'h:${name}'. Valid document-level directives are: ${knownList}.`,
        file,
      )
    }
  }

  return directives
}

/**
 * Strips all `h:*` directives exclusively from the root `<html ...>` tag.
 * Does not touch any other elements.
 *
 * @param {string} template - The template string or HTML tag.
 * @returns {string} The template with `h:*` attributes removed from `<html>`.
 */
export function stripRootDirectives(template) {
  if (typeof template !== 'string' || !template.includes('h:')) {
    return template
  }

  return template.replace(HTML_ROOT_REGEX, (htmlTag) => {
    return htmlTag.replace(/\s*\bh:[\w-]+(?:=(?:(['"])(.*?)\1|[^\s>]+))?/g, '')
  })
}

/**
 * Resolves the effective value of a document-level option following the precedence:
 * Default < hamlet.config.js < Root Directive (h:*)
 *
 * @template T
 * @param {string} optionName - Name of the option (e.g., 'resolveMarkups').
 * @param {Record<string, any>} [rootDirectives] - Directives extracted from <html>.
 * @param {Record<string, any>} [configOptions] - Global configuration from hamlet.config.js.
 * @param {T} defaultValue - Default fallback value.
 * @param {(val: any) => T} [parser] - Optional parsing/validation function for the root attribute value.
 * @returns {T} The resolved effective value.
 */
export function resolveEffectiveDocumentOption(
  optionName,
  rootDirectives = {},
  configOptions = {},
  defaultValue,
  parser,
) {
  if (rootDirectives && Object.hasOwn(rootDirectives, optionName)) {
    const rawVal = rootDirectives[optionName]
    return typeof parser === 'function' ? parser(rawVal) : rawVal
  }

  if (configOptions && configOptions[optionName] !== undefined) {
    return configOptions[optionName]
  }

  return defaultValue
}
