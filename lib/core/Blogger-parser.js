import {
  getAttr,
  getAttrValue,
  replaceAttrValue,
  sanitizeSpacing
} from '../utils.js'

import { widgets } from '../data/widgets.js'

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
  const REG_EXP = /<html([^>]*)>|<b:([^>]+?(?:(?=['"])['"][^'"]*['"][^>]*?)*>)|<Variable([^>]*)\/?>/g

  return template.replace(REG_EXP, (element, _, bTagAttrs) => {
    let processedElement = element

    // Normaliza espacios en atributos de etiquetas <b:...>
    if (bTagAttrs) {
      processedElement = `<b:${sanitizeSpacing(bTagAttrs)}`
    }

    // Aplicar cambios específicos a cada tipo de etiqueta
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
