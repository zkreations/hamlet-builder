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

/**
 * Factory creating Handlebars helpers with scoped base path and assets state.
 *
 * @param {object} [options]
 * @param {string} [options.basePath] - Base project directory for asset resolution
 * @returns {Record<string, Function>} Configured helpers dictionary
 */
export function createHelpers({ basePath = process.cwd() } = {}) {
  const allowedBase = path.resolve(basePath)
  const activeAssets = new Set()

  function resolveAssetPath(assetFolder) {
    const normalized = assetFolder.startsWith('~')
      ? assetFolder.replace(/^~/, 'node_modules/')
      : assetFolder.replace(/^\//, '')

    return path.resolve(allowedBase, normalized)
  }

  function isPathAllowed(resolvedPath) {
    return resolvedPath === allowedBase || resolvedPath.startsWith(allowedBase + path.sep)
  }

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

  function switchHelper(value, options) {
    const data = options.data ? Handlebars.createFrame(options.data) : {}
    const stack = data._switchStack ? [...data._switchStack] : []
    stack.push({ value, match: false })
    data._switchStack = stack
    data._switch = value
    data._match = false

    return options.fn(this, { data })
  }

  function caseHelper(value, options) {
    const stack = options.data?._switchStack
    if (stack && stack.length > 0) {
      const current = stack[stack.length - 1]
      if (!current.match && value === current.value) {
        current.match = true
        if (options.data)
          options.data._match = true
        return options.fn(this)
      }
      return
    }

    const switchVal = options.data?._switch ?? this?._switch
    if (value === switchVal) {
      if (options.data)
        options.data._match = true
      else if (this)
        this._match = true

      return options.fn(this)
    }
  }

  function defaultHelper(options) {
    const stack = options.data?._switchStack
    if (stack && stack.length > 0) {
      const current = stack[stack.length - 1]
      if (!current.match) {
        return options.fn(this)
      }
      return
    }

    const matched = options.data?._match ?? this?._match
    if (!matched)
      return options.fn(this)
  }

  return {
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
}

export default createHelpers()
