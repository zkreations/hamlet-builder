import path from 'node:path'
import { globSync } from 'glob'
import { rollup } from 'rollup'
import { minify } from 'terser'
import { babel } from '@rollup/plugin-babel'

import { writeOutput, getConfig } from '../utils.js'

const config = await getConfig('rollup')
const plugins = config?.plugins ?? [
  babel({ babelHelpers: 'bundled' })
]

// Compile all js files
// @param {string} input - The input directory
// @param {string} output - The output directory
// @param {object} options - The options object
export const compileJS = async (input, output, options) => {
  // Search only end with .bundle.js
  const files = globSync(`${input}/**/*.bundle.js`)

  if (files.length === 0) {
    return
  }

  const outputFolder = path.join(output, 'js')

  // Iterate over the files found and compile each one separately
  for (const file of files) {
    const extension = path.extname(file)
    const fileName = path.basename(file, extension).replace('.bundle', '')

    const bundle = await rollup({
      input: file,
      plugins
    })

    const { output: [{ code }] } = await bundle.generate({
      format: 'iife',
      name: fileName
    })

    writeOutput({
      output: outputFolder,
      file: `${fileName}.js`,
      content: code
    })

    if (!options.minify) {
      return
    }

    const minified = (await minify(code)).code

    writeOutput({
      output: outputFolder,
      file: `${fileName}.min.js`,
      content: minified
    })
  }
}
