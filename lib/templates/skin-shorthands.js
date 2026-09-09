import { getAttrValue } from '../utils/index.js'

/**
 * Valid subproperties allowed for specific Blogger skin variable types:
 * - background: image, color
 * - color: red, green, blue, alpha, inverse, transparent
 * - font: size, family
 */
export const ALLOWED_SUBPROPERTIES = {
  background: new Set(['image', 'color']),
  color: new Set(['red', 'green', 'blue', 'alpha', 'inverse', 'transparent']),
  font: new Set(['size', 'family']),
}

/**
 * Collects all <Variable ...> declarations from the template,
 * indexing them by both raw name (with dots) and normalized name (with underscores).
 *
 * @returns {Map<string, { name: string, normalizedName: string, type: string }>} Map of declared variables indexed by raw and normalized names.
 */
export function collectDeclaredSkinVariables(template) {
  const varsMap = new Map()
  if (typeof template !== 'string')
    return varsMap

  const variableRegex = /<Variable\b([^>]*?)\/?>/gi

  for (const match of template.matchAll(variableRegex)) {
    const attrs = match[1]
    const name = getAttrValue(attrs, 'name')
    if (!name)
      continue

    const trimmedName = name.trim()
    const type = getAttrValue(attrs, 'type') || 'string'
    const normalizedName = trimmedName.replace(/\./g, '_')

    const varData = {
      name: trimmedName,
      normalizedName,
      type: type.toLowerCase().trim(),
    }

    // Index by both original name and normalized name
    varsMap.set(trimmedName, varData)
    varsMap.set(normalizedName, varData)
  }

  return varsMap
}

/**
 * Fallback lexical normalizer when no declared variable catalog is available
 * (e.g. isolated partials or test fragments).
 */
export function normalizeSkinVarName(name) {
  if (typeof name !== 'string')
    return ''

  const lastDotIndex = name.lastIndexOf('.')
  if (lastDotIndex === -1)
    return name

  const suffix = name.slice(lastDotIndex + 1)
  const prefix = name.slice(0, lastDotIndex)

  const isBackgroundSubprop = suffix === 'image' || (suffix === 'color' && /(?:^|[._])(?:background|bg)$/i.test(prefix))
  const isColorSubprop = ALLOWED_SUBPROPERTIES.color.has(suffix)
  const isFontSubprop = ALLOWED_SUBPROPERTIES.font.has(suffix)

  if (isBackgroundSubprop || isColorSubprop || isFontSubprop) {
    const normalizedPrefix = prefix.replace(/\./g, '_')
    return `${normalizedPrefix}.${suffix}`
  }

  return name.replace(/\./g, '_')
}

/**
 * Resolves and validates a skin variable identifier using the declared variables map:
 * 1. Checks if the variable exists; warns if undeclared.
 * 2. Checks if a subproperty is used, verifying it matches the variable's type.
 * 3. Formats to the exact Blogger data path (e.g. c_uiScheme, body_background.image).
 */
export function resolveSkinVariable(varName, declaredVariables = new Map()) {
  if (typeof varName !== 'string')
    return ''

  // If no variables are declared in the document (isolated snippet or partial), use lexical fallback
  if (declaredVariables.size === 0) {
    return normalizeSkinVarName(varName)
  }

  // Case 1: Exact match with declared variable name (no subproperty)
  if (declaredVariables.has(varName)) {
    const varData = declaredVariables.get(varName)
    return varData.normalizedName
  }

  // Case 2: Check if using a subproperty (.image, .color, .red, .size, etc.)
  const lastDotIndex = varName.lastIndexOf('.')
  if (lastDotIndex !== -1) {
    const baseName = varName.slice(0, lastDotIndex)
    const suffix = varName.slice(lastDotIndex + 1)

    if (declaredVariables.has(baseName)) {
      const varData = declaredVariables.get(baseName)
      const allowedSubs = ALLOWED_SUBPROPERTIES[varData.type]

      if (allowedSubs) {
        if (allowedSubs.has(suffix)) {
          return `${varData.normalizedName}.${suffix}`
        }
        else {
          console.warn(
            `The skin variable "${varData.name}" of type "${varData.type}" does not support the subproperty ".${suffix}". Allowed subproperties: ${[...allowedSubs].join(', ')}.`,
          )
          return `${varData.normalizedName}.${suffix}`
        }
      }
      else {
        console.warn(
          `The skin variable "${varData.name}" of type "${varData.type}" does not have subproperties. Using ".${suffix}" will break the Blogger theme.`,
        )
        return `${varData.normalizedName}.${suffix}`
      }
    }
  }

  // Case 3: Undeclared variable used in template
  console.warn(
    `The skin variable "${varName}" is used but not declared in <b:skin>. Using undeclared skin variables will break the Blogger theme.`,
  )

  return normalizeSkinVarName(varName)
}

/**
 * Expands skin variable shorthands inside an expression string,
 * protecting string literals from replacement.
 *
 * Supports both skin:variable and $skin.variable.
 */
export function expandSkinExpression(exprString, declaredVariables = new Map()) {
  if (typeof exprString !== 'string')
    return ''

  // Protect string literals ("..." and '...')
  const stringLiterals = []
  let safeExpr = exprString.replace(/(['"])([\s\S]*?)\1/g, (match) => {
    const placeholder = `__HAMLET_STR_${stringLiterals.length}__`
    stringLiterals.push({ match, placeholder })
    return placeholder
  })

  // Replace skin:variable
  safeExpr = safeExpr.replace(/\bskin:([\w.-]+)/g, (_, varName) => {
    const resolved = resolveSkinVariable(varName, declaredVariables)
    return `data:skin.vars.${resolved}`
  })

  // Replace $skin.variable
  safeExpr = safeExpr.replace(/\$skin\.([\w.-]+)/g, (_, varName) => {
    const resolved = resolveSkinVariable(varName, declaredVariables)
    return `data:skin.vars.${resolved}`
  })

  // Restore string literals
  for (let i = stringLiterals.length - 1; i >= 0; i--) {
    safeExpr = safeExpr.replace(stringLiterals[i].placeholder, () => stringLiterals[i].match)
  }

  return safeExpr
}

/**
 * Expands skin variable shorthands across a template:
 * 1. Collects declared variables from the document.
 * 2. XML nodes: <skin:variable/> => <data:skin.vars.variable/>
 * 3. Expressions in attributes: cond, expr:*, values, value, var, data
 */
export function expandSkinShorthands(template) {
  if (typeof template !== 'string')
    return ''

  const declaredVariables = collectDeclaredSkinVariables(template)

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

  // 1. Expand XML elements: <skin:name/> or <skin:name></skin:name>
  safeTemplate = safeTemplate.replace(/<skin:([\w.-]+)\s*(?:\/>|>([\s\S]*?)<\/skin:\1>)/gi, (_, varName) => {
    const resolved = resolveSkinVariable(varName, declaredVariables)
    return `<data:skin.vars.${resolved}/>`
  })

  // 2. Expand expressions in attributes (cond, expr:*, values, value, var, data)
  const attrRegex = /\b(cond|values?|var|data|expr:[\w:-]+)\s*=\s*(['"])([\s\S]*?)\2/gi
  safeTemplate = safeTemplate.replace(attrRegex, (match, attrName, quote, attrValue) => {
    if (attrValue.includes('skin:') || attrValue.includes('$skin.')) {
      const expanded = expandSkinExpression(attrValue, declaredVariables)
      return `${attrName}=${quote}${expanded}${quote}`
    }
    return match
  })

  // Restore script, style, and CDATA blocks
  for (let i = codeBlocks.length - 1; i >= 0; i--) {
    safeTemplate = safeTemplate.replace(codeBlocks[i].placeholder, () => codeBlocks[i].match)
  }
  for (let i = cdataBlocks.length - 1; i >= 0; i--) {
    safeTemplate = safeTemplate.replace(cdataBlocks[i].placeholder, () => cdataBlocks[i].match)
  }

  return safeTemplate
}
