import path from 'node:path'
import process from 'node:process'
import { globSync } from 'glob'
import { rollup } from 'rollup'
import { minify } from 'terser'
import { logger, measureTime, writeOutput } from '../utils/index.js'

const GLOB_IGNORED = ['**/node_modules/**', '**/.git/**']
const bundleCache = new Map()

export function clearBundleCache() {
  bundleCache.clear()
}

function getJSLocation(file, error) {
  if (error.loc) {
    const src = error.loc.file ?? file
    return `${path.relative(process.cwd(), src)}:${error.loc.line}:${error.loc.column ?? 0}`
  }
  return path.relative(process.cwd(), file)
}

/**
 * Compile a single JavaScript bundle.
 *
 * @param {string} file - Entry bundle file path
 * @param {object} options - Build options
 * @param {string} outputFolder - Target folder
 */
async function compileBundleFile(file, options, outputFolder) {
  const extension = path.extname(file)
  const rawFileName = path.basename(file, extension).replace('.bundle', '')
  const iifeName = rawFileName.replace(/[^\w$]/g, '_')

  try {
    const plugins = options.rollup?.plugins ?? []
    const cache = bundleCache.get(file)

    const bundle = await rollup({ input: file, plugins, cache })
    bundleCache.set(file, bundle.cache)

    const { output: [{ code }] } = await bundle.generate({
      format: 'iife',
      name: iifeName,
    })

    await bundle.close()

    await writeOutput({
      output: outputFolder,
      file: `${rawFileName}.js`,
      content: code,
    })

    if (!options.minify || !options.minifyJs)
      return

    const minified = (await minify(code)).code

    await writeOutput({
      output: outputFolder,
      file: `${rawFileName}.min.js`,
      content: minified,
    })
  }
  catch (error) {
    logger.error(`Error bundling ${path.basename(file)}: ${error.message || error}`, getJSLocation(file, error))
    if (!options.watch) {
      const err = new Error(error.message || String(error))
      err._logged = true
      throw err
    }
  }
}

export async function compileJS(options) {
  const files = globSync(`${options.input}/**/*.bundle.@(js|mjs|cjs)`, {
    ignore: GLOB_IGNORED,
  })

  if (files.length === 0)
    return

  const prevErrors = logger.getErrorCount()
  const start = performance.now()
  const outputFolder = path.join(options.output, 'js')

  await Promise.all(
    files.map(file => compileBundleFile(file, options, outputFolder)),
  )

  if (logger.getErrorCount() === prevErrors) {
    const count = files.length
    logger.js(`Bundled ${count} ${count === 1 ? 'script' : 'scripts'} in ${measureTime(performance.now(), start)}`)
  }
}
