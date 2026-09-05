const PARTIAL_NAME_PATTERN = /^[A-Z][A-Z0-9]*(?:[._-][A-Z][A-Z0-9]*)*$/i
const HELPER_NAME_PATTERN = /^[A-Z][A-Z0-9]*(?:[-_][A-Z][A-Z0-9]*)*$/i
const NAMESPACE_PATTERN = /^[A-Z][A-Z0-9]*$/i

const BLOCKED_NAMES = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * Validate plugin namespace.
 *
 * @param {string} name - Plugin namespace
 * @returns {boolean} True if valid
 */
export function isValidNamespace(name) {
  return typeof name === 'string'
    && NAMESPACE_PATTERN.test(name)
    && !BLOCKED_NAMES.has(name)
    && name.toLowerCase() !== 'hamlet'
}

/**
 * Validate partial name.
 *
 * @param {string} name - Partial name
 * @returns {boolean} True if valid
 */
export function isValidPartialName(name) {
  return typeof name === 'string'
    && PARTIAL_NAME_PATTERN.test(name)
    && !BLOCKED_NAMES.has(name)
}

/**
 * Validate helper name.
 *
 * @param {string} name - Helper name
 * @returns {boolean} True if valid
 */
export function isValidHelperName(name) {
  return typeof name === 'string'
    && HELPER_NAME_PATTERN.test(name)
    && !BLOCKED_NAMES.has(name)
}

/**
 * Validate partial template value.
 *
 * @param {*} value - The partial template
 * @returns {boolean} True if string
 */
export function isValidPartial(value) {
  return typeof value === 'string'
}

/**
 * Validate helper function.
 *
 * @param {*} value - The helper function
 * @returns {boolean} True if function
 */
export function isValidHelper(value) {
  return typeof value === 'function'
}

/**
 * Validate plugin shape.
 *
 * @param {*} plugin - The raw plugin value
 * @returns {boolean} True if plain object
 */
export function isValidPluginShape(plugin) {
  return plugin !== null
    && typeof plugin === 'object'
    && !Array.isArray(plugin)
}

/**
 * Validate plugin context.
 *
 * @param {*} value - The context object
 * @returns {boolean} True if plain object
 */
export function isValidContext(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
}
