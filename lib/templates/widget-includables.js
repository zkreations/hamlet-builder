import { markups } from '../data/markups.js'
import {
  detectBaseIndent,
  formatNestedBlock,
  getAttrValue,
  reindentBlock,
  trimBlankLines,
} from '../utils/index.js'

/**
 * Normalizes boolean attributes on widget opening tags (e.g. locked -> locked='true').
 * Preserves explicit values (locked='false') and does not inject defaults when absent.
 */
export function normalizeBooleanAttributes(tagAttrs) {
  if (typeof tagAttrs !== 'string')
    return ''
  return tagAttrs.replace(/\b(locked|visible)\b(?!\s*=)/g, '$1=\'true\'')
}

/**
 * Resolves native Blogger markups for a given widget type from markups.js.
 * Matches 'All' and any comma-separated key containing widgetType.
 */
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

/**
 * Collects all <b:defaultmarkup type='...'> blocks from the template document,
 * grouping includables and their clean status by widget type.
 *
 * An includable is strictly considered clean if and only if it is self-closing (<b:includable .../>).
 * Successive definitions in document order overwrite earlier ones (Blogger cascade).
 */
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

    // Match self-closing <b:includable .../> or block <b:includable ...>...</b:includable>
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

/**
 * Determines if an includable is defined cleanly (strictly self-closing)
 * in the document's <b:defaultmarkups> for a specific widget type.
 *
 * Specific widget type definition takes precedence over 'All'.
 * Returns false if the includable is not defined in <b:defaultmarkups> at all,
 * or if its effective definition is not strictly self-closing.
 */
export function isCleanInDefaultMarkups(incId, widgetType, themeDefaultMarkups) {
  if (!themeDefaultMarkups || !(themeDefaultMarkups instanceof Map))
    return false

  // 1. Check specific widgetType
  if (themeDefaultMarkups.has(widgetType)) {
    const typeMap = themeDefaultMarkups.get(widgetType)
    if (typeMap instanceof Map && typeMap.has(incId)) {
      const entry = typeMap.get(incId)
      return typeof entry === 'object' && entry !== null ? Boolean(entry.isClean) : false
    }
  }

  // 2. Fallback to 'All'
  if (themeDefaultMarkups.has('All')) {
    const allMap = themeDefaultMarkups.get('All')
    if (allMap instanceof Map && allMap.has(incId)) {
      const entry = allMap.get(incId)
      return typeof entry === 'object' && entry !== null ? Boolean(entry.isClean) : false
    }
  }

  return false
}

/**
 * Resolves the final set of includables that Blogger would provide for a widget type,
 * combining native markups.js and all b:defaultmarkups defined in the theme.
 */
export function resolveWidgetIncludables(widgetType, themeDefaultMarkups = new Map()) {
  const result = new Set(getNativeMarkupsForType(widgetType))

  const getKeys = (container) => {
    if (!container)
      return []
    return container instanceof Map ? container.keys() : container
  }

  // Merge 'All' from theme defaultmarkups
  if (themeDefaultMarkups.has('All')) {
    for (const id of getKeys(themeDefaultMarkups.get('All'))) {
      result.add(id)
    }
  }

  // Merge specific widgetType from theme defaultmarkups
  if (themeDefaultMarkups.has(widgetType)) {
    for (const id of getKeys(themeDefaultMarkups.get(widgetType))) {
      result.add(id)
    }
  }

  return result
}

/**
 * Extracts override:<includable>='target' attributes from widget opening tag.
 */
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

/**
 * Parses widget child content into widget-settings, explicit includables, and direct content.
 */
function parseWidgetContent(content) {
  let remaining = content
  let widgetSettings = null

  // Extract <b:widget-settings>
  const settingsMatch = remaining.match(/<b:widget-settings\b[^>]*>[\s\S]*?<\/b:widget-settings>/i)
  if (settingsMatch) {
    widgetSettings = settingsMatch[0]
    remaining = remaining.replace(settingsMatch[0], '')
  }

  // Extract explicit <b:includable>
  const explicitIncludables = new Map()
  const includableRegex = /<b:includable\b([^>]*?)(?:\/>|>([\s\S]*?)<\/b:includable>)/gi

  for (const match of remaining.matchAll(includableRegex)) {
    const id = getAttrValue(match[1], 'id')
    if (id) {
      explicitIncludables.set(id.trim(), match[0])
    }
  }

  // Strip extracted includables to determine if direct content exists
  const withoutIncludables = remaining.replace(includableRegex, '')
  // Strip XML comments and whitespace
  const contentStripped = withoutIncludables.replace(/<!--[\s\S]*?-->/g, '').trim()
  const hasDirectContent = contentStripped.length > 0

  return {
    directContent: hasDirectContent ? trimBlankLines(withoutIncludables) : null,
    explicitIncludables,
    hasDirectContent,
    widgetSettings,
  }
}

/**
 * Expands clean widgets (those using override:* or direct content auto-wrapping)
 * across the template, ensuring all necessary includables are generated or neutralized.
 */
export function expandWidgetIncludables(template) {
  if (typeof template !== 'string' || !template.includes('<b:widget'))
    return template

  // Protect CDATA blocks
  const cdataBlocks = []
  let safeTemplate = template.replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, (match) => {
    const placeholder = `__HAMLET_CDATA_${cdataBlocks.length}__`
    cdataBlocks.push({ match, placeholder })
    return placeholder
  })

  // Protect script and style tags
  const codeBlocks = []
  safeTemplate = safeTemplate.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (match) => {
    const placeholder = `__HAMLET_CODE_${codeBlocks.length}__`
    codeBlocks.push({ match, placeholder })
    return placeholder
  })

  const themeDefaultMarkups = collectDocumentDefaultMarkups(safeTemplate)

  // Regex matching both self-closing <b:widget .../> and <b:widget ...>...</b:widget>
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
      // If self-closing and no overrides, preserve as-is (with normalized boolean attrs)
      if (overrides.size === 0) {
        return `<b:widget ${cleanedAttrs}/>`
      }

      // Self-closing with overrides -> enters clean widget mode
      const resolved = resolveWidgetIncludables(widgetType, themeDefaultMarkups)
      const generatedIncludables = []

      // 1. Overrides
      for (const [incId, targetName] of overrides) {
        generatedIncludables.push(
          `${indentChild}<b:includable id='${incId}'>\n${indentInner}<b:include name='${targetName}'/>\n${indentChild}</b:includable>`,
        )
      }

      // 2. Neutralize remaining resolved includables if not clean in defaultmarkups
      const neutralized = []
      for (const incId of resolved) {
        if (!overrides.has(incId) && !isCleanInDefaultMarkups(incId, widgetType, themeDefaultMarkups)) {
          neutralized.push(incId)
        }
      }

      // Deterministic order: 'content' first if present, then alphabetical
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

    // Block widget <b:widget ...>...</b:widget>
    const {
      widgetSettings,
      explicitIncludables,
      hasDirectContent,
      directContent,
    } = parseWidgetContent(rawContent)

    // Check for ambiguous conflict: override:<id> vs explicit <b:includable id='<id>'>
    for (const [incId] of overrides) {
      if (explicitIncludables.has(incId)) {
        throw new Error(
          `Ambiguous includable definition: Widget "${widgetId}" specifies "override:${incId}" as an attribute and also contains an explicit "<b:includable id='${incId}'>" element.`,
        )
      }
    }

    // Check if clean widget mode should activate
    const shouldActivateCleanMode = overrides.size > 0 || hasDirectContent

    if (!shouldActivateCleanMode) {
      // Traditional widget without overrides or direct content: preserve as-is
      return `<b:widget ${cleanedAttrs}>${rawContent}</b:widget>`
    }

    // Clean widget mode activated
    const resolved = resolveWidgetIncludables(widgetType, themeDefaultMarkups)
    const childrenBlocks = []

    // 1. widget-settings must come first
    if (widgetSettings) {
      childrenBlocks.push(formatNestedBlock(widgetSettings, indentChild, indentInner))
    }

    // 2. Main includable: override:main, or auto-wrapping, or explicit main
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

    // 3. Other overrides (excluding 'main')
    for (const [incId, targetName] of overrides) {
      if (incId === 'main')
        continue
      childrenBlocks.push(
        `${indentChild}<b:includable id='${incId}'>\n${indentInner}<b:include name='${targetName}'/>\n${indentChild}</b:includable>`,
      )
    }

    // 4. Other explicit includables (excluding 'main')
    for (const [incId, tagText] of explicitIncludables) {
      if (incId === 'main')
        continue
      childrenBlocks.push(formatNestedBlock(tagText, indentChild, indentInner))
    }

    // 5. Neutralize remaining resolved includables if not clean in defaultmarkups
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

    // Deterministic order: 'content' first if present, then alphabetical
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

  // Restore code and CDATA blocks
  let restored = result
  for (let i = codeBlocks.length - 1; i >= 0; i--) {
    restored = restored.replace(codeBlocks[i].placeholder, () => codeBlocks[i].match)
  }
  for (let i = cdataBlocks.length - 1; i >= 0; i--) {
    restored = restored.replace(cdataBlocks[i].placeholder, () => cdataBlocks[i].match)
  }

  return restored
}
