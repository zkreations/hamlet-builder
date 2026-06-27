const PARTIAL_NAME_PATTERN = /^[A-Z][A-Z0-9]*(?:[._-][A-Z][A-Z0-9]*)*$/i
const HELPER_NAME_PATTERN = /^[A-Z][A-Z0-9]*(?:[-_][A-Z][A-Z0-9]*)*$/i
const NAMESPACE_PATTERN = /^[A-Z][A-Z0-9]*$/i

const BLOCKED_NAMES = new Set(['__proto__', 'constructor', 'prototype'])

// @param {String} name
// @return {Boolean}
export function isValidNamespace(name) {
  return typeof name === 'string'
    && NAMESPACE_PATTERN.test(name)
    && !BLOCKED_NAMES.has(name)
}

// @param {String} name
// @return {Boolean}
export function isValidPartialName(name) {
  return typeof name === 'string'
    && PARTIAL_NAME_PATTERN.test(name)
    && !BLOCKED_NAMES.has(name)
}

// @param {String} name
// @return {Boolean}
export function isValidHelperName(name) {
  return typeof name === 'string'
    && HELPER_NAME_PATTERN.test(name)
    && !BLOCKED_NAMES.has(name)
}

// @param {String} name
// @param {String} namespace
// @return {Boolean}
export function isNamespacedPartial(name, namespace) {
  return name.startsWith(`${namespace}.`)
}

// @param {String} name
// @param {String} namespace
// @return {Boolean}
export function isNamespacedHelper(name, namespace) {
  if (!name.startsWith(namespace))
    return false

  const next = name.charAt(namespace.length)

  return next >= 'A' && next <= 'Z'
}

// @param {*} value
// @return {Boolean}
export function isValidPartial(value) {
  return typeof value === 'string'
}

// @param {*} value
// @return {Boolean}
export function isValidHelper(value) {
  return typeof value === 'function'
}

// @param {*} plugin - The raw object/value returned by a plugin factory
// @return {Boolean}
export function isValidPluginShape(plugin) {
  return plugin !== null
    && typeof plugin === 'object'
    && !Array.isArray(plugin)
}
