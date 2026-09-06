import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { globSync } from 'glob'
import { transform } from 'lightningcss'
import postcss from 'postcss'
import * as sass from 'sass'
import { logger, measureTime, writeOutput } from '../utils/index.js'

const GLOB_IGNORED = ['**/node_modules/**', '**/.git/**']

function getCSSLocation(file, error) {
  const rel = path.relative(process.cwd(), file)
  // Sass errors expose span with start position
  if (error.span?.start) {
    const { line, column } = error.span.start
    return `${rel}:${line}:${column}`
  }
  // PostCSS errors expose line/column directly
  if (error.line != null) {
    return `${rel}:${error.line}:${error.column ?? 0}`
  }
  return rel
}

/**
 * Compile a single CSS/SCSS/SASS file.
 *
 * @param {string} file - Source file path
 * @param {object} options - Build options
 * @param {string} outputFolder - Target folder
 */
async function compileFile(file, options, outputFolder) {
  const extension = path.extname(file)
  const fileName = path.basename(file, extension)

  try {
    const fileContent = await fs.readFile(file, 'utf8')
    let code = fileContent

    if (['.scss', '.sass'].includes(extension)) {
      const compiled = await sass.compileStringAsync(fileContent, {
        url: pathToFileURL(path.resolve(file)),
      })
      code = compiled.css.toString()
    }

    const plugins = options.postcss?.plugins ?? []
    const compiled = await postcss(plugins).process(code, { from: file })
    code = compiled.css

    for (const msg of compiled.messages) {
      if (msg.type === 'warning') {
        const loc = msg.source?.start
          ? `${path.relative(process.cwd(), file)}:${msg.source.start.line}:${msg.source.start.column}`
          : path.relative(process.cwd(), file)
        logger.warn(msg.text, loc)
      }
    }

    await writeOutput({
      output: outputFolder,
      file: `${fileName}.css`,
      content: code,
    })

    if (!options.minify || !options.minifyCss)
      return

    const { code: minified } = transform({
      code: Buffer.from(code),
      minify: true,
      drafts: { customMedia: true },
    })

    await writeOutput({
      output: outputFolder,
      file: `${fileName}.min.css`,
      content: minified,
    })
  }
  catch (error) {
    logger.error(`Error compiling ${path.basename(file)}: ${error.message || error}`, getCSSLocation(file, error))
    if (!options.watch) {
      const err = new Error(error.message || String(error))
      err._logged = true
      throw err
    }
  }
}

export async function compileStyle(options) {
  const files = globSync(`${options.input}/**/!(_)*.@(scss|sass|css)`, {
    ignore: GLOB_IGNORED,
  })

  if (files.length === 0)
    return

  const prevErrors = logger.getErrorCount()
  const start = performance.now()
  const outputFolder = path.join(options.output, 'css')

  await Promise.all(
    files.map(file => compileFile(file, options, outputFolder)),
  )

  if (logger.getErrorCount() === prevErrors) {
    const count = files.length
    logger.css(`Compiled ${count} ${count === 1 ? 'style' : 'styles'} in ${measureTime(performance.now(), start)}`)
  }
}
