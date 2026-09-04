import { getConfig } from './utils/index.js'

/**
 * Load and resolve all user configuration files for the project.
 *
 * @param {object} context - Project context with paths and utils
 * @returns {Promise<{ postcss: object, rollup: object, hamlet: object }>} Resolved configurations
 */
export async function loadConfigurations(context) {
  const [
    postcssConfig,
    rollupConfig,
    hamletConfig,
  ] = await Promise.all([
    getConfig('postcss'),
    getConfig('rollup'),
    getConfig('hamlet'),
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

  const [postcss, rollup, hamlet] = await Promise.all([
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
  ])

  return {
    postcss,
    rollup,
    hamlet,
  }
}

export { getConfig }
