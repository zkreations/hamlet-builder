import { widgets } from '../data/widgets.js'
import {
  getAttr,
  getAttrValue,
  replaceAttrValue,
  sanitizeSpacing,
} from '../utils/index.js'

const VOID_ELEMENTS = [
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]

const attributes = {
  'b:css': 'false',
  'b:js': 'false',
  'b:defaultwidgetversion': '2',
  'b:layoutsVersion': '3',
  'expr:dir': 'data:blog.languageDirection',
  'expr:lang': 'data:blog.locale',
}

const B_EXPR_ATTRS = [
  'cond',
  'expr',
  'values',
  'value',
]

const B_EXPR_PATTERN = B_EXPR_ATTRS.join('|')
const B_ATTR_REGEX = new RegExp(`\\b(${B_EXPR_PATTERN})\\s*=\\s*(['"])([\\s\\S]*?)\\2`, 'g')
const EXPR_ATTR_REGEX = /\b(expr:[\w:-]+)\s*=\s*(['"])([\s\S]*?)\2/g

function rootAttributes(element) {
  let additions = ''
  for (const [attribute, value] of Object.entries(attributes)) {
    if (!element.includes(attribute)) {
      additions += ` ${attribute}='${value}'`
    }
  }

  return additions ? element.replace('>', `${additions}>`) : element
}

function widgetAttributes(element, TYPES) {
  const getType = getAttrValue(element, 'type')
  let type = getType || 'HTML'
  const closeTag = element.includes('/>') ? '/>' : '>'

  if (!widgets.includes(type)) {
    console.warn(`The widget type "${type}" is not valid. The default type "HTML" will be used.`)
    type = 'HTML'
    element = replaceAttrValue(element, 'type', type)
  }

  TYPES[type] = (TYPES[type] || 0) + 1

  if (!getAttr(element, 'type')) {
    element = element.replace(/\/?>/, ` type='${type}'${closeTag}`)
  }

  if (!getAttr(element, 'version')) {
    element = element.replace(/\/?>/, ` version='2'${closeTag}`)
  }

  if (!getAttr(element, 'id')) {
    element = element.replace(/<b:widget/, `<b:widget id='${type + TYPES[type]}'`)
  }

  return element
}

function variableAttributes(element) {
  const name = getAttrValue(element, 'name')
  const value = getAttrValue(element, 'value') || ''

  if (!getAttr(element, 'name')) {
    throw new Error('The name attribute is required for the Variable element.')
  }

  element = element.replace(/\/?>/, '')

  if (!getAttr(element, 'type')) {
    element = element.replace(/name="(.*?)"/, `name="${name}" type="string"`)
  }

  if (!getAttr(element, 'description')) {
    element = element.replace(/name="(.*?)"/, `name="${name}" description="${name}"`)
  }

  if (!getAttr(element, 'default') && getAttrValue(element, 'type') !== 'string') {
    element += ` default="${value}"`
  }

  return `${element}/>`
}

function closeVoidElements(template) {
  const tagsPattern = VOID_ELEMENTS.join('|')
  const ATTRS = `(?:[^>'"]|"[^"]*"|'[^']*')*`
  const tokenRe = new RegExp(`<(?:(${tagsPattern})\\b${ATTRS}|\\/(${tagsPattern})\\s*)>`, 'gi')

  const matches = [...template.matchAll(tokenRe)]
  if (matches.length === 0)
    return template

  let result = ''
  let cursor = 0

  matches.forEach((match, i) => {
    const text = match[0]
    result += template.slice(cursor, match.index)
    cursor = match.index + text.length

    const isCloseTag = Boolean(match[2])
    if (isCloseTag) {
      result += text
      return
    }

    const isSelfClosed = /\/\s*>$/.test(text)
    const next = matches[i + 1]
    const openTag = match[1]?.toLowerCase()
    const hasMatchingClose = !isSelfClosed && next && Boolean(next[2]) && next[2].toLowerCase() === openTag

    result += isSelfClosed || hasMatchingClose ? text : text.replace(/>$/, '/>')
  })

  return result + template.slice(cursor)
}

/**
 * Normalizes expr:* attributes across all elements (HTML and Blogger)
 * into single-line canonical representations, while preserving CDATA and code blocks.
 *
 * @param {string} template - Raw template string
 * @returns {string} Template string with expr:* attributes normalized
 */
export function normalizeExprAttributes(template) {
  if (typeof template !== 'string')
    return ''

  const cdataBlocks = []
  let safeTemplate = template.replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, (match) => {
    const placeholder = `__HAMLET_CDATA_${cdataBlocks.length}__`
    cdataBlocks.push({ placeholder, match })
    return placeholder
  })

  const codeBlocks = []
  safeTemplate = safeTemplate.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (match) => {
    const placeholder = `__HAMLET_CODE_${codeBlocks.length}__`
    codeBlocks.push({ placeholder, match })
    return placeholder
  })

  // Normalize expr:* attributes across all elements (HTML and Blogger)
  safeTemplate = safeTemplate.replace(EXPR_ATTR_REGEX, (match, attrName, quote, exprValue) => {
    const normalized = exprValue
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return `${attrName}=${quote}${normalized}${quote}`
  })

  // Restore code and CDATA blocks
  for (let i = codeBlocks.length - 1; i >= 0; i--) {
    safeTemplate = safeTemplate.replace(codeBlocks[i].placeholder, () => codeBlocks[i].match)
  }
  for (let i = cdataBlocks.length - 1; i >= 0; i--) {
    safeTemplate = safeTemplate.replace(cdataBlocks[i].placeholder, () => cdataBlocks[i].match)
  }

  return safeTemplate
}

/**
 * Normalizes a <b:...> tag's attributes string:
 * - Normalizes Blogger expression control attributes (cond, expr, values, value)
 * - Sanitizes inter-attribute whitespace and flattens newlines
 *
 * @param {string} bTagAttrs - Raw tag contents after '<b:'
 * @returns {string} Normalized tag content
 */
export function normalizeBloggerTag(bTagAttrs) {
  if (typeof bTagAttrs !== 'string')
    return ''

  const withExprs = bTagAttrs.replace(B_ATTR_REGEX, (attrMatch, attrName, quote, attrValue) => {
    const normalized = attrValue
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return `${attrName}=${quote}${normalized}${quote}`
  })

  return sanitizeSpacing(withExprs)
}

/**
 * Normalize Blogger expressions (expr:* attributes and Blogger control attributes)
 * into canonical single-line representations, while preserving non-Blogger content.
 *
 * @param {string} template - Raw template string
 * @returns {string} Normalized template string
 */
export function normalizeBloggerExpressions(template) {
  if (typeof template !== 'string')
    return ''

  // Normalize expr:* on any tag
  const withExprs = normalizeExprAttributes(template)

  // Normalize <b:...> control attributes
  return withExprs.replace(/<b:((?:[^>'"]|"[^"]*"|'[^']*')+>)/g, (match, bTagAttrs) => {
    return `<b:${normalizeBloggerTag(bTagAttrs)}`
  })
}

export function processTemplate(template) {
  const TYPES = {}
  const REG_EXP = /<html[^>]*>|<b:((?:[^>'"]|"[^"]*"|'[^']*')+>)|<Variable[^>]*>/g

  const safeVoidElements = closeVoidElements(template)
  const normalized = normalizeExprAttributes(safeVoidElements)

  return normalized.replace(REG_EXP, (element, bTagAttrs) => {
    let processedElement = element

    if (bTagAttrs) {
      processedElement = `<b:${normalizeBloggerTag(bTagAttrs)}`
    }

    if (processedElement.startsWith('<html')) {
      processedElement = rootAttributes(processedElement)
    }

    if (processedElement.startsWith('<Variable')) {
      processedElement = variableAttributes(processedElement)
    }

    if (/^<b:widget(?: [^>]*?)?\/?>/.test(processedElement)) {
      processedElement = widgetAttributes(processedElement, TYPES)
    }

    return processedElement
  })
}
