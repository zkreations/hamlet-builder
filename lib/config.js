import { getConfig } from './utils.js'

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

  const resolve = (config, fallback) => {
    if (typeof config === 'function')
      return config(context)

    return config ?? fallback
  }

  return {
    postcss: resolve(postcssConfig, {
      plugins: [],
    }),

    rollup: resolve(rollupConfig, {
      plugins: [],
    }),

    hamlet: resolve(hamletConfig, {
      recompileStyleOnAnyChange: false,
      helpers: {},
      plugins: [],
    }),
  }
}
