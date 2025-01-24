import {
  getAttr,
  getAttrValue,
  replaceAttrValue
} from './utils.js'

import { widgets } from './data/widgets.js'

// Add attributes to the root element of the template
// @param {string} template - The template content
// @returns {string} - The template with the attributes added
export function rootAttributes (template) {
  const attributes = {
    'b:css': 'false',
    'b:js': 'false',
    'b:defaultwidgetversion': '2',
    'b:layoutsVersion': '3',
    'expr:dir': 'data:blog.languageDirection',
    'expr:lang': 'data:blog.locale'
  }

  const REG_EXP = /<html([^>]*)>/
  const HTML_TAG = template.match(REG_EXP)

  if (!HTML_TAG) {
    return template
  }

  let result = HTML_TAG[0]

  for (const [attribute, value] of Object.entries(attributes)) {
    if (!result.includes(attribute)) {
      result = result.replace('>', ` ${attribute}='${value}'>`)
    }
  }

  const processedTemplate = template.replace(REG_EXP, result)

  return processedTemplate
}

// Add attributes to the widget elements of the template
// @param {string} template - The template content
// @returns {string} - The template with the attributes added
export function widgetAttributes (template) {
  const TYPES = {}
  const REG_EXP = /<b:widget(?: [^>]*?)?\/?>/g

  const processedTemplate = template.replace(REG_EXP, (widget) => {
    let result = widget
    const getType = getAttrValue(result, 'type')
    let type = getType || 'HTML'
    const closeTag = result.includes('/>') ? '/>' : '>'

    if (!widgets.includes(type)) {
      console.warn(`The widget type "${type}" is not valid. The default type "HTML" will be used.`)
      type = 'HTML'
      result = replaceAttrValue(result, 'type', type)
    }

    TYPES[type] = (TYPES[type] || 0) + 1

    if (!getAttr(result, 'type')) {
      result = result.replace(/\/?>/, ` type='${type}'${closeTag}`)
    }

    if (!getAttr(result, 'version')) {
      result = result.replace(/\/?>/, ` version='2'${closeTag}`)
    }

    if (!getAttr(result, 'id')) {
      result = result.replace(/<b:widget/, `<b:widget id='${type + TYPES[type]}'`)
    }

    return result
  })

  return processedTemplate
}

// Add attributes to the variable elements of the template
// @param {string} template - The template content
// @returns {string} - The template with the attributes added
export function variableAttributes (template) {
  // Constantes
  const REG_EXP = /<Variable([^>]*)\/?>/g
  const DEFAULT_TYPE = 'string'

  const processedTemplate = template.replace(REG_EXP, (variable) => {
    let result = variable

    const name = getAttrValue(result, 'name')
    const value = getAttrValue(result, 'value') || ''

    if (!getAttr(result, 'name')) {
      throw new Error('The name attribute is required for the Variable element.')
    }

    result = result.replace(/\/?>/, '')

    if (!getAttr(result, 'type')) {
      result = result.replace(/name="(.*?)"/, `name="${name}" type="${DEFAULT_TYPE}"`)
    }

    if (!getAttr(result, 'description')) {
      result = result.replace(/name="(.*?)"/, `name="${name}" description="${name}"`)
    }

    if (!getAttr(result, 'default') && getAttrValue(result, 'type') !== DEFAULT_TYPE) {
      result += ` default="${value}"`
    }

    return result + '/>'
  })

  return processedTemplate
}

// Normalize the spaces of the attributes in the template
// @param {string} template - The template content
// @returns {string} - The template with the spaces normalized
export const normalizeSpaces = (template) => {
  const REG_EXP = /<b:([^>]+?(?:(?=['"])['"][^'"]*['"][^>]*?)*>)/g

  const processedTemplate = template.replace(REG_EXP, (_, attributes) => {
    const processedAttributes = attributes
      .replace(/\n/g, '')
      .replace(/\s+/g, ' ')
    return `<b:${processedAttributes}`
  })

  return processedTemplate
}
