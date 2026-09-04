/**
 * Compile the regular expression for an attribute.
 *
 * @param {string} attr - The attribute to search
 * @returns {RegExp} Regular expression for matching the attribute
 */
export function regExpAttr(attr) {
  return new RegExp(`${attr}=['"](.*?)['"]`, 'g')
}

/**
 * Get attribute substring if found.
 *
 * @param {string} string - The string to search
 * @param {string} attr - The attribute to search
 * @returns {string | null} Found attribute or null
 */
export function getAttr(string, attr) {
  const REG_EXP = regExpAttr(attr)
  const match = string.match(REG_EXP)
  return match ? match[0] : null
}

/**
 * Remove an attribute from a string.
 *
 * @param {string} string - The string to search
 * @param {string} attr - The attribute to search
 * @returns {string} String with attribute removed
 */
export function removeAttr(string, attr) {
  const REG_EXP = regExpAttr(attr)
  return string.replace(REG_EXP, '')
}

/**
 * Get the value of an attribute.
 *
 * @param {string} string - The string to search
 * @param {string} attr - The attribute to search
 * @returns {string | null} Attribute value or null
 */
export function getAttrValue(string, attr) {
  const REG_EXP = regExpAttr(attr)
  const matches = Array.from(string.matchAll(REG_EXP), match => match[1])
  return matches.length > 0 ? matches[0] : null
}

/**
 * Replace the value of an attribute.
 *
 * @param {string} string - The string to search
 * @param {string} attr - The attribute to search
 * @param {string} value - The new value
 * @returns {string} String with replaced attribute value
 */
export function replaceAttrValue(string, attr, value) {
  const REG_EXP = regExpAttr(attr)
  return string.replace(REG_EXP, `${attr}='${value}'`)
}
