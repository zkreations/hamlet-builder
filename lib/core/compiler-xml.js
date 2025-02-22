import fs from 'node:fs'
import path from 'node:path'
import { globSync } from 'glob'
import Handlebars from 'handlebars'
import { markups } from '../data/markups.js'

import { writeOutput, getConfig } from '../utils.js'
import { processTemplate } from './blogger.js'
import { superPartials } from '../data/superPartials.js'
import { getPartials } from './getPartials.js'
import { hbsHelpers } from './hbsHelpers.js'

// Register Super Partials
Handlebars.registerHelper(hbsHelpers)
Handlebars.registerPartial(superPartials)

// Compile all xml and hbs files
// @param {string} input - The input directory
// @param {string} output - The output directory
// @param {object} options - The options object
export const compileXML = async (config) => {
  // Search for all xml and hbs files in the input directory, excluding files starting with an underscore
  const files = globSync(`${config.input}/**/!(_)*.{xml,hbs}`)

  if (files.length === 0) {
    return
  }

  // Register all files starting with an underscore as partials
  const partials = getPartials(config.input)

  Handlebars.registerPartial(partials)
  Handlebars.registerHelper(config.handlebars.helpers)

  const themeData = (await getConfig('theme')) ?? {}

  const dataContent = {
    ...markups,
    ...themeData,
    development: config.mode === 'development'
  }

  // Iterate over the files found and compile each one separately
  for (const file of files) {
    const extension = path.extname(file)
    const fileName = path.basename(file, extension)

    const source = fs.readFileSync(file, 'utf8')
    const templateData = { ...dataContent }

    const template = Handlebars.compile(source)
    const code = processTemplate(template(templateData))

    writeOutput({
      output: config.output,
      file: `${fileName}.xml`,
      content: code
    })
  }
}
