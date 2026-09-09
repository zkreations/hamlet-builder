import { markups } from '../data/markups.js'
import { widgets } from '../data/widgets.js'
import {
  ALLOWED_SUBPROPERTIES,
  collectDeclaredSkinVariables,
} from './skin-shorthands.js'

export const VALID_VARIABLE_TYPES = new Set([
  'color',
  'length',
  'font',
  'string',
  'background',
  'image',
])

export const VALID_DEFAULTMARKUP_TYPES = new Set([
  ...widgets,
  ...Object.keys(markups?.defaultmarkups ?? {}),
  'Common',
])

export function isValidBloggerColor(value) {
  if (typeof value !== 'string')
    return false

  const v = value.trim()
  if (v.toLowerCase() === 'transparent')
    return true

  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v))
    return true

  if (/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i.test(v))
    return true

  if (/^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\)$/i.test(v))
    return true

  return false
}

export function isValidBloggerLength(value) {
  if (typeof value !== 'string')
    return false

  const v = value.trim()
  return /^-?\d+(?:\.\d+)?(?:px|em)$/i.test(v)
}

export function computeLineAndColumn(source, index) {
  if (!source || index <= 0)
    return { line: 1, column: 1 }

  const textBefore = source.slice(0, index)
  const lines = textBefore.split('\n')
  const line = lines.length
  const column = lines[lines.length - 1].length + 1

  return { line, column }
}

export function getAttr(string, attr) {
  const match = string.match(new RegExp(`\\b${attr}\\s*=\\s*['"](.*?)['"]`, 'i'))
  return match ? match[1] : null
}

export function lintBloggerTemplate(template, _options = {}) {
  const diagnostics = []
  if (typeof template !== 'string')
    return diagnostics

  function report({ rule, severity = 'error', message, index, snippet }) {
    const { line, column } = computeLineAndColumn(template, index)
    diagnostics.push({
      rule,
      severity,
      message,
      line,
      column,
      snippet: snippet || '',
    })
  }

  // Mask HTML comments with spaces to avoid false positives while preserving line/column offsets
  const cleanTemplate = template.replace(/<!--[\s\S]*?-->/g, match => ' '.repeat(match.length))

  const defaultMarkupRegex = /<b:defaultmarkup\b([^>]*)>/gi
  for (const match of cleanTemplate.matchAll(defaultMarkupRegex)) {
    const attrs = match[1]
    const type = getAttr(attrs, 'type')
    const index = match.index ?? 0

    if (!type) {
      report({
        rule: 'defaultmarkup-valid-type',
        severity: 'error',
        message: 'Attribute "type" is required on <b:defaultmarkup>.',
        index,
        snippet: match[0],
      })
      continue
    }

    const trimmedType = type.trim()
    if (!VALID_DEFAULTMARKUP_TYPES.has(trimmedType)) {
      const parts = trimmedType.split(',').map(s => s.trim()).filter(Boolean)
      const allPartsValid = parts.length > 0 && parts.every(part => widgets.includes(part))

      if (!allPartsValid) {
        report({
          rule: 'defaultmarkup-valid-type',
          severity: 'error',
          message: `The type "${trimmedType}" in <b:defaultmarkup> is not a valid Blogger type. Allowed types are widget types, official defaultmarkup groups, or 'Common'.`,
          index,
          snippet: match[0],
        })
      }
    }
  }

  const variableRegex = /<Variable\b([^>]*?)\/?>/gi
  for (const match of cleanTemplate.matchAll(variableRegex)) {
    const attrs = match[1]
    const name = getAttr(attrs, 'name') || ''
    const rawType = getAttr(attrs, 'type')
    const type = rawType ? rawType.toLowerCase().trim() : ''
    const index = match.index ?? 0

    if (type && !VALID_VARIABLE_TYPES.has(type)) {
      report({
        rule: 'variable-valid-type',
        severity: 'error',
        message: `The variable "${name || 'unnamed'}" has an invalid type "${type}". Valid Blogger variable types are: color, length, font, string, background, image.`,
        index,
        snippet: match[0],
      })
    }

    if (type === 'color') {
      const val = getAttr(attrs, 'value')
      const def = getAttr(attrs, 'default')

      for (const [attrName, colorVal] of [['value', val], ['default', def]]) {
        if (colorVal && !isValidBloggerColor(colorVal)) {
          report({
            rule: 'variable-strict-color',
            severity: 'error',
            message: `The color variable "${name}" has an invalid ${attrName} "${colorVal}". Blogger only accepts 3- or 6-digit hex (#fff, #ffffff), rgb(r, g, b), rgba(r, g, b, a), or 'transparent'. Hex with alpha (#ffffffff) and modern color functions break theme installation.`,
            index,
            snippet: match[0],
          })
        }
      }
    }

    const hasMinmax = getAttr(attrs, 'minmax')
    const hasMin = getAttr(attrs, 'min')
    const hasMax = getAttr(attrs, 'max')
    const isLength = type === 'length' || Boolean(hasMinmax || hasMin || hasMax)

    if (isLength) {
      const val = getAttr(attrs, 'value')
      const def = getAttr(attrs, 'default')

      for (const [attrName, lenVal] of [
        ['value', val],
        ['default', def],
        ['min', hasMin],
        ['max', hasMax],
      ]) {
        if (lenVal && !isValidBloggerLength(lenVal)) {
          report({
            rule: 'variable-strict-length',
            severity: 'error',
            message: `The length variable "${name}" has an invalid ${attrName} "${lenVal}". Blogger length variables only accept 'px' or 'em' units (e.g. '12px', '1.5em'). Other units or unitless numbers break theme installation.`,
            index,
            snippet: match[0],
          })
        }
      }

      if (hasMinmax) {
        const cleaned = hasMinmax.replace(/^minmax\s*\(/i, '').replace(/\)$/, '').trim()
        const parts = cleaned.split(/[\s,]+/).filter(Boolean)
        for (const part of parts) {
          if (!isValidBloggerLength(part)) {
            report({
              rule: 'variable-strict-length',
              severity: 'error',
              message: `The length variable "${name}" has an invalid minmax value "${part}". Blogger length variables only accept 'px' or 'em' units.`,
              index,
              snippet: match[0],
            })
          }
        }
      }
    }
  }

  const hasSkin = cleanTemplate.includes('<b:skin') || cleanTemplate.includes('<b:template-skin')
  if (hasSkin) {
    const declaredVariables = collectDeclaredSkinVariables(cleanTemplate)

    const maskedTemplate = cleanTemplate
      .replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, match => ' '.repeat(match.length))
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, match => ' '.repeat(match.length))

    const skinUsageRegex = /(?:(?:\$|data:)skin\.(?:vars\.)?|skin:)([\w.-]+)/g

    for (const match of maskedTemplate.matchAll(skinUsageRegex)) {
      const fullVar = match[1]
      const index = match.index ?? 0
      const lastDotIndex = fullVar.lastIndexOf('.')

      let baseName = fullVar
      let subprop = null

      if (lastDotIndex !== -1) {
        baseName = fullVar.slice(0, lastDotIndex)
        subprop = fullVar.slice(lastDotIndex + 1)
      }

      const isBaseDeclared = declaredVariables.has(baseName)
      const isFullDeclared = declaredVariables.has(fullVar)

      if (!isBaseDeclared && !isFullDeclared) {
        report({
          rule: 'skin-undeclared-variable',
          severity: 'error',
          message: `The skin variable "${fullVar}" is used but not declared in <b:skin>. Using undeclared skin variables will break the Blogger theme.`,
          index,
          snippet: match[0],
        })
      }
      else if (subprop && isBaseDeclared && !isFullDeclared) {
        const varData = declaredVariables.get(baseName)
        const allowedSubs = ALLOWED_SUBPROPERTIES[varData.type]

        if (!allowedSubs) {
          report({
            rule: 'skin-invalid-subproperty',
            severity: 'error',
            message: `The skin variable "${varData.name}" of type "${varData.type}" does not have subproperties. Using ".${subprop}" will break the Blogger theme.`,
            index,
            snippet: match[0],
          })
        }
        else if (!allowedSubs.has(subprop)) {
          report({
            rule: 'skin-invalid-subproperty',
            severity: 'error',
            message: `The skin variable "${varData.name}" of type "${varData.type}" does not support the subproperty ".${subprop}". Allowed subproperties: ${[...allowedSubs].join(', ')}.`,
            index,
            snippet: match[0],
          })
        }
      }
    }
  }

  const seenWidgetIds = new Set()
  const widgetRegex = /<b:widget\b([^>]*)>/gi
  for (const match of cleanTemplate.matchAll(widgetRegex)) {
    const attrs = match[1]
    const id = getAttr(attrs, 'id')
    const type = getAttr(attrs, 'type')
    const index = match.index ?? 0

    if (id) {
      const trimmedId = id.trim()
      if (seenWidgetIds.has(trimmedId)) {
        report({
          rule: 'unique-element-ids',
          severity: 'error',
          message: `Duplicate widget id "${trimmedId}". Blogger requires all <b:widget> elements to have unique ids.`,
          index,
          snippet: match[0],
        })
      }
      else {
        seenWidgetIds.add(trimmedId)
      }
    }

    if (type) {
      const trimmedType = type.trim()
      if (!widgets.includes(trimmedType)) {
        report({
          rule: 'widget-valid-type',
          severity: 'warning',
          message: `The widget type "${trimmedType}" is not recognized by Blogger. Recognized types: ${widgets.join(', ')}.`,
          index,
          snippet: match[0],
        })
      }
    }
  }

  const seenSectionIds = new Set()
  const sectionRegex = /<b:section\b([^>]*)>/gi
  for (const match of cleanTemplate.matchAll(sectionRegex)) {
    const attrs = match[1]
    const id = getAttr(attrs, 'id')
    const index = match.index ?? 0

    if (id) {
      const trimmedId = id.trim()
      if (seenSectionIds.has(trimmedId)) {
        report({
          rule: 'unique-element-ids',
          severity: 'error',
          message: `Duplicate section id "${trimmedId}". Blogger requires all <b:section> elements to have unique ids.`,
          index,
          snippet: match[0],
        })
      }
      else {
        seenSectionIds.add(trimmedId)
      }
    }
  }

  const tagTokenRegex = /<\/?b:(?:section|widget)\b[^>]*>/gi
  let sectionDepth = 0

  for (const match of cleanTemplate.matchAll(tagTokenRegex)) {
    const tag = match[0]
    const index = match.index ?? 0
    const isSelfClosing = tag.endsWith('/>')

    if (/^<b:section\b/i.test(tag)) {
      if (sectionDepth > 0) {
        report({
          rule: 'section-nesting',
          severity: 'error',
          message: 'Nested <b:section> detected. Blogger does not allow a <b:section> inside another <b:section>.',
          index,
          snippet: tag,
        })
      }
      if (!isSelfClosing) {
        sectionDepth++
      }
    }
    else if (/^<\/b:section>/i.test(tag)) {
      if (sectionDepth > 0)
        sectionDepth--
    }
    else if (/^<b:widget\b/i.test(tag)) {
      if (sectionDepth === 0) {
        const id = getAttr(tag, 'id')
        report({
          rule: 'widget-inside-section',
          severity: 'error',
          message: `<b:widget${id ? ` id="${id}"` : ''}> must be placed inside a <b:section>. Widgets outside of sections are not allowed by Blogger.`,
          index,
          snippet: tag,
        })
      }
    }
  }

  const containerBlockRegex = /<b:(widget|defaultmarkup)\b([^>]*)>([\s\S]*?)<\/b:\1>/gi
  for (const containerMatch of cleanTemplate.matchAll(containerBlockRegex)) {
    const containerType = containerMatch[1]
    const containerContent = containerMatch[3]
    const containerStartIndex = (containerMatch.index ?? 0) + containerMatch[0].indexOf(containerContent)

    const seenIncludables = new Set()
    const includableRegex = /<b:includable\b([^>]*)>/gi

    for (const incMatch of containerContent.matchAll(includableRegex)) {
      const incAttrs = incMatch[1]
      const id = getAttr(incAttrs, 'id')
      const index = containerStartIndex + (incMatch.index ?? 0)

      if (id) {
        const trimmedId = id.trim()
        if (seenIncludables.has(trimmedId)) {
          report({
            rule: 'unique-includable-ids',
            severity: 'error',
            message: `Duplicate includable id "${trimmedId}" inside <b:${containerType}>. Includable ids must be unique within their container.`,
            index,
            snippet: incMatch[0],
          })
        }
        else {
          seenIncludables.add(trimmedId)
        }
      }
    }
  }

  diagnostics.sort((a, b) => {
    if (a.line !== b.line)
      return a.line - b.line
    return a.column - b.column
  })

  return diagnostics
}

export function formatDiagnostics(diagnostics, filename = 'template.xml') {
  if (!Array.isArray(diagnostics) || diagnostics.length === 0)
    return ''

  return diagnostics
    .map((d) => {
      const loc = `${filename}:${d.line}:${d.column}`
      return `[${d.severity.toUpperCase()}] ${d.rule}: ${d.message} (${loc})`
    })
    .join('\n')
}
