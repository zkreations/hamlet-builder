import { logger } from '../utils/logger.js'

export const KNOWN_DOCUMENT_DIRECTIVES = new Set([
  'resolveMarkups',
  'mergeMarkups',
])

const HTML_ROOT_REGEX = /<html\b([^>]*)>/i
const DIRECTIVE_ATTR_REGEX = /\bh:([\w-]+)(?:=(?:(['"])(.*?)\2|([^\s>]+)))?/g

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

export function stripRootDirectives(template) {
  if (typeof template !== 'string' || !template.includes('h:')) {
    return template
  }

  return template.replace(HTML_ROOT_REGEX, (htmlTag) => {
    return htmlTag.replace(/\s*\bh:[\w-]+(?:=(?:(['"])(.*?)\1|[^\s>]+))?/g, '')
  })
}

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
