import { widgets } from '../data/widgets.js'
import {
  getAttr,
  getAttrValue,
  replaceAttrValue,
} from '../utils/index.js'
import { processIncludeElement } from './include-attributes.js'
import {
  normalizeBloggerTag,
  normalizeExprAttributes,
} from './normalizer.js'
import {
  expandWidgetIncludables,
  normalizeBooleanAttributes,
} from './widget-includables.js'
import { expandMultiWith } from './with-expansion.js'

export { processIncludeElement } from './include-attributes.js'
export {
  normalizeBloggerExpressions,
  normalizeBloggerTag,
  normalizeExprAttributes,
} from './normalizer.js'
export {
  collectDocumentDefaultMarkups,
  expandWidgetIncludables,
  getNativeMarkupsForType,
  normalizeBooleanAttributes,
  resolveWidgetIncludables,
} from './widget-includables.js'
export { expandMultiWith } from './with-expansion.js'
export { sectionAttributes, variableAttributes, widgetAttributes }

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
  element = normalizeBooleanAttributes(element)
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

function inferVariableType(value, element) {
  if (getAttr(element, 'minmax') || getAttr(element, 'min') || getAttr(element, 'max')) {
    return 'length'
  }

  const v = value.trim()
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) {
    return 'color'
  }
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)$/i.test(v)) {
    return 'color'
  }
  if (/^-?\d+(?:\.\d+)?(?:px|em)$/i.test(v)) {
    return 'length'
  }

  return 'string'
}

function expandMinmax(element) {
  const minmaxAttr = getAttrValue(element, 'minmax')
  if (!minmaxAttr) {
    return element
  }

  const cleaned = minmaxAttr.replace(/^minmax\s*\(/i, '').replace(/\)$/, '').trim()
  const parts = cleaned.split(/[\s,]+/).filter(Boolean)

  let updated = element.replace(/\s*minmax=(['"])([\s\S]*?)\1/, '')
  if (parts.length >= 2) {
    const min = parts[0]
    const max = parts[1]
    if (!getAttr(updated, 'min')) {
      updated += ` min="${min}"`
    }
    if (!getAttr(updated, 'max')) {
      updated += ` max="${max}"`
    }
  }

  return updated
}

function variableAttributes(element) {
  const name = getAttrValue(element, 'name')
  const value = getAttrValue(element, 'value') || ''

  if (!name) {
    throw new Error('The name attribute is required for the Variable element.')
  }

  let cleaned = element.replace(/\/?>$/, '').trim()
  cleaned = expandMinmax(cleaned)

  const explicitType = getAttrValue(cleaned, 'type')
  const type = explicitType || inferVariableType(value, cleaned)

  if (!explicitType) {
    cleaned = cleaned.replace(/\bname=(['"])(.*?)\1/, `name="$2" type="${type}"`)
  }

  if (!getAttr(cleaned, 'description')) {
    cleaned = cleaned.replace(/\bname=(['"])(.*?)\1/, `name="$2" description="${name}"`)
  }

  if (!getAttr(cleaned, 'default') && type !== 'string' && value) {
    cleaned += ` default="${value}"`
  }

  return `${cleaned}/>`
}

function sectionAttributes(element, sectionCtx) {
  if (getAttr(element, 'id')) {
    return element
  }

  while (sectionCtx.usedIds.has(`section${sectionCtx.counter}`)) {
    sectionCtx.counter++
  }

  const generatedId = `section${sectionCtx.counter}`
  sectionCtx.usedIds.add(generatedId)
  sectionCtx.counter++

  return element.replace(/<b:section\b/, `<b:section id='${generatedId}'`)
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

export function processTemplate(template) {
  const TYPES = {}
  const REG_EXP = /<html[^>]*>|<b:((?:[^>'"]|"[^"]*"|'[^']*')+>)|<Variable[^>]*>/g

  const safeVoidElements = closeVoidElements(template)
  const withExpanded = expandMultiWith(safeVoidElements)
  const widgetExpanded = expandWidgetIncludables(withExpanded)
  const normalized = normalizeExprAttributes(widgetExpanded)

  const existingSectionIds = new Set()
  for (const match of normalized.matchAll(/<b:section\b[^>]*>/gi)) {
    const id = getAttrValue(match[0], 'id')
    if (id) {
      existingSectionIds.add(id.trim())
    }
  }
  const sectionCtx = {
    counter: 1,
    usedIds: existingSectionIds,
  }

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

    if (/^<b:section(?: [^>]*?)?\/?>/.test(processedElement)) {
      processedElement = sectionAttributes(processedElement, sectionCtx)
    }

    if (/^<b:widget(?: [^>]*?)?\/?>/.test(processedElement)) {
      processedElement = widgetAttributes(processedElement, TYPES)
    }

    if (/^<b:include(?: [^>]*?)?\/?>/.test(processedElement)) {
      processedElement = processIncludeElement(processedElement)
    }

    return processedElement
  })
}
