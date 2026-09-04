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

/**
 * Add attributes to the root element of the template.
 *
 * @param {string} element - The html element string
 * @returns {string} Processed html element string
 */
function rootAttributes(element) {
  for (const [attribute, value] of Object.entries(attributes)) {
    if (!element.includes(attribute)) {
      element = element.replace('>', ` ${attribute}='${value}'>`)
    }
  }

  return element
}

/**
 * Add attributes to the widget elements of the template.
 *
 * @param {string} element - The widget element
 * @param {object} TYPES - Widget type counts accumulator
 * @returns {string} Processed widget tag
 */
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

/**
 * Add attributes to the variable elements of the template.
 *
 * @param {string} element - The variable element
 * @returns {string} Processed Variable tag
 */
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

/**
 * Self-close void elements that are missing closing slash.
 *
 * @param {string} template - The template content
 * @returns {string} Cleaned template
 */
function closeVoidElements(template) {
  return VOID_ELEMENTS.reduce((html, tag) => closeVoidTag(html, tag), template)
}

/**
 * Self-close a single void tag throughout the template.
 *
 * @param {string} template - The template content
 * @param {string} tag - The void element name
 * @returns {string} Cleaned template
 */
function closeVoidTag(template, tag) {
  const ATTRS = `(?:[^>'"]|"[^"]*"|'[^']*')*`
  const tokenRe = new RegExp(`<${tag}\\b${ATTRS}>|<\\/${tag}\\s*>`, 'gi')
  const closeRe = new RegExp(`^<\\/${tag}\\s*>$`, 'i')

  const matches = [...template.matchAll(tokenRe)]
  if (matches.length === 0)
    return template

  let result = ''
  let cursor = 0

  matches.forEach((match, i) => {
    const text = match[0]
    result += template.slice(cursor, match.index)
    cursor = match.index + text.length

    if (closeRe.test(text)) {
      result += text
      return
    }

    const isSelfClosed = /\/\s*>$/.test(text)
    const next = matches[i + 1]
    const hasMatchingClose = !isSelfClosed && next && closeRe.test(next[0])

    result += isSelfClosed || hasMatchingClose ? text : text.replace(/>$/, '/>')
  })

  return result + template.slice(cursor)
}

/**
 * Process the Blogger XML template.
 *
 * @param {string} template - The raw compiled template content
 * @returns {string} The processed XML template
 */
export function processTemplate(template) {
  const TYPES = {}
  const REG_EXP = /<html[^>]*>|<b:((?:[^>'"]|"[^"]*"|'[^']*')+>)|<Variable[^>]*>/g

  return closeVoidElements(template).replace(REG_EXP, (element, bTagAttrs) => {
    let processedElement = element

    if (bTagAttrs) {
      processedElement = `<b:${sanitizeSpacing(bTagAttrs)}`
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
