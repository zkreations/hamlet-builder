import path from 'node:path'
import process from 'node:process'
import chalk from 'chalk'
import Handlebars from 'handlebars'
import { capitalize, getAsset } from '../utils/index.js'

const ALLOWED_EXTENSIONS = new Set([
  '.css',
  '.js',
  '.html',
  '.xml',
  '.svg',
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
])

const ALLOWED_BASE = process.cwd()

const activeAssets = new Set()

/**
 * Resolve the asset path replicating getAsset logic.
 *
 * @param {string} assetFolder - The asset path or specifier
 * @returns {string} The resolved absolute path
 */
function resolveAssetPath(assetFolder) {
  const normalized = assetFolder.startsWith('~')
    ? assetFolder.replace(/^~/, 'node_modules/')
    : assetFolder.replace(/^\//, '')

  return path.resolve(ALLOWED_BASE, normalized)
}

/**
 * Check if the resolved path is within the project directory (path traversal safe).
 *
 * @param {string} resolvedPath - The absolute path to test
 * @param {string} [base] - Base directory
 * @returns {boolean} True if allowed
 */
function isPathAllowed(resolvedPath, base = ALLOWED_BASE) {
  return resolvedPath === base || resolvedPath.startsWith(base + path.sep)
}

/**
 * Check if the file extension is in the whitelist.
 *
 * @param {string} resolvedPath - The resolved path
 * @returns {boolean} True if extension is permitted
 */
function isAllowedExtension(resolvedPath) {
  const ext = path.extname(resolvedPath).toLowerCase()
  return ALLOWED_EXTENSIONS.has(ext)
}

/**
 * Get asset content with security checks.
 *
 * @param {string} assetFolder - The asset reference
 * @returns {Handlebars.SafeString} Safe string asset output
 */
function asset(assetFolder) {
  const resolvedPath = resolveAssetPath(assetFolder)

  if (!isPathAllowed(resolvedPath)) {
    console.warn(`${chalk.yellow('[Warning]')} Access denied outside project: "${assetFolder}"\n`)
    return new Handlebars.SafeString(`/* Access denied: ${assetFolder} */`)
  }

  if (!isAllowedExtension(resolvedPath)) {
    const ext = path.extname(resolvedPath) || '(no extension)'
    console.warn(`${chalk.yellow('[Warning]')} File type not allowed: "${ext}" in "${assetFolder}"\n`)
    return new Handlebars.SafeString(`/* File type not allowed: ${assetFolder} */`)
  }

  if (activeAssets.has(resolvedPath)) {
    console.warn(`${chalk.yellow('[Warning]')} Circular reference detected: "${assetFolder}"\n`)
    return new Handlebars.SafeString(`/* Circular reference: ${assetFolder} */`)
  }

  activeAssets.add(resolvedPath)

  try {
    const content = getAsset(resolvedPath)

    if (content.error) {
      console.warn(`${chalk.yellow('[Warning]')} ${content.error}: "${assetFolder}"\n`)
      return new Handlebars.SafeString(`/* ${content.error} */`)
    }

    return new Handlebars.SafeString(content.content)
  }
  finally {
    activeAssets.delete(resolvedPath)
  }
}

/**
 * Get the current year.
 *
 * @returns {number} The current four-digit year
 */
function currentYear() {
  return new Date().getFullYear()
}

/**
 * Helper to show a warning when a helper is missing.
 *
 * @param {...any} args - Helper arguments
 * @returns {string} Empty string
 */
function helperMissing(...args) {
  const options = args.pop()
  console.warn(`${chalk.yellow('[Warning]')} The helper {{${options.name}}} does not exist\n`)
  return ''
}

/**
 * Helper to show a warning when a block helper is missing.
 *
 * @param {...any} args - Helper arguments
 * @returns {string} Empty string
 */
function blockHelperMissing(...args) {
  const options = args.pop()
  console.warn(`${chalk.yellow('[Warning]')} The block helper {{#${options.name}}} does not exist\n`)
  return ''
}

/**
 * Custom switch helper.
 *
 * @param {*} value - The value to test
 * @param {object} options - Handlebars options
 * @returns {string} Rendered block
 */
function switchHelper(value, options) {
  if (options.data) {
    options.data._switch = value
    options.data._match = false
  }
  else {
    try {
      this._switch = value
      this._match = false
    }
    catch {}
  }
  return options.fn(this)
}

/**
 * Custom case helper.
 *
 * @param {*} value - The value to match against switch
 * @param {object} options - Handlebars options
 * @returns {string | undefined} Rendered block if matched
 */
function caseHelper(value, options) {
  const switchVal = options.data?._switch ?? this?._switch
  if (value === switchVal) {
    if (options.data)
      options.data._match = true
    else if (this)
      this._match = true

    return options.fn(this)
  }
}

/**
 * Custom default helper.
 *
 * @param {object} options - Handlebars options
 * @returns {string | undefined} Rendered block if no case matched
 */
function defaultHelper(options) {
  const matched = options.data?._match ?? this?._match
  if (!matched)
    return options.fn(this)
}

function eq(a, b) {
  return a === b
}

function ne(a, b) {
  return a !== b
}

function lt(a, b) {
  return a < b
}

function gt(a, b) {
  return a > b
}

function and(a, b) {
  return Boolean(a && b)
}

function or(a, b) {
  return Boolean(a || b)
}

function not(a) {
  return !a
}

function concat(...args) {
  return args.slice(0, -1).join('')
}

function includes(str, sub) {
  return str?.includes(sub) ?? false
}

function first(arr) {
  return arr?.[0]
}

function last(arr) {
  return arr?.[arr.length - 1]
}

export default {
  and,
  asset,
  blockHelperMissing,
  capitalize,
  case: caseHelper,
  concat,
  currentYear,
  default: defaultHelper,
  eq,
  first,
  gt,
  helperMissing,
  includes,
  last,
  lt,
  ne,
  not,
  or,
  switch: switchHelper,
}
