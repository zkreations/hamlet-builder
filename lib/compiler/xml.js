import fs from 'node:fs'
import path from 'node:path'
import { globSync } from 'glob'
import Handlebars from 'handlebars'
import { markups } from '../data/markups.js'

import {
  writeOutput,
  getConfig,
  missingHelper,
  getAsset
} from '../utils.js'

import { processTemplate } from '../blogger.js'
import { superPartials } from '../data/super-partials.js'

const hbsConfig = await getConfig('handlebars')
const userHelpers = hbsConfig?.helpers ?? {}

// Register all helpers
Handlebars.registerHelper({
  asset: (assetFolder) => new Handlebars.SafeString(getAsset(assetFolder)),
  helperMissing: missingHelper,
  blockHelperMissing: missingHelper,
  ...userHelpers
})

// Register Super Partials
Handlebars.registerPartial({
  'super.defaultmarkups': superPartials.defaultmarkups
})

// Register all partials
// @param {string} input - The input directory
const registerPartials = (input) => {
  // Search for all xml and hbs files that start with an underscore
  const files = globSync(`${input}/**/_*.{xml,hbs}`)

  if (files.length === 0) {
    return
  }

  const partials = {}

  files.forEach(file => {
    const extension = path.extname(file)
    const partialName = path.basename(file, extension).replace(/^_/, '')

    // If the partial has already been registered, show a warning
    if (partials[partialName]) {
      console.warn(`Partial: {{> ${partialName}}} is duplicate:\n${file}`)
      return
    }

    const partialTemplate = (fs.readFileSync(file, 'utf8').trim()) + '\n'
    partials[partialName] = partialTemplate
  })

  Handlebars.registerPartial(partials)
}

// Compile all xml and hbs files
// @param {string} input - The input directory
// @param {string} output - The output directory
// @param {object} options - The options object
export const compileXML = async (input, output, options) => {
  // Search for all xml and hbs files in the input directory, excluding files starting with an underscore
  const files = globSync(`${input}/**/!(_)*.{xml,hbs}`)

  if (files.length === 0) {
    return
  }

  // Register all files starting with an underscore as partials
  registerPartials(input)

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

    const template = Handlebars.compile(source)
    const code = processTemplate(template(templateData))

    writeOutput({
      output,
      file: `${fileName}.xml`,
      content: code
    })
  }
}
