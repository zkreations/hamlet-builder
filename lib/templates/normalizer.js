import { sanitizeSpacing } from '../utils/index.js'

const B_EXPR_ATTRS = ['cond', 'expr', 'values', 'value']
const B_EXPR_PATTERN = B_EXPR_ATTRS.join('|')
const B_ATTR_REGEX = new RegExp(`\\b(${B_EXPR_PATTERN})\\s*=\\s*(['"])([\\s\\S]*?)\\2`, 'g')
const EXPR_ATTR_REGEX = /\b(expr:[\w:-]+)\s*=\s*(['"])([\s\S]*?)\2/g

function normalizeSpacing(value) {
  return value
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeExprAttributes(template) {
  if (typeof template !== 'string')
    return ''

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

  safeTemplate = safeTemplate.replace(EXPR_ATTR_REGEX, (match, attrName, quote, exprValue) => {
    return `${attrName}=${quote}${normalizeSpacing(exprValue)}${quote}`
  })

  for (let i = codeBlocks.length - 1; i >= 0; i--) {
    safeTemplate = safeTemplate.replace(codeBlocks[i].placeholder, () => codeBlocks[i].match)
  }
  for (let i = cdataBlocks.length - 1; i >= 0; i--) {
    safeTemplate = safeTemplate.replace(cdataBlocks[i].placeholder, () => cdataBlocks[i].match)
  }

  return safeTemplate
}

export function normalizeBloggerTag(bTagAttrs) {
  if (typeof bTagAttrs !== 'string')
    return ''

  const withExprs = bTagAttrs.replace(B_ATTR_REGEX, (attrMatch, attrName, quote, attrValue) => {
    return `${attrName}=${quote}${normalizeSpacing(attrValue)}${quote}`
  })

  return sanitizeSpacing(withExprs)
}

export function normalizeBloggerExpressions(template) {
  if (typeof template !== 'string')
    return ''

  const withExprs = normalizeExprAttributes(template)

  return withExprs.replace(/<b:((?:[^>'"]|"[^"]*"|'[^']*')+>)/g, (match, bTagAttrs) => {
    return `<b:${normalizeBloggerTag(bTagAttrs)}`
  })
}
