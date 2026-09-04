import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import chalk from 'chalk'
import { globSync } from 'glob'
import { transform } from 'lightningcss'
import postcss from 'postcss'
import * as sass from 'sass'
import { writeOutput } from '../utils/index.js'

/**
 * Compile a single CSS/SCSS/SASS file.
 *
 * @param {string} file - Source file path
 * @param {object} options - Build options
 * @param {string} outputFolder - Target folder
 */
async function compileFile(file, options, outputFolder) {
  const extension = path.extname(file)
  const fullFileName = path.basename(file)
  const fileName = path.basename(file, extension)

  try {
    const fileContent = fs.readFileSync(file, 'utf8')
    let code = fileContent

    if (['.scss', '.sass'].includes(extension)) {
      const compiled = sass.compileString(fileContent, {
        url: pathToFileURL(path.resolve(file)),
      })
      code = compiled.css.toString()
    }

    const plugins = options.postcss?.plugins ?? []
    const compiled = await postcss(plugins).process(code, { from: file })
    code = compiled.css

    writeOutput({
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

    writeOutput({
      output: outputFolder,
      file: `${fileName}.min.css`,
      content: minified,
    })
  }
  catch (error) {
    console.error(`${chalk.red('[CSS Error]')} Error compiling CSS "${file}":`, error)
    console.warn(`CSS not compiled for "${fullFileName}". Continuing...\n`)
  }
}

/**
 * Compile all CSS, SCSS, and SASS files in the input directory.
 *
 * @param {object} options - Build options
 */
export async function compileStyle(options) {
  const files = globSync(`${options.input}/**/!(_)*.@(scss|sass|css)`)

  if (files.length === 0)
    return

  const outputFolder = path.join(options.output, 'css')

  await Promise.all(
    files.map(file => compileFile(file, options, outputFolder)),
  )
}
