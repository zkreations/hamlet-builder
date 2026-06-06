import chalk from 'chalk'
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
    const fullFileName = path.basename(file)
    const fileName = path.basename(file, extension).replace('.bundle', '')

    try {
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
    } catch (error) {
      console.error(`${chalk.red('[JS Error]')} Error compiling JS "${file}":`, error)
      console.warn(`JS not compiled for "${fullFileName}". Continuing...\n`)
    }
  }
}
