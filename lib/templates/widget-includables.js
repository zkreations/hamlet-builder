import { markups } from '../data/markups.js'
import {
  detectBaseIndent,
  formatNestedBlock,
  getAttrValue,
  reindentBlock,
  trimBlankLines,
} from '../utils/index.js'

export function normalizeBooleanAttributes(tagAttrs) {
  if (typeof tagAttrs !== 'string')
    return ''
  return tagAttrs.replace(/\b(locked|visible)\b(?!\s*=)/g, '$1=\'true\'')
}

export function getNativeMarkupsForType(widgetType) {
  const result = new Set()
  const defaultmarkups = markups?.defaultmarkups ?? {}

  for (const [key, items] of Object.entries(defaultmarkups)) {
    const types = key.split(',').map(t => t.trim())
    if (types.includes('All') || types.includes(widgetType)) {
      for (const item of items) {
        result.add(item)
      }
    }
  }

  return result
}

export function collectDocumentDefaultMarkups(template) {
  const themeMap = new Map()
  if (typeof template !== 'string')
    return themeMap

  const defaultMarkupRegex = /<b:defaultmarkup\b([^>]*)>([\s\S]*?)<\/b:defaultmarkup>/gi

  for (const match of template.matchAll(defaultMarkupRegex)) {
    const openAttrs = match[1]
    const content = match[2]
    const typeAttr = getAttrValue(openAttrs, 'type')

    if (!typeAttr)
      continue

    const types = typeAttr.split(',').map(t => t.trim()).filter(Boolean)

    const includableRegex = /<b:includable\b([^>]*?)(\/>|>[\s\S]*?<\/b:includable>)/gi
    for (const incMatch of content.matchAll(includableRegex)) {
      const id = getAttrValue(incMatch[1], 'id')
      if (!id)
        continue

      const trimmedId = id.trim()
      const isClean = incMatch[2].startsWith('/>')

      for (const t of types) {
        if (!themeMap.has(t)) {
          themeMap.set(t, new Map())
        }
        themeMap.get(t).set(trimmedId, { isClean })
      }
    }
  }

  return themeMap
}

export function isCleanInDefaultMarkups(incId, widgetType, themeDefaultMarkups) {
  if (!themeDefaultMarkups || !(themeDefaultMarkups instanceof Map))
    return false

  if (themeDefaultMarkups.has(widgetType)) {
    const typeMap = themeDefaultMarkups.get(widgetType)
    if (typeMap instanceof Map && typeMap.has(incId)) {
      const entry = typeMap.get(incId)
      return typeof entry === 'object' && entry !== null ? Boolean(entry.isClean) : false
    }
  }

  if (themeDefaultMarkups.has('All')) {
    const allMap = themeDefaultMarkups.get('All')
    if (allMap instanceof Map && allMap.has(incId)) {
      const entry = allMap.get(incId)
      return typeof entry === 'object' && entry !== null ? Boolean(entry.isClean) : false
    }
  }

  return false
}

export function resolveWidgetIncludables(widgetType, themeDefaultMarkups = new Map()) {
  const result = new Set(getNativeMarkupsForType(widgetType))

  const getKeys = (container) => {
    if (!container)
      return []
    return container instanceof Map ? container.keys() : container
  }

  if (themeDefaultMarkups.has('All')) {
    for (const id of getKeys(themeDefaultMarkups.get('All'))) {
      result.add(id)
    }
  }

  if (themeDefaultMarkups.has(widgetType)) {
    for (const id of getKeys(themeDefaultMarkups.get(widgetType))) {
      result.add(id)
    }
  }

  return result
}

function extractOverrides(openTagAttrs) {
  const overrides = new Map()
  const overrideRegex = /\boverride:([\w-]+)\s*=\s*(['"])([\s\S]*?)\2/g

  for (const match of openTagAttrs.matchAll(overrideRegex)) {
    overrides.set(match[1], match[3].trim())
  }

  const cleanedAttrs = openTagAttrs.replace(overrideRegex, '').replace(/\s+/g, ' ').trim()
  return {
    cleanedAttrs,
    overrides,
  }
}

function parseWidgetContent(content) {
  let remaining = content
  let widgetSettings = null

  const settingsMatch = remaining.match(/<b:widget-settings\b[^>]*>[\s\S]*?<\/b:widget-settings>/i)
  if (settingsMatch) {
    widgetSettings = settingsMatch[0]
    remaining = remaining.replace(settingsMatch[0], '')
  }

  const explicitIncludables = new Map()
  const includableRegex = /<b:includable\b([^>]*?)(?:\/>|>([\s\S]*?)<\/b:includable>)/gi

  for (const match of remaining.matchAll(includableRegex)) {
    const id = getAttrValue(match[1], 'id')
    if (id) {
      explicitIncludables.set(id.trim(), match[0])
    }
  }

  const withoutIncludables = remaining.replace(includableRegex, '')
  const contentStripped = withoutIncludables.replace(/<!--[\s\S]*?-->/g, '').trim()
  const hasDirectContent = contentStripped.length > 0

  return {
    directContent: hasDirectContent ? trimBlankLines(withoutIncludables) : null,
    explicitIncludables,
    hasDirectContent,
    widgetSettings,
  }
}

export function expandWidgetIncludables(template) {
  if (typeof template !== 'string' || !template.includes('<b:widget'))
    return template

  const cdataBlocks = []
  let safeTemplate = template.replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, (match) => {
    const placeholder = `__HAMLET_CDATA_${cdataBlocks.length}__`
    cdataBlocks.push({ match, placeholder })
    return placeholder
  })

  const codeBlocks = []
  safeTemplate = safeTemplate.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (match) => {
    const placeholder = `__HAMLET_CODE_${codeBlocks.length}__`
    codeBlocks.push({ match, placeholder })
    return placeholder
  })

  const themeDefaultMarkups = collectDocumentDefaultMarkups(safeTemplate)

  const widgetRegex = /<b:widget\b([^>]*?)(?:\/>|>([\s\S]*?)<\/b:widget>)/gi

  const result = safeTemplate.replace(widgetRegex, (fullMatch, rawAttrs, rawContent, offset) => {
    const isSelfClosing = rawContent === undefined
    const normalizedAttrs = normalizeBooleanAttributes(rawAttrs)
    const { cleanedAttrs, overrides } = extractOverrides(normalizedAttrs)

    const widgetType = getAttrValue(cleanedAttrs, 'type') || 'HTML'
    const widgetId = getAttrValue(cleanedAttrs, 'id') || widgetType

    const { baseIndent, stepIndent } = detectBaseIndent(safeTemplate, offset)
    const indentChild = baseIndent + stepIndent
    const indentInner = indentChild + stepIndent

    if (isSelfClosing) {
      if (overrides.size === 0) {
        return `<b:widget ${cleanedAttrs}/>`
      }

      const resolved = resolveWidgetIncludables(widgetType, themeDefaultMarkups)
      const generatedIncludables = []

      for (const [incId, targetName] of overrides) {
        generatedIncludables.push(
          `${indentChild}<b:includable id='${incId}'>\n${indentInner}<b:include name='${targetName}'/>\n${indentChild}</b:includable>`,
        )
      }

      const neutralized = []
      for (const incId of resolved) {
        if (!overrides.has(incId) && !isCleanInDefaultMarkups(incId, widgetType, themeDefaultMarkups)) {
          neutralized.push(incId)
        }
      }

      neutralized.sort((a, b) => {
        if (a === 'content')
          return -1
        if (b === 'content')
          return 1
        return a.localeCompare(b)
      })

      for (const incId of neutralized) {
        generatedIncludables.push(`${indentChild}<b:includable id='${incId}'/>`)
      }

      return `<b:widget ${cleanedAttrs}>\n${generatedIncludables.join('\n')}\n${baseIndent}</b:widget>`
    }

    const {
      widgetSettings,
      explicitIncludables,
      hasDirectContent,
      directContent,
    } = parseWidgetContent(rawContent)

    for (const [incId] of overrides) {
      if (explicitIncludables.has(incId)) {
        throw new Error(
          `Ambiguous includable definition: Widget "${widgetId}" specifies "override:${incId}" as an attribute and also contains an explicit "<b:includable id='${incId}'>" element.`,
        )
      }
    }

    const shouldActivateCleanMode = overrides.size > 0 || hasDirectContent

    if (!shouldActivateCleanMode) {
      return `<b:widget ${cleanedAttrs}>${rawContent}</b:widget>`
    }

    const resolved = resolveWidgetIncludables(widgetType, themeDefaultMarkups)
    const childrenBlocks = []

    if (widgetSettings) {
      childrenBlocks.push(formatNestedBlock(widgetSettings, indentChild, indentInner))
    }

    if (overrides.has('main')) {
      const targetName = overrides.get('main')
      childrenBlocks.push(
        `${indentChild}<b:includable id='main'>\n${indentInner}<b:include name='${targetName}'/>\n${indentChild}</b:includable>`,
      )
    }
    else if (hasDirectContent) {
      if (explicitIncludables.has('main')) {
        throw new Error(
          `Ambiguous content: Widget "${widgetId}" has an explicit "<b:includable id='main'>" and also direct content outside of any includable.`,
        )
      }
      const formattedMain = reindentBlock(directContent, indentInner)
      childrenBlocks.push(
        `${indentChild}<b:includable id='main'>\n${formattedMain}\n${indentChild}</b:includable>`,
      )
    }
    else if (explicitIncludables.has('main')) {
      childrenBlocks.push(formatNestedBlock(explicitIncludables.get('main'), indentChild, indentInner))
    }

    for (const [incId, targetName] of overrides) {
      if (incId === 'main')
        continue
      childrenBlocks.push(
        `${indentChild}<b:includable id='${incId}'>\n${indentInner}<b:include name='${targetName}'/>\n${indentChild}</b:includable>`,
      )
    }

    for (const [incId, tagText] of explicitIncludables) {
      if (incId === 'main')
        continue
      childrenBlocks.push(formatNestedBlock(tagText, indentChild, indentInner))
    }

    const handledIds = new Set([
      ...overrides.keys(),
      ...explicitIncludables.keys(),
      ...(hasDirectContent ? ['main'] : []),
    ])

    const neutralized = []
    for (const incId of resolved) {
      if (!handledIds.has(incId) && !isCleanInDefaultMarkups(incId, widgetType, themeDefaultMarkups)) {
        neutralized.push(incId)
      }
    }

    neutralized.sort((a, b) => {
      if (a === 'content')
        return -1
      if (b === 'content')
        return 1
      return a.localeCompare(b)
    })

    for (const incId of neutralized) {
      childrenBlocks.push(`${indentChild}<b:includable id='${incId}'/>`)
    }

    return `<b:widget ${cleanedAttrs}>\n${childrenBlocks.join('\n')}\n${baseIndent}</b:widget>`
  })

  let restored = result
  for (let i = codeBlocks.length - 1; i >= 0; i--) {
    restored = restored.replace(codeBlocks[i].placeholder, () => codeBlocks[i].match)
  }
  for (let i = cdataBlocks.length - 1; i >= 0; i--) {
    restored = restored.replace(cdataBlocks[i].placeholder, () => cdataBlocks[i].match)
  }

  return restored
}
