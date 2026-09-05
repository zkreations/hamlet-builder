import path from 'node:path'
import chalk from 'chalk'
import { globSync } from 'glob'
import { rollup } from 'rollup'
import { minify } from 'terser'
import { writeOutput } from '../utils/index.js'

/**
 * Compile a single JavaScript bundle.
 *
 * @param {string} file - Entry bundle file path
 * @param {object} options - Build options
 * @param {string} outputFolder - Target folder
 */
async function compileBundleFile(file, options, outputFolder) {
  const extension = path.extname(file)
  const fullFileName = path.basename(file)
  const rawFileName = path.basename(file, extension).replace('.bundle', '')
  const iifeName = rawFileName.replace(/[^\w$]/g, '_')

  try {
    const plugins = options.rollup?.plugins ?? []

    const bundle = await rollup({ input: file, plugins })

    const { output: [{ code }] } = await bundle.generate({
      format: 'iife',
      name: iifeName,
    })

    await bundle.close()

    writeOutput({
      output: outputFolder,
      file: `${rawFileName}.js`,
      content: code,
    })

    if (!options.minify || !options.minifyJs)
      return

    const minified = (await minify(code)).code

    writeOutput({
      output: outputFolder,
      file: `${rawFileName}.min.js`,
      content: minified,
    })
  }
  catch (error) {
    console.error(`${chalk.red('[JS Error]')} Error compiling JS "${file}":`, error)
    if (!options.watch) {
      throw error
    }
    console.warn(`JS not compiled for "${fullFileName}". Continuing...\n`)
  }
}

/**
 * Compile all bundle files matching *.bundle.@(js|mjs|cjs).
 *
 * @param {object} options - Build options
 */
export async function compileJS(options) {
  const files = globSync(`${options.input}/**/*.bundle.@(js|mjs|cjs)`)

  if (files.length === 0)
    return

  const outputFolder = path.join(options.output, 'js')

  await Promise.all(
    files.map(file => compileBundleFile(file, options, outputFolder)),
  )
}
