const RESERVED_ATTRS = new Set(['name', 'expr:name', 'cond', 'data'])
const ATTR_REGEX = /\b([\w:-]+)\s*=\s*(['"])([\s\S]*?)\2/g

export function parseObjectEntries(rawObj) {
  const trimmed = rawObj.trim()
  const content = trimmed.startsWith('{') && trimmed.endsWith('}')
    ? trimmed.slice(1, -1).trim()
    : trimmed

  const entries = new Map()
  if (!content)
    return entries

  let depth = 0
  let inQuote = null
  let isEscaped = false
  let start = 0

  const tokens = []
  for (let i = 0; i < content.length; i++) {
    const char = content[i]

    if (isEscaped) {
      isEscaped = false
      continue
    }

    if (char === '\\') {
      isEscaped = true
      continue
    }

    if (inQuote) {
      if (char === inQuote)
        inQuote = null
      continue
    }

    if (char === '"' || char === '\'') {
      inQuote = char
      continue
    }

    if (char === '(' || char === '[' || char === '{') {
      depth++
    }
    else if (char === ')' || char === ']' || char === '}') {
      depth--
    }
    else if (char === ',' && depth === 0) {
      tokens.push(content.slice(start, i).trim())
      start = i + 1
    }
  }

  if (start < content.length) {
    const lastToken = content.slice(start).trim()
    if (lastToken)
      tokens.push(lastToken)
  }

  for (const token of tokens) {
    let colonIdx = -1
    let tDepth = 0
    let tQuote = null
    let tEscaped = false

    for (let i = 0; i < token.length; i++) {
      const c = token[i]
      if (tEscaped) {
        tEscaped = false
        continue
      }
      if (c === '\\') {
        tEscaped = true
        continue
      }
      if (tQuote) {
        if (c === tQuote)
          tQuote = null
        continue
      }
      if (c === '"' || c === '\'') {
        tQuote = c
        continue
      }
      if (c === '(' || c === '[' || c === '{') {
        tDepth++
      }
      else if (c === ')' || c === ']' || c === '}') {
        tDepth--
      }
      else if (c === ':' && tDepth === 0) {
        colonIdx = i
        break
      }
    }

    if (colonIdx !== -1) {
      const key = token.slice(0, colonIdx).trim()
      const val = token.slice(colonIdx + 1).trim()
      if (key)
        entries.set(key, val)
    }
  }

  return entries
}

export function formatPropertyValue(rawValue, isExpr) {
  const val = rawValue.trim()
  if (isExpr)
    return val

  if (
    (val.startsWith('"') && val.endsWith('"'))
    || (val.startsWith('\'') && val.endsWith('\''))
  ) {
    const inner = val.slice(1, -1)
    return `"${inner.replace(/"/g, '\\"')}"`
  }

  if (/^-?\d+(?:\.\d+)?$/.test(val))
    return val

  if (val === 'true' || val === 'false' || val === 'null' || val === 'nil')
    return val

  if (
    (val.startsWith('[') && val.endsWith(']'))
    || (val.startsWith('{') && val.endsWith('}'))
  ) {
    return val
  }

  if (val.startsWith('data:') || val.startsWith('data.') || val.includes('?:'))
    return val

  if (/^[a-z_$][\w$]*\s*\(/i.test(val) && val.endsWith(')'))
    return val

  return `"${val.replace(/"/g, '\\"')}"`
}

export function processIncludeElement(element) {
  if (!element.startsWith('<b:include'))
    return element

  const matches = [...element.matchAll(ATTR_REGEX)]
  if (matches.length === 0)
    return element

  const reserved = new Map()
  const customAttrs = []
  let dataAttrValue = null

  for (const match of matches) {
    const name = match[1]
    const rawVal = match[3]

    if (name === 'data') {
      dataAttrValue = rawVal
    }
    else if (RESERVED_ATTRS.has(name)) {
      reserved.set(name, rawVal)
    }
    else {
      const isExpr = name.startsWith('expr:')
      const propName = isExpr ? name.slice(5) : name
      customAttrs.push({
        propName,
        value: rawVal,
        isExpr,
      })
    }
  }

  if (customAttrs.length === 0)
    return element

  const mergedEntries = new Map()

  if (dataAttrValue !== null) {
    const trimmedData = dataAttrValue.trim()
    if (trimmedData.startsWith('{') && trimmedData.endsWith('}')) {
      const existing = parseObjectEntries(trimmedData)
      for (const [k, v] of existing.entries()) {
        mergedEntries.set(k, v)
      }
    }
    else {
      console.warn(`Cannot merge direct attributes into <b:include> when "data" is not an object literal: ${dataAttrValue}`)
      return element
    }
  }

  for (const attr of customAttrs) {
    const formattedVal = formatPropertyValue(attr.value, attr.isExpr)
    mergedEntries.set(attr.propName, formattedVal)
  }

  const entriesList = []
  for (const [key, value] of mergedEntries.entries()) {
    entriesList.push(`${key}: ${value}`)
  }

  const dataString = `{ ${entriesList.join(', ')} }`

  let result = '<b:include'
  if (reserved.has('cond'))
    result += ` cond='${reserved.get('cond')}'`
  if (reserved.has('name'))
    result += ` name='${reserved.get('name')}'`
  if (reserved.has('expr:name'))
    result += ` expr:name='${reserved.get('expr:name')}'`

  for (const [k, v] of reserved.entries()) {
    if (k !== 'cond' && k !== 'name' && k !== 'expr:name') {
      result += ` ${k}='${v}'`
    }
  }

  result += ` data='${dataString}'`

  const isSelfClosing = /\/\s*>$/.test(element)
  result += isSelfClosing ? '/>' : '>'

  return result
}
