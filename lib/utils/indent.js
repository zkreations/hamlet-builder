/**
 * Detects the step indentation (e.g. '  ', '    ', '\t') of a source string.
 *
 * @param {string} source The full or partial source string.
 * @param {string} [fallback] The default fallback step indentation.
 * @returns {string} The detected step indentation.
 */
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

/**
 * Detects the base indentation and step indentation of a line containing a target match index.
 *
 * @param {string} source The full source string.
 * @param {number} index The character index in source.
 * @param {object} [options] Detection options.
 * @param {string} [options.fallbackStep] Fallback step indentation.
 * @param {boolean} [options.lookahead] Whether to inspect following lines for child indentation step.
 * @returns {{ baseIndent: string, stepIndent: string }} The detected base indent and step indent.
 */
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

/**
 * Strips the minimum common leading whitespace from all non-empty lines in a block.
 *
 * @param {string} text The text to strip indentation from.
 * @returns {string} The stripped text.
 */
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

/**
 * Shifts indentation of every non-empty line by a number of levels (positive to indent, negative to dedent).
 *
 * @param {string} text The multi-line text to shift.
 * @param {number} [levels] Number of indentation levels to shift.
 * @param {string} [stepIndent] Indentation string per level.
 * @returns {string} The shifted text.
 */
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

/**
 * Indents each non-empty line of text with the given indentation string or level count.
 *
 * @param {string} text The multi-line text to indent.
 * @param {string|number} [indent] The indentation string or level count to prepend.
 * @param {object} [options]
 * @param {string} [options.stepIndent] The step indent when indent is a number.
 * @returns {string} The indented text.
 */
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

/**
 * Trims leading and trailing blank lines from text while preserving
 * the horizontal indentation of all non-empty lines (including the first non-empty line).
 *
 * @param {string} text The text to trim.
 * @returns {string} The text with leading and trailing blank lines removed.
 */
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

/**
 * Normalizes a block of text so its outermost non-empty lines start at targetIndent,
 * preserving internal relative indentation.
 *
 * @param {string} text The multi-line text to re-indent.
 * @param {string} [targetIndent] Target base indentation string.
 * @returns {string} The re-indented text.
 */
export function reindentBlock(text, targetIndent = '') {
  if (!text)
    return text || ''

  const stripped = stripIndent(text)
  return indentBlock(stripped, targetIndent)
}

/**
 * Formats a nested XML element (e.g. <b:includable>), preserving relative internal indentation
 * while anchoring the outer tags and inner content to target indentation levels.
 *
 * @param {string} tagText The full XML text of the element.
 * @param {string} outerIndent The indentation for the element's opening and closing tags.
 * @param {string} innerIndent The indentation for the element's child content.
 * @returns {string} The nicely formatted element string.
 */
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
