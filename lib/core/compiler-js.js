import path from 'node:path'
import chalk from 'chalk'
import { globSync } from 'glob'
import { rollup } from 'rollup'
import { minify } from 'terser'

import { writeOutput } from '../utils.js'

async function compileBundleFile(file, options, outputFolder) {
  const extension = path.extname(file)
  const fullFileName = path.basename(file)
  const fileName = path.basename(file, extension).replace('.bundle', '')

  try {
    const plugins = options.rollup.plugins ?? []

    const bundle = await rollup({ input: file, plugins })

    const { output: [{ code }] } = await bundle.generate({
      format: 'iife',
      name: fileName,
    })

    await bundle.close()

    writeOutput({
      output: outputFolder,
      file: `${fileName}.js`,
      content: code,
    })

    if (!options.minify || !options.minifyJs)
      return

    const minified = (await minify(code)).code

    writeOutput({
      output: outputFolder,
      file: `${fileName}.min.js`,
      content: minified,
    })
  }
  catch (error) {
    console.error(`${chalk.red('[JS Error]')} Error compiling JS "${file}":`, error)
    console.warn(`JS not compiled for "${fullFileName}". Continuing...\n`)
  }
}

// Compile all js files
// @param {object} options - The options object
export async function compileJS(options) {
  const files = globSync(`${options.input}/**/*.bundle.@(js|mjs|cjs)`)

  if (files.length === 0)
    return

  const outputFolder = path.join(options.output, 'js')

  await Promise.all(
    files.map(file => compileBundleFile(file, options, outputFolder)),
  )
}
