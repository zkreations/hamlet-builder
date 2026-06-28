import { babel } from '@rollup/plugin-babel'
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import autoprefixer from 'autoprefixer'
import { getConfig } from './utils.js'

export async function loadConfigurations(context) {
  const [
    postcssConfig,
    handlebarsConfig,
    rollupConfig,
    hamletConfig,
  ] = await Promise.all([
    getConfig('postcss'),
    getConfig('handlebars'),
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
      plugins: [
        autoprefixer(),
      ],
    }),

    handlebars: resolve(handlebarsConfig, {
      helpers: {},
      partials: {},
    }),

    rollup: resolve(rollupConfig, {
      plugins: [
        nodeResolve(),
        commonjs(),
        babel({ babelHelpers: 'bundled' }),
      ],
    }),

    hamlet: resolve(hamletConfig, {
      recompileStyleOnAnyChange: false,
      plugins: [],
    }),
  }
}
