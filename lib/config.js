import { lilconfig } from 'lilconfig'

/**
 * Search and load configuration file using lilconfig.
 *
 * @param {string} fileName - Base configuration name (e.g. 'hamlet', 'postcss')
 * @returns {Promise<any>} The loaded config object or null
 */
export async function getConfig(fileName) {
  const explorer = lilconfig(fileName)
  const result = await explorer.search()

  return result && result.config
    ? result.config
    : null
}

/**
 * Load and resolve all user configuration files for the project.
 *
 * @param {object} context - Project context with paths and utils
 * @returns {Promise<{ postcss: object, rollup: object, hamlet: object, theme: object }>} Resolved configurations
 */
export async function loadConfigurations(context) {
  const [
    postcssConfig,
    rollupConfig,
    hamletConfig,
    themeConfig,
  ] = await Promise.all([
    getConfig('postcss'),
    getConfig('rollup'),
    getConfig('hamlet'),
    getConfig('theme'),
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
