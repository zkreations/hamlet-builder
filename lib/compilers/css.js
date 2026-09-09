import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import browserslist from 'browserslist'
import { globSync } from 'glob'
import { browserslistToTargets, transform } from 'lightningcss'
import postcss from 'postcss'
import * as sass from 'sass'
import { logger, measureTime, writeOutput } from '../utils/index.js'

const GLOB_IGNORED = ['**/node_modules/**', '**/.git/**']

function getCSSLocation(file, error) {
  const rel = path.relative(process.cwd(), file)
  if (error.span?.start) {
    const { line, column } = error.span.start
    return `${rel}:${line}:${column}`
  }
  if (error.line != null) {
    return `${rel}:${error.line}:${error.column ?? 0}`
  }
  if (error.loc) {
    return `${rel}:${error.loc.line}:${error.loc.column ?? 0}`
  }
  return rel
}

async function compileFile(file, options, outputFolder, targets) {
  const extension = path.extname(file)
  const fileName = path.basename(file, extension)
  const hasSourceMap = Boolean(options.sourcemap ?? options.hamlet?.sourcemap)

  try {
    const fileContent = await fs.readFile(file, 'utf8')
    let code = fileContent
    let sassMap = null

    if (['.scss', '.sass'].includes(extension)) {
      const compiled = await sass.compileStringAsync(fileContent, {
        url: pathToFileURL(path.resolve(file)),
        sourceMap: hasSourceMap,
        sourceMapIncludeSources: true,
      })
      code = compiled.css.toString()
      sassMap = compiled.sourceMap
    }

    const plugins = options.postcss?.plugins ?? []
    const postcssOptions = {
      from: file,
      to: path.join(outputFolder, `${fileName}.css`),
    }

    if (hasSourceMap && sassMap) {
      postcssOptions.map = { prev: sassMap, inline: false, annotation: false }
    }
    else if (hasSourceMap) {
      postcssOptions.map = { inline: false, annotation: false }
    }

    const compiled = await postcss(plugins).process(code, postcssOptions)
    code = compiled.css
    const postCssMap = hasSourceMap ? compiled.map : null

    for (const msg of compiled.messages) {
      if (msg.type === 'warning') {
        const loc = msg.source?.start
          ? `${path.relative(process.cwd(), file)}:${msg.source.start.line}:${msg.source.start.column}`
          : path.relative(process.cwd(), file)
        logger.warn(msg.text, loc)
      }
    }

    const transformOptions = {
      filename: path.basename(file),
      code: Buffer.from(code),
      targets,
      drafts: { customMedia: true },
      minify: false,
    }

    if (hasSourceMap) {
      transformOptions.sourceMap = true
      if (postCssMap) {
        transformOptions.inputSourceMap = postCssMap.toString()
      }
    }

    const transformed = transform(transformOptions)
    code = transformed.code.toString()
    const cssMap = transformed.map ? transformed.map.toString() : null

    if (hasSourceMap && cssMap) {
      code += `\n/*# sourceMappingURL=${fileName}.css.map */\n`
    }

    await writeOutput({
      output: outputFolder,
      file: `${fileName}.css`,
      content: code,
    })

    if (hasSourceMap && cssMap) {
      await writeOutput({
        output: outputFolder,
        file: `${fileName}.css.map`,
        content: cssMap,
      })
    }

    if (!options.minify || !options.minifyCss)
      return

    const { code: minified } = transform({
      filename: path.basename(file),
      code: transformed.code,
      minify: true,
      targets,
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

  let targets
  try {
    const list = browserslist(options.browserslist ?? undefined, {
      path: options.cwd || process.cwd(),
    })
    targets = browserslistToTargets(list)
  }
  catch {}

  await Promise.all(
    files.map(file => compileFile(file, options, outputFolder, targets)),
  )

  if (logger.getErrorCount() === prevErrors) {
    const count = files.length
    logger.css(`Compiled ${count} ${count === 1 ? 'style' : 'styles'} in ${measureTime(performance.now(), start)}`)
  }
}
