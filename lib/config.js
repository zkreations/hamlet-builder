import { babel } from '@rollup/plugin-babel'
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import autoprefixer from 'autoprefixer'
import { getConfig } from './utils.js'

async function loadConfigurations() {
  const [postcssConfig, handlebarsConfig, rollupConfig] = await Promise.all([
    getConfig('postcss'),
    getConfig('handlebars'),
    getConfig('rollup'),
  ])

  return {
    postcss: {
      plugins: postcssConfig?.plugins ?? [
        autoprefixer(),
      ],
    },
    handlebars: {
      helpers: handlebarsConfig?.helpers ?? {},
    },
    rollup: {
      plugins: rollupConfig?.plugins ?? [
        nodeResolve(),
        commonjs(),
        babel({ babelHelpers: 'bundled' }),
      ],
    },
  }
}

export const config = loadConfigurations()
