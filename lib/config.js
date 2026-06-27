import { babel } from '@rollup/plugin-babel'
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import autoprefixer from 'autoprefixer'
import { getConfig } from './utils.js'

async function loadConfigurations() {
  const [postcssConfig, handlebarsConfig, rollupConfig, hamletConfig] = await Promise.all([
    getConfig('postcss'),
    getConfig('handlebars'),
    getConfig('rollup'),
    getConfig('hamlet'),
  ])

  return {
    postcss: {
      plugins: postcssConfig?.plugins ?? [
        autoprefixer(),
      ],
    },
    handlebars: {
      helpers: handlebarsConfig?.helpers ?? {},
      partials: handlebarsConfig?.partials ?? {},
    },
    rollup: {
      plugins: rollupConfig?.plugins ?? [
        nodeResolve(),
        commonjs(),
        babel({ babelHelpers: 'bundled' }),
      ],
    },
    hamlet: {
      recompileStyleOnAnyChange: hamletConfig?.recompileStyleOnAnyChange ?? false,
      plugins: hamletConfig?.plugins ?? [],
    },
  }
}

export const config = loadConfigurations()
