import { detectBaseIndent, shiftIndent } from '../utils/index.js'

const VAR_ATTR_REGEX = /\bvar:([\w.-]+)\s*=\s*(['"])([\s\S]*?)\2/g

export function expandMultiWith(template) {
  if (typeof template !== 'string' || !template.includes('<b:with'))
    return template

  const cdataBlocks = []
  let safeTemplate = template.replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, (match) => {
    const placeholder = `__HAMLET_CDATA_${cdataBlocks.length}__`
    cdataBlocks.push({ placeholder, match })
    return placeholder
  })

  const codeBlocks = []
  safeTemplate = safeTemplate.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (match) => {
    const placeholder = `__HAMLET_CODE_${codeBlocks.length}__`
    codeBlocks.push({ placeholder, match })
    return placeholder
  })

  let hasMore = true
  let iterations = 0
  const MAX_ITERATIONS = 1000

  while (hasMore && iterations < MAX_ITERATIONS) {
    iterations++
    const openMatches = [...safeTemplate.matchAll(/<b:with\b((?:[^>'"]|"[^"]*"|'[^']*')+>)/g)]
    const targetMatch = openMatches.find(m => /\bvar:[\w.-]+\s*=/.test(m[1]))

    if (!targetMatch) {
      hasMore = false
      break
    }

    const fullOpenTag = targetMatch[0]
    const attrsStr = targetMatch[1]
    const openStart = targetMatch.index
    const openEnd = openStart + fullOpenTag.length

    const varMatches = [...attrsStr.matchAll(VAR_ATTR_REGEX)]
    const vars = varMatches.map(m => ({
      name: m[1],
      quote: m[2],
      value: m[3],
    }))

    const isSelfClosing = /\/\s*>$/.test(fullOpenTag)
    const { baseIndent, stepIndent } = detectBaseIndent(safeTemplate, openStart)

    if (isSelfClosing) {
      if (vars.length === 1) {
        const replacement = `<b:with value=${vars[0].quote}${vars[0].value}${vars[0].quote} var=${vars[0].quote}${vars[0].name}${vars[0].quote}></b:with>`
        safeTemplate = safeTemplate.slice(0, openStart) + replacement + safeTemplate.slice(openEnd)
        continue
      }

      const isMultiline = fullOpenTag.includes('\n')
      if (isMultiline) {
        const openLines = vars.map((v, i) => `${i === 0 ? '' : baseIndent + stepIndent.repeat(i)}<b:with value=${v.quote}${v.value}${v.quote} var=${v.quote}${v.name}${v.quote}>`)
        const closeLines = []
        for (let i = vars.length - 1; i >= 0; i--) {
          closeLines.push(`${baseIndent}${stepIndent.repeat(i)}</b:with>`)
        }
        const replacement = [...openLines, ...closeLines].join('\n')
        safeTemplate = safeTemplate.slice(0, openStart) + replacement + safeTemplate.slice(openEnd)
      }
      else {
        const openTags = vars.map(v => `<b:with value=${v.quote}${v.value}${v.quote} var=${v.quote}${v.name}${v.quote}>`).join('')
        const closeTags = '</b:with>'.repeat(vars.length)
        safeTemplate = safeTemplate.slice(0, openStart) + openTags + closeTags + safeTemplate.slice(openEnd)
      }
      continue
    }

    let depth = 1
    const tagMatches = [...safeTemplate.slice(openEnd).matchAll(/<(\/)?b:with\b(?:[^>'"]|"[^"]*"|'[^']*')*>/g)]

    let closeStart = -1
    let closeEnd = -1

    for (const tagMatch of tagMatches) {
      const isClose = tagMatch[1] === '/'
      const fullMatch = tagMatch[0]

      if (isClose) {
        depth--
        if (depth === 0) {
          closeStart = openEnd + tagMatch.index
          closeEnd = closeStart + fullMatch.length
          break
        }
      }
      else {
        const selfClose = /\/\s*>$/.test(fullMatch)
        if (!selfClose) {
          depth++
        }
      }
    }

    const isMultiline = fullOpenTag.includes('\n')
      || (closeStart !== -1 && safeTemplate.slice(openStart, closeEnd).includes('\n'))

    if (closeStart === -1) {
      const openReplacement = vars
        .map((v, i) => `${!isMultiline || i === 0 ? '' : baseIndent + stepIndent.repeat(i)}<b:with value=${v.quote}${v.value}${v.quote} var=${v.quote}${v.name}${v.quote}>`)
        .join(isMultiline ? '\n' : '')
      safeTemplate = safeTemplate.slice(0, openStart) + openReplacement + safeTemplate.slice(openEnd)
      continue
    }

    if (!isMultiline) {
      const openReplacement = vars
        .map(v => `<b:with value=${v.quote}${v.value}${v.quote} var=${v.quote}${v.name}${v.quote}>`)
        .join('')
      const closeReplacement = '</b:with>'.repeat(vars.length)

      safeTemplate
        = safeTemplate.slice(0, openStart)
          + openReplacement
          + safeTemplate.slice(openEnd, closeStart)
          + closeReplacement
          + safeTemplate.slice(closeEnd)
      continue
    }

    const openLines = vars.map((v, i) => {
      const indent = i === 0 ? '' : baseIndent + stepIndent.repeat(i)
      return `${indent}<b:with value=${v.quote}${v.value}${v.quote} var=${v.quote}${v.name}${v.quote}>`
    })
    const openReplacement = openLines.join('\n')

    const levelsToAdd = vars.length - 1
    const shiftInnerContent = (rawText) => {
      if (levelsToAdd <= 0 || !rawText)
        return rawText || ''

      const firstNewline = rawText.indexOf('\n')
      if (firstNewline === -1)
        return rawText

      if (rawText.startsWith('\n') || rawText.startsWith('\r\n')) {
        return shiftIndent(rawText, levelsToAdd, stepIndent)
      }

      const inlinePart = rawText.slice(0, firstNewline + 1)
      const multilinePart = rawText.slice(firstNewline + 1)
      return inlinePart + shiftIndent(multilinePart, levelsToAdd, stepIndent)
    }

    const lastNewlineBeforeClose = safeTemplate.lastIndexOf('\n', closeStart)
    const lineBeforeClose = lastNewlineBeforeClose === -1
      ? safeTemplate.slice(0, closeStart)
      : safeTemplate.slice(lastNewlineBeforeClose + 1, closeStart)
    const isCloseOnOwnLine = /^[\t ]*$/.test(lineBeforeClose)

    if (isCloseOnOwnLine) {
      const closeLines = []
      for (let i = vars.length - 1; i >= 0; i--) {
        closeLines.push(`${baseIndent}${stepIndent.repeat(i)}</b:with>`)
      }
      const rawInner = safeTemplate.slice(openEnd, lastNewlineBeforeClose + 1)
      const innerContent = shiftInnerContent(rawInner)

      safeTemplate
        = safeTemplate.slice(0, openStart)
          + openReplacement
          + innerContent
          + closeLines.join('\n')
          + safeTemplate.slice(closeEnd)
    }
    else {
      const closeReplacement = '</b:with>'.repeat(vars.length)
      const rawInner = safeTemplate.slice(openEnd, closeStart)
      const innerContent = shiftInnerContent(rawInner)

      safeTemplate
        = safeTemplate.slice(0, openStart)
          + openReplacement
          + innerContent
          + closeReplacement
          + safeTemplate.slice(closeEnd)
    }
  }

  for (let i = codeBlocks.length - 1; i >= 0; i--) {
    safeTemplate = safeTemplate.replace(codeBlocks[i].placeholder, () => codeBlocks[i].match)
  }
  for (let i = cdataBlocks.length - 1; i >= 0; i--) {
    safeTemplate = safeTemplate.replace(cdataBlocks[i].placeholder, () => cdataBlocks[i].match)
  }

  return safeTemplate
}
