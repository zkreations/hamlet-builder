import {
  getAttr,
  getAttrValue,
  replaceAttrValue
} from './utils.js'

import { widgets } from './data/widgets.js'

// Normalize the spaces of the attributes in the template
// @param {string} template - The template content
// @returns {string} - The template with the spaces normalized
const normalizeSpaces = (template) => {
  const REG_EXP = /<b:([^>]+?(?:(?=['"])['"][^'"]*['"][^>]*?)*>)/g

  const processedTemplate = template.replace(REG_EXP, (_, attributes) => {
    const processedAttributes = attributes
      .replace(/\n/g, '')
      .replace(/\s+/g, ' ')
    return `<b:${processedAttributes}`
  })

  return processedTemplate
}

// Add attributes to the root element of the template
// @param {string} str - The template content
// @returns {string}
const rootAttributes = (element) => {
  const attributes = {
    'b:css': 'false',
    'b:js': 'false',
    'b:defaultwidgetversion': '2',
    'b:layoutsVersion': '3',
    'expr:dir': 'data:blog.languageDirection',
    'expr:lang': 'data:blog.locale'
  }

  for (const [attribute, value] of Object.entries(attributes)) {
    if (!element.includes(attribute)) {
      element = element.replace('>', ` ${attribute}='${value}'>`)
    }
  }

  return element
}

// Add attributes to the widget elements of the template
// @param {string} element - The widget element
// @param {object} TYPES - The widget types
// @returns {string}
const widgetAttributes = (element, TYPES) => {
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

// Add attributes to the variable elements of the template
// @param {string} element - The variable element
// @returns {string}
const variableAttributes = (element) => {
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

  return element + '/>'
}

// Process the template
// @param {string} template - The template content
// @returns {string} - The processed template
export function processTemplate (template) {
  const TYPES = {}
  const normalizedTemplate = normalizeSpaces(template)

  return normalizedTemplate
    .replace(/<html([^>]*)>|<b:widget(?: [^>]*?)?\/?>|<Variable([^>]*)\/?>/g, (element) => {
      let result = element

      if (result.startsWith('<html')) {
        result = rootAttributes(result)
      }

      if (result.startsWith('<b:widget')) {
        result = widgetAttributes(result, TYPES)
      }

      if (result.startsWith('<Variable')) {
        result = variableAttributes(result)
      }

      return result
    })
}
