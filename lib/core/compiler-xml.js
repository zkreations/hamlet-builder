import chalk from 'chalk'
import fs from 'node:fs'
import path from 'node:path'
import { globSync } from 'glob'
import Handlebars from 'handlebars'
import { markups } from '../data/markups.js'

import { writeOutput, getConfig, getErrorDetails } from '../utils.js'
import { processTemplate } from './Blogger-parser.js'
import { superPartials } from '../data/partials.js'
import { loadPartials } from './load-partials.js'
import helpers from './template-helpers.js'

// Register Super Partials
Handlebars.registerHelper(helpers)
Handlebars.registerPartial(superPartials)

// Compile all xml and hbs files
// @param {string} input - The input directory
// @param {string} output - The output directory
// @param {object} options - The options object
export const compileXML = async (options) => {
  // Search for all xml and hbs files in the input directory, excluding files starting with an underscore
  const files = globSync(`${options.input}/**/!(_)*.{xml,hbs}`)

  if (files.length === 0) {
    return
  }

  // Register all files starting with an underscore as partials
  const partials = loadPartials(options.input)

  Handlebars.registerPartial(partials)
  Handlebars.registerHelper(options.handlebars.helpers)

  const themeData = (await getConfig('theme')) ?? {}

  const dataContent = {
    ...markups,
    ...themeData,
    development: options.mode === 'development'
  }

  // Iterate over the files found and compile each one separately
  for (const file of files) {
    const extension = path.extname(file)
    const fileName = path.basename(file, extension)

    const source = fs.readFileSync(file, 'utf8')
    const templateData = { ...dataContent }

    try {
      const template = Handlebars.compile(source)
      const code = processTemplate(template(templateData))

      writeOutput({
        output: options.output,
        file: `${fileName}.xml`,
        content: code
      })
    } catch (error) {
      const details = getErrorDetails(error)

      console.warn(`\n${chalk.red('[Error]')} ${details.message}`)
      console.warn(`${file} (line ${details.line}, column ${details.column})\n`)
    }
  }
}
