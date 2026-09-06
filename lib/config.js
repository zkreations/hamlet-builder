import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { lilconfig } from 'lilconfig'

const require = createRequire(import.meta.url)

export const SUPPORTED_CONFIGS = ['hamlet', 'theme', 'postcss', 'rollup']

export const CONFIG_FILES = [
  'package.json',
  ...SUPPORTED_CONFIGS.flatMap(name => [
    `${name}.config.js`,
    `${name}.config.mjs`,
    `${name}.config.cjs`,
    `.${name}rc`,
    `.${name}rc.json`,
    `.${name}rc.js`,
    `.${name}rc.cjs`,
    `.${name}rc.mjs`,
    `.config/${name}rc`,
    `.config/${name}rc.json`,
    `.config/${name}rc.js`,
    `.config/${name}rc.cjs`,
    `.config/${name}rc.mjs`,
  ]),
]

const CONFIG_SET = new Set(CONFIG_FILES)

export function isConfigFile(filePath, root = process.cwd()) {
  const rel = path.relative(root, path.resolve(root, filePath)).split(path.sep).join('/')
  return CONFIG_SET.has(rel)
}

function createDynamicLoader(fresh = false) {
  return async (filepath) => {
    const absPath = path.resolve(filepath)
    if (fresh) {
      delete require.cache[absPath]
    }
    const fileUrl = pathToFileURL(absPath).href + (fresh ? `?t=${Date.now()}` : '')
    try {
      const mod = await import(fileUrl)
      return mod.default ?? mod
    }
    catch (error) {
      try {
        if (fresh) {
          delete require.cache[absPath]
        }
        const mod = require(absPath)
        return mod.default ?? mod
      }
      catch {
        throw error
      }
    }
  }
}

export async function getConfig(fileName, options = {}) {
  const fresh = options.fresh ?? false
  const searchFrom = options.searchFrom || process.cwd()

  const dynamicLoader = createDynamicLoader(fresh)
  const explorer = lilconfig(fileName, {
    cache: !fresh,
    loaders: {
      '.js': dynamicLoader,
      '.mjs': dynamicLoader,
      '.cjs': dynamicLoader,
    },
    ...options.lilconfig,
  })
  const result = await explorer.search(searchFrom)

  return result && result.config
    ? result.config
    : null
}

export async function loadConfigurations(context, options = {}) {
  const fresh = options.fresh ?? false
  const searchFrom = options.searchFrom || context?.paths?.root || process.cwd()

  const [
    postcssConfig,
    rollupConfig,
    hamletConfig,
    themeConfig,
  ] = await Promise.all([
    getConfig('postcss', { searchFrom, fresh }),
    getConfig('rollup', { searchFrom, fresh }),
    getConfig('hamlet', { searchFrom, fresh }),
    getConfig('theme', { searchFrom, fresh }),
  ])

  const resolve = async (config, fallback) => {
    let resolved = config
    if (typeof config === 'function')
      resolved = await config(context)

    if (resolved && typeof resolved === 'object' && !Array.isArray(resolved)) {
      return { ...fallback, ...resolved }
    }

    return resolved ?? fallback
  }

  const [postcss, rollup, hamlet, theme] = await Promise.all([
    resolve(postcssConfig, {
      plugins: [],
    }),
    resolve(rollupConfig, {
      plugins: [],
    }),
    resolve(hamletConfig, {
      recompileOnAnyChange: false,
      helpers: {},
      plugins: [],
    }),
    resolve(themeConfig, {}),
  ])

  return {
    postcss,
    rollup,
    hamlet,
    theme,
  }
}
