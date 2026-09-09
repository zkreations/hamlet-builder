export function detectStepIndent(source, fallback = '  ') {
  if (typeof source !== 'string' || !source.trim()) {
    return fallback
  }

  const lines = source.split(/\r?\n/)
  let tabCount = 0
  let spaceCount = 0
  const spaceDeltas = new Map()
  let prevIndent = null

  for (const line of lines) {
    if (line.trim().length === 0)
      continue

    const match = line.match(/^([\t ]*)/)
    const indent = match ? match[1] : ''

    if (indent.includes('\t')) {
      tabCount++
      prevIndent = null
    }
    else if (indent.length > 0) {
      spaceCount++
      const currentSpaces = indent.length
      if (prevIndent !== null && prevIndent > 0) {
        const delta = Math.abs(currentSpaces - prevIndent)
        if (delta > 0) {
          spaceDeltas.set(delta, (spaceDeltas.get(delta) || 0) + 1)
        }
      }
      prevIndent = currentSpaces
    }
    else {
      prevIndent = 0
    }
  }

  if (tabCount > spaceCount && tabCount > 0) {
    return '\t'
  }

  if (spaceDeltas.size > 0) {
    const count4 = spaceDeltas.get(4) || 0
    const count2 = spaceDeltas.get(2) || 0

    if (count4 > count2 && count2 === 0) {
      return '    '
    }
    if (count2 > 0) {
      return '  '
    }
    if (count4 > 0) {
      return '    '
    }

    let maxFreq = 0
    let bestDelta = 2
    for (const [delta, freq] of spaceDeltas.entries()) {
      if (freq > maxFreq) {
        maxFreq = freq
        bestDelta = delta
      }
    }
    return ' '.repeat(bestDelta)
  }

  return fallback
}

export function detectBaseIndent(source, index, options = {}) {
  const { fallbackStep = '  ', lookahead = true } = options

  if (!source || index <= 0) {
    return { baseIndent: '', stepIndent: fallbackStep }
  }

  const lastNewline = source.lastIndexOf('\n', index)
  const lineBefore = lastNewline === -1
    ? source.slice(0, index)
    : source.slice(lastNewline + 1, index)

  const isOnlyWhitespace = /^[\t ]*$/.test(lineBefore)
  const baseIndent = isOnlyWhitespace ? lineBefore : ''

  if (baseIndent.includes('\t')) {
    return { baseIndent, stepIndent: '\t' }
  }

  if (lookahead && index < source.length) {
    const nextNewline = source.indexOf('\n', index)
    if (nextNewline !== -1) {
      const afterMatch = source.slice(nextNewline + 1)
      const lines = afterMatch.split(/\r?\n/)
      for (const line of lines) {
        if (line.trim().length > 0) {
          const match = line.match(/^([\t ]*)/)
          const nextIndent = match ? match[1] : ''
          if (nextIndent.startsWith(baseIndent) && nextIndent.length > baseIndent.length) {
            const step = nextIndent.slice(baseIndent.length)
            if (/^ +$/.test(step) || /^\t+$/.test(step)) {
              return { baseIndent, stepIndent: step }
            }
          }
          break
        }
      }
    }
  }

  const stepIndent = detectStepIndent(source, fallbackStep)
  return { baseIndent, stepIndent }
}

export function stripIndent(text) {
  if (!text)
    return text || ''

  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)
  let minCommon = null

  for (const line of lines) {
    if (line.trim().length > 0) {
      const leading = line.match(/^[\t ]*/)[0]
      if (minCommon === null || leading.length < minCommon.length) {
        minCommon = leading
      }
    }
  }

  if (!minCommon)
    return text

  return lines
    .map((line) => {
      if (line.trim().length === 0)
        return ''
      return line.startsWith(minCommon) ? line.slice(minCommon.length) : line.trimStart()
    })
    .join(eol)
}

export function shiftIndent(text, levels = 1, stepIndent = '  ') {
  if (!text || levels === 0)
    return text || ''

  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)

  if (levels > 0) {
    const prefix = stepIndent.repeat(levels)
    return lines
      .map(line => (line.trim().length > 0 ? `${prefix}${line}` : ''))
      .join(eol)
  }

  const removeCount = Math.abs(levels) * stepIndent.length
  return lines
    .map((line) => {
      if (line.trim().length === 0)
        return ''
      const match = line.match(/^[\t ]+/)
      if (!match)
        return line
      const leading = match[0]
      const toRemove = Math.min(leading.length, removeCount)
      return line.slice(toRemove)
    })
    .join(eol)
}

export function indentBlock(text, indent = '', options = {}) {
  if (!text)
    return text || ''

  const resolvedIndent = typeof indent === 'number'
    ? (options.stepIndent || '  ').repeat(indent)
    : indent

  if (!resolvedIndent)
    return text

  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  return text
    .split(/\r?\n/)
    .map(line => (line.trim().length > 0 ? `${resolvedIndent}${line}` : ''))
    .join(eol)
}

export function trimBlankLines(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return ''
  }

  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)
  let start = 0
  while (start < lines.length && lines[start].trim().length === 0) {
    start++
  }
  let end = lines.length - 1
  while (end >= start && lines[end].trim().length === 0) {
    end--
  }

  return lines.slice(start, end + 1).join(eol)
}

export function reindentBlock(text, targetIndent = '') {
  if (!text)
    return text || ''

  const stripped = stripIndent(text)
  return indentBlock(stripped, targetIndent)
}

export function formatNestedBlock(tagText, outerIndent = '', innerIndent = '') {
  const trimmed = (tagText || '').trim()
  if (!trimmed.includes('\n')) {
    return `${outerIndent}${trimmed}`
  }

  const eol = tagText.includes('\r\n') ? '\r\n' : '\n'
  const lines = trimmed.split(/\r?\n/)
  const firstLine = `${outerIndent}${lines[0].trim()}`
  const lastLine = `${outerIndent}${lines[lines.length - 1].trim()}`

  const rawInnerLines = lines.slice(1, -1)
  const cleanedInner = trimBlankLines(rawInnerLines.join(eol))
  if (!cleanedInner) {
    return [firstLine, lastLine].join(eol)
  }

  const formattedInner = reindentBlock(cleanedInner, innerIndent)
  return [firstLine, formattedInner, lastLine].join(eol)
}
