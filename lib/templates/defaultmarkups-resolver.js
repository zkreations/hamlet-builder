import { markups } from '../data/markups.js'
import {
  detectBaseIndent,
  formatNestedBlock,
  getAttrValue,
} from '../utils/index.js'
import {
  extractRootDirectives,
  parseBooleanDirective,
  resolveEffectiveDocumentOption,
  stripRootDirectives,
} from './root-directives.js'

/**
 * Native Blogger defaultmarkup groups from markups.js
 */
const NATIVE_GROUPS = Object.keys(markups?.defaultmarkups ?? {})

/**
 * Resolves all <b:defaultmarkups> blocks in a template document into a single,
 * normalized structure located at the first <b:defaultmarkups> position.
 *
 * Implements Blogger cascade semantics (later definitions overwrite earlier ones),
 * generates self-closing neutralizations for missing native includables,
 * preserves custom types like 'Common', and respects the resolveMarkups option/directive.
 */
export function resolveDocumentDefaultMarkups(template, options = {}) {
  if (typeof template !== 'string' || !template.includes('<b:defaultmarkups'))
    return template

  // Check for root directive or global config: resolveMarkups
  const rootDirectives = extractRootDirectives(template, { file: options.file })
  const shouldResolve = resolveEffectiveDocumentOption(
    'resolveMarkups',
    rootDirectives,
    options.hamlet,
    true,
    parseBooleanDirective,
  )

  if (!shouldResolve) {
    // Strip root directives from <html> and skip normalization
    return stripRootDirectives(template)
  }

  // Check for root directive or global config: mergeMarkups
  const shouldMerge = resolveEffectiveDocumentOption(
    'mergeMarkups',
    rootDirectives,
    options.hamlet,
    false,
    parseBooleanDirective,
  )

  if (!shouldMerge) {
    // Keep <b:defaultmarkups> blocks as authored without merging them
    return stripRootDirectives(template)
  }

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

  // Find all <b:defaultmarkups> blocks (including self-closing <b:defaultmarkups/>)
  const defaultmarkupsBlockRegex = /<b:defaultmarkups\b[^>]*?(?:\/>|>([\s\S]*?)<\/b:defaultmarkups>)/gi
  const allBlocks = [...safeTemplate.matchAll(defaultmarkupsBlockRegex)]

  if (allBlocks.length === 0) {
    return restoreCodeAndCdata(safeTemplate, codeBlocks, cdataBlocks)
  }

  // Calculate base indentation from the first <b:defaultmarkups> position
  const firstIndex = allBlocks[0].index ?? 0
  const { baseIndent, stepIndent } = detectBaseIndent(safeTemplate, firstIndex)
  const indentMarkup = baseIndent + stepIndent
  const indentIncludable = indentMarkup + stepIndent
  const indentInner = indentIncludable + stepIndent

  // Map of effective definitions per typeKey:
  // Map<typeKey, Map<includableId, fullTagText>>
  const effectiveTypeMarkups = new Map()
  const definedTypeOrder = []

  // Process all defaultmarkup elements in document sequential order (cascade)
  const defaultMarkupRegex = /<b:defaultmarkup\b([^>]*)>([\s\S]*?)<\/b:defaultmarkup>/gi

  for (const block of allBlocks) {
    const blockContent = block[1] || ''

    for (const markupMatch of blockContent.matchAll(defaultMarkupRegex)) {
      const openAttrs = markupMatch[1]
      const markupContent = markupMatch[2]
      const type = getAttrValue(openAttrs, 'type')

      if (!type)
        continue

      const trimmedType = type.trim()
      if (!effectiveTypeMarkups.has(trimmedType)) {
        effectiveTypeMarkups.set(trimmedType, new Map())
        definedTypeOrder.push(trimmedType)
      }

      const includableMap = effectiveTypeMarkups.get(trimmedType)
      const includableRegex = /<b:includable\b([^>]*?)(?:\/>|>([\s\S]*?)<\/b:includable>)/gi

      for (const incMatch of markupContent.matchAll(includableRegex)) {
        const incAttrs = incMatch[1]
        const id = getAttrValue(incAttrs, 'id')

        if (!id)
          continue

        const trimmedId = id.trim()
        if (includableMap.has(trimmedId)) {
          console.warn(
            `The includable "${trimmedId}" in defaultmarkup type="${trimmedType}" was redefined and overwritten by a subsequent definition.`,
          )
        }

        includableMap.set(trimmedId, incMatch[0].trim())
      }
    }
  }

  // Build the consolidated set of defaultmarkups
  const consolidatedBlocks = []

  // 1. Process native groups from markups.js
  for (const groupKey of NATIVE_GROUPS) {
    const nativeIncludables = markups.defaultmarkups[groupKey] || []
    const explicitMap = effectiveTypeMarkups.get(groupKey) || new Map()

    const blockIncludables = []

    // Add author's explicit includables for this group
    for (const [, tagText] of explicitMap) {
      blockIncludables.push(formatNestedBlock(tagText, indentIncludable, indentInner))
    }

    // Identify native includables that were not declared, and generate self-closing neutralizations
    const missing = []
    for (const nativeId of nativeIncludables) {
      if (!explicitMap.has(nativeId)) {
        missing.push(nativeId)
      }
    }

    // Deterministic order for missing neutralizations: 'content' first if present, then alphabetical
    missing.sort((a, b) => {
      if (a === 'content')
        return -1
      if (b === 'content')
        return 1
      return a.localeCompare(b)
    })

    for (const missingId of missing) {
      blockIncludables.push(`${indentIncludable}<b:includable id='${missingId}'/>`)
    }

    consolidatedBlocks.push(
      `${indentMarkup}<b:defaultmarkup type='${groupKey}'>\n${blockIncludables.join('\n')}\n${indentMarkup}</b:defaultmarkup>`,
    )
  }

  // 2. Process non-native custom groups (such as 'Common' or custom user groups)
  for (const typeKey of definedTypeOrder) {
    if (NATIVE_GROUPS.includes(typeKey))
      continue

    const customMap = effectiveTypeMarkups.get(typeKey)
    const blockIncludables = []

    for (const [, tagText] of customMap) {
      blockIncludables.push(formatNestedBlock(tagText, indentIncludable, indentInner))
    }

    consolidatedBlocks.push(
      `${indentMarkup}<b:defaultmarkup type='${typeKey}'>\n${blockIncludables.join('\n')}\n${indentMarkup}</b:defaultmarkup>`,
    )
  }

  const consolidatedXml = `<b:defaultmarkups>\n${consolidatedBlocks.join('\n')}\n${baseIndent}</b:defaultmarkups>`

  // Replace first <b:defaultmarkups> with consolidatedXml, and remove subsequent blocks
  let isFirst = true
  const result = safeTemplate.replace(defaultmarkupsBlockRegex, () => {
    if (isFirst) {
      isFirst = false
      return consolidatedXml
    }
    return ''
  })

  // Clean empty lines left behind by removed subsequent blocks
  const cleanedResult = result.replace(/\n\s*\n\s*\n/g, '\n\n')

  // Strip root directives from <html> if present
  const finalHtml = stripRootDirectives(cleanedResult)

  return restoreCodeAndCdata(finalHtml, codeBlocks, cdataBlocks)
}

function restoreCodeAndCdata(template, codeBlocks, cdataBlocks) {
  let restored = template
  for (let i = codeBlocks.length - 1; i >= 0; i--) {
    restored = restored.replace(codeBlocks[i].placeholder, () => codeBlocks[i].match)
  }
  for (let i = cdataBlocks.length - 1; i >= 0; i--) {
    restored = restored.replace(cdataBlocks[i].placeholder, () => cdataBlocks[i].match)
  }
  return restored
}
