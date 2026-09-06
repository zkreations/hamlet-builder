import path from 'node:path'
import process from 'node:process'
import { styleText } from 'node:util'
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

function isAllowedExtension(resolvedPath) {
  const ext = path.extname(resolvedPath).toLowerCase()
  return ALLOWED_EXTENSIONS.has(ext)
}

function currentYear() {
  return new Date().getFullYear()
}

function helperMissing(...args) {
  const options = args.pop()
  console.warn(`${styleText('yellow', '[Warning]')} The helper {{${options.name}}} does not exist\n`)
  return ''
}

function blockHelperMissing(...args) {
  const options = args.pop()
  console.warn(`${styleText('yellow', '[Warning]')} The block helper {{#${options.name}}} does not exist\n`)
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
 * @param {string} [options.outputPath] - Output directory for assetCss/assetJs resolution
 * @param {boolean} [options.isDevelopment] - Development mode flag
 * @returns {Record<string, Function>} Configured helpers dictionary
 */
export function createHelpers({
  basePath = process.cwd(),
  outputPath,
  isDevelopment = false,
} = {}) {
  const allowedBase = path.resolve(basePath)
  const resolvedOutput = outputPath ? path.resolve(allowedBase, outputPath) : null
  const activeAssets = new Set()

  function resolveAssetPath(assetFolder) {
    const normalized = assetFolder.startsWith('~')
      ? assetFolder.replace(/^~/, 'node_modules/')
      : assetFolder.replace(/^\//, '')

    return path.resolve(allowedBase, normalized)
  }

  function isPathAllowed(resolvedPath) {
    const inBase = resolvedPath === allowedBase || resolvedPath.startsWith(allowedBase + path.sep)
    const inOutput = resolvedOutput && (resolvedPath === resolvedOutput || resolvedPath.startsWith(resolvedOutput + path.sep))
    return inBase || inOutput
  }

  function loadAssetContent(resolvedPath, assetLabel) {
    if (!isPathAllowed(resolvedPath)) {
      console.warn(`${styleText('yellow', '[Warning]')} Access denied outside project: "${assetLabel}"\n`)
      return new Handlebars.SafeString(`/* Access denied: ${assetLabel} */`)
    }

    if (!isAllowedExtension(resolvedPath)) {
      const ext = path.extname(resolvedPath) || '(no extension)'
      console.warn(`${styleText('yellow', '[Warning]')} File type not allowed: "${ext}" in "${assetLabel}"\n`)
      return new Handlebars.SafeString(`/* File type not allowed: ${assetLabel} */`)
    }

    if (activeAssets.has(resolvedPath)) {
      console.warn(`${styleText('yellow', '[Warning]')} Circular reference detected: "${assetLabel}"\n`)
      return new Handlebars.SafeString(`/* Circular reference: ${assetLabel} */`)
    }

    activeAssets.add(resolvedPath)

    try {
      const content = getAsset(resolvedPath)

      if (content.error) {
        console.warn(`${styleText('yellow', '[Warning]')} ${content.error}: "${assetLabel}"\n`)
        return new Handlebars.SafeString(`/* ${content.error} */`)
      }

      return new Handlebars.SafeString(content.content)
    }
    finally {
      activeAssets.delete(resolvedPath)
    }
  }

  function asset(assetFolder) {
    const resolvedPath = resolveAssetPath(assetFolder)
    return loadAssetContent(resolvedPath, assetFolder)
  }

  function assetCss(name) {
    if (!resolvedOutput) {
      console.warn(`${styleText('yellow', '[Warning]')} Output path not configured for assetCss("${name}")\n`)
      return new Handlebars.SafeString(`/* Output path not configured: ${name} */`)
    }

    const cleanName = String(name || '').replace(/\.css$/i, '')
    const fileName = isDevelopment ? `${cleanName}.css` : `${cleanName}.min.css`
    const resolvedPath = path.join(resolvedOutput, 'css', fileName)

    return loadAssetContent(resolvedPath, `${name} (css)`)
  }

  function assetJs(name) {
    if (!resolvedOutput) {
      console.warn(`${styleText('yellow', '[Warning]')} Output path not configured for assetJs("${name}")\n`)
      return new Handlebars.SafeString(`/* Output path not configured: ${name} */`)
    }

    const cleanName = String(name || '').replace(/\.js$/i, '')
    const fileName = isDevelopment ? `${cleanName}.js` : `${cleanName}.min.js`
    const resolvedPath = path.join(resolvedOutput, 'js', fileName)

    return loadAssetContent(resolvedPath, `${name} (js)`)
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
    assetCss,
    assetJs,
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
