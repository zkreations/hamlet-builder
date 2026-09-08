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

    if (isSelfClosing) {
      const replacement = vars
        .map(v => `<b:with value=${v.quote}${v.value}${v.quote} var=${v.quote}${v.name}${v.quote}>`)
        .join('\n') + '</b:with>'.repeat(vars.length)
      safeTemplate = safeTemplate.slice(0, openStart) + replacement + safeTemplate.slice(openEnd)
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

    if (closeStart === -1) {
      const replacement = vars
        .map(v => `<b:with value=${v.quote}${v.value}${v.quote} var=${v.quote}${v.name}${v.quote}>`)
        .join('\n')
      safeTemplate = safeTemplate.slice(0, openStart) + replacement + safeTemplate.slice(openEnd)
      continue
    }

    const closeReplacement = '</b:with>'.repeat(vars.length)
    const openReplacement = vars
      .map(v => `<b:with value=${v.quote}${v.value}${v.quote} var=${v.quote}${v.name}${v.quote}>`)
      .join('\n')

    safeTemplate
      = safeTemplate.slice(0, openStart)
        + openReplacement
        + safeTemplate.slice(openEnd, closeStart)
        + closeReplacement
        + safeTemplate.slice(closeEnd)
  }

  for (let i = codeBlocks.length - 1; i >= 0; i--) {
    safeTemplate = safeTemplate.replace(codeBlocks[i].placeholder, () => codeBlocks[i].match)
  }
  for (let i = cdataBlocks.length - 1; i >= 0; i--) {
    safeTemplate = safeTemplate.replace(cdataBlocks[i].placeholder, () => cdataBlocks[i].match)
  }

  return safeTemplate
}
