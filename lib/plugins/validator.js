const PARTIAL_NAME_PATTERN = /^[A-Z][A-Z0-9]*(?:[._-][A-Z][A-Z0-9]*)*$/i
const HELPER_NAME_PATTERN = /^[A-Z][A-Z0-9]*(?:[-_][A-Z][A-Z0-9]*)*$/i
const NAMESPACE_PATTERN = /^[A-Z][A-Z0-9]*$/i

const BLOCKED_NAMES = new Set(['__proto__', 'constructor', 'prototype'])

export function isValidNamespace(name) {
  return typeof name === 'string'
    && NAMESPACE_PATTERN.test(name)
    && !BLOCKED_NAMES.has(name)
    && name.toLowerCase() !== 'hamlet'
}

export function isValidPartialName(name) {
  return typeof name === 'string'
    && PARTIAL_NAME_PATTERN.test(name)
    && !BLOCKED_NAMES.has(name)
}

export function isValidHelperName(name) {
  return typeof name === 'string'
    && HELPER_NAME_PATTERN.test(name)
    && !BLOCKED_NAMES.has(name)
}

export function isValidPartial(value) {
  return typeof value === 'string'
}

export function isValidHelper(value) {
  return typeof value === 'function'
}

export function isValidPluginShape(plugin) {
  return plugin !== null
    && typeof plugin === 'object'
    && !Array.isArray(plugin)
}

export function isValidContext(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
}
