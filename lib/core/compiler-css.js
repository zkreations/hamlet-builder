import fs from 'node:fs'
import path from 'node:path'
import { transform } from 'lightningcss'
import * as sass from 'sass'
import postcss from 'postcss'
import { globSync } from 'glob'

import { writeOutput } from '../utils.js'

// Compile all css, scss and sass files
// @param {string} input - The input directory
// @param {string} output - The output directory
// @param {object} options - The options object
export const compileStyle = async (options) => {
  // Search for all css, scss and sass files in the input directory
  const files = globSync(`${options.input}/**/!(_)*.@(scss|sass|css)`)

  if (files.length === 0) {
    return
  }

  const outputFolder = path.join(options.output, 'css')

  // Iterate over the files found and compile each one separately
  for (const file of files) {
    const extension = path.extname(file)
    const fileName = path.basename(file, extension)
    const fileContent = fs.readFileSync(file, 'utf8')

    let code = fileContent

    // check if the file is a sass/scss file
    if (['.scss', '.sass'].includes(extension)) {
      const compiled = sass.compile(file)
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

    if (!options.minify || !options.minifyCss) {
      return
    }

    const { code: minified } = transform({
      code: Buffer.from(code),
      minify: true
    })

    writeOutput({
      output: outputFolder,
      file: `${fileName}.min.css`,
      content: minified
    })
  }
}
