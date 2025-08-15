import path from 'node:path'
import { globSync } from 'glob'
import { rollup } from 'rollup'
import { minify } from 'terser'

import { writeOutput } from '../utils.js'

// Compile all js files
// @param {string} input - The input directory
// @param {string} output - The output directory
// @param {object} options - The options object
export const compileJS = async (options) => {
  // Search only end with .bundle.js
  const files = globSync(`${options.input}/**/*.bundle.@(js|mjs|cjs)`)

  if (files.length === 0) {
    return
  }

  const outputFolder = path.join(options.output, 'js')

  // Iterate over the files found and compile each one separately
  for (const file of files) {
    const extension = path.extname(file)
    const fileName = path.basename(file, extension).replace('.bundle', '')

    const plugins = options.rollup.plugins ?? []

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

    if (!options.minify || !options.minifyJs) {
      continue
    }

    const minified = (await minify(code)).code

    writeOutput({
      output: outputFolder,
      file: `${fileName}.min.js`,
      content: minified
    })
  }
}
