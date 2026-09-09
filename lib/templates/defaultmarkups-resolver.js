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

const NATIVE_GROUPS = Object.keys(markups?.defaultmarkups ?? {})

export function resolveDocumentDefaultMarkups(template, options = {}) {
  if (typeof template !== 'string' || !template.includes('<b:defaultmarkups'))
    return template

  const rootDirectives = extractRootDirectives(template, { file: options.file })
  const shouldResolve = resolveEffectiveDocumentOption(
    'resolveMarkups',
    rootDirectives,
    options.hamlet,
    true,
    parseBooleanDirective,
  )

  if (!shouldResolve) {
    return stripRootDirectives(template)
  }

  const shouldMerge = resolveEffectiveDocumentOption(
    'mergeMarkups',
    rootDirectives,
    options.hamlet,
    false,
    parseBooleanDirective,
  )

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

  const defaultmarkupsBlockRegex = /<b:defaultmarkups\b[^>]*?(?:\/>|>([\s\S]*?)<\/b:defaultmarkups>)/gi
  const allBlocks = [...safeTemplate.matchAll(defaultmarkupsBlockRegex)]

  if (allBlocks.length === 0) {
    return restoreCodeAndCdata(safeTemplate, codeBlocks, cdataBlocks)
  }

  const firstIndex = allBlocks[0].index ?? 0
  const { baseIndent, stepIndent } = detectBaseIndent(safeTemplate, firstIndex)
  const indentMarkup = baseIndent + stepIndent
  const indentIncludable = indentMarkup + stepIndent
  const indentInner = indentIncludable + stepIndent

  const effectiveTypeMarkups = new Map()
  const definedTypeOrder = []

  const defaultMarkupRegex = /<b:defaultmarkup\b([^>]*)>([\s\S]*?)<\/b:defaultmarkup>/gi
  const blocksToProcess = shouldMerge ? allBlocks : [allBlocks[0]]

  for (const block of blocksToProcess) {
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

  const consolidatedBlocks = []

  for (const groupKey of NATIVE_GROUPS) {
    const nativeIncludables = markups.defaultmarkups[groupKey] || []
    const explicitMap = effectiveTypeMarkups.get(groupKey) || new Map()

    const blockIncludables = []

    for (const [, tagText] of explicitMap) {
      blockIncludables.push(formatNestedBlock(tagText, indentIncludable, indentInner))
    }

    const missing = []
    for (const nativeId of nativeIncludables) {
      if (!explicitMap.has(nativeId)) {
        missing.push(nativeId)
      }
    }

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

  let isFirst = true
  const result = safeTemplate.replace(defaultmarkupsBlockRegex, (match) => {
    if (isFirst) {
      isFirst = false
      return consolidatedXml
    }
    return shouldMerge ? '' : match
  })

  const cleanedResult = shouldMerge
    ? result.replace(/\n\s*\n\s*\n/g, '\n\n')
    : result

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
