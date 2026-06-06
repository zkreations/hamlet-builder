import chalk from 'chalk'
import fs from 'node:fs'
import path from 'node:path'
import { transform } from 'lightningcss'
import * as sass from 'sass'
import postcss from 'postcss'
import { globSync } from 'glob'

import { writeOutput } from '../utils.js'

// Compile a single CSS/SCSS/SASS file
// @param {string} file - The path to the file to compile
// @param {object} options - The options object
// @param {string} outputFolder - The output folder for the compiled file
const compileFile = async (file, options, outputFolder) => {
  const extension = path.extname(file)
  const fullFileName = path.basename(file)
  const fileName = path.basename(file, extension)

  try {
    const fileContent = fs.readFileSync(file, 'utf8')
    let code = fileContent

    if (['.scss', '.sass'].includes(extension)) {
      const compiled = sass.compileString(fileContent, {
        url: new URL(`file://${path.resolve(file)}`)
      })
      code = compiled.css.toString()
    }

    const plugins = options.postcss.plugins ?? []
    const compiled = await postcss(plugins).process(code, { from: file })
    code = compiled.css

    writeOutput({
      output: outputFolder,
      file: `${fileName}.css`,
      content: code
    })

    if (!options.minify || !options.minifyCss) return

    const { code: minified } = transform({
      code: Buffer.from(code),
      minify: true,
      drafts: { customMedia: true }
    })

    writeOutput({
      output: outputFolder,
      file: `${fileName}.min.css`,
      content: minified
    })
  } catch (error) {
    console.error(`${chalk.red('[CSS Error]')} Error compiling CSS "${file}":`, error)
    console.warn(`CSS not compiled for "${fullFileName}". Continuing...\n`)
  }
}

// Compile all css, scss and sass files
// @param {object} options - The options object
export const compileStyle = async (options) => {
  const files = globSync(`${options.input}/**/!(_)*.@(scss|sass|css)`)

  if (files.length === 0) return

  const outputFolder = path.join(options.output, 'css')

  await Promise.all(
    files.map(file => compileFile(file, options, outputFolder))
  )
}
