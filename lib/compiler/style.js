import fs from 'node:fs'
import path from 'node:path'
import CleanCSS from 'clean-css'
import * as sass from 'sass'
import postcss from 'postcss'
import { glob } from 'glob'
import autoprefixer from 'autoprefixer'

import { writeOutput, getConfig } from '../utils.js'

const config = await getConfig('postcss')
const plugins = config?.plugins ?? [
  autoprefixer()
]

// Compile all css, scss and sass files
// @param {string} input - The input directory
// @param {string} output - The output directory
// @param {object} options - The options object
export const compileStyle = async (input, output, options) => {
  // Search for all css, scss and sass files in the input directory
  const files = glob.sync(`${input}/**/!(_)*.{scss,sass,css}`)

  if (files.length === 0) {
    return
  }

  const outputFolder = path.join(output, 'css')

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

    const compiled = await postcss(plugins).process(code, { from: file })
    code = compiled.css

    writeOutput({
      output: outputFolder,
      file: `${fileName}.css`,
      content: code
    })

    if (!options.minify) {
      return
    }

    const minified = new CleanCSS().minify(code).styles

    writeOutput({
      output: outputFolder,
      file: `${fileName}.min.css`,
      content: minified
    })
  }
}
