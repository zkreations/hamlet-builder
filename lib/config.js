import { getConfig } from './utils.js'
import { babel } from '@rollup/plugin-babel'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import autoprefixer from 'autoprefixer'

const loadConfigurations = async () => {
  const [postcssConfig, handlebarsConfig, rollupConfig] = await Promise.all([
    getConfig('postcss'),
    getConfig('handlebars'),
    getConfig('rollup')
  ])

  return {
    postcss: {
      plugins: postcssConfig?.plugins ?? [
        autoprefixer()
      ]
    },
    handlebars: {
      helpers: handlebarsConfig?.helpers ?? {}
    },
    rollup: {
      plugins: rollupConfig?.plugins ?? [
        nodeResolve(),
        commonjs(),
        babel({ babelHelpers: 'bundled' })
      ]
    }
  }
}

export const config = await loadConfigurations()
