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
import { superPartials } from '../data/superPartials.js'

const hbsConfig = await getConfig('handlebars')
const userHelpers = hbsConfig?.helpers ?? {}

// Register all helpers
Handlebars.registerHelper({
  asset: (assetFolder) => new Handlebars.SafeString(getAsset(assetFolder)),
  currentYear: () => new Date().getFullYear(),
  helperMissing: missingHelper,
  blockHelperMissing: missingHelper,
  ...userHelpers
})

// Register Super Partials
Handlebars.registerPartial(superPartials)

// Register all partials
// @param {string} input - The input directory
const registerPartials = (input) => {
  // Search for all xml and hbs files that start with an underscore
  const files = globSync(`${input}/**/_*.{xml,hbs}`)

  if (files.length === 0) {
    return
  }

  const partials = {}
  const folders = {}

  files.forEach(file => {
    const extension = path.extname(file)
    const partialName = path.basename(file, extension).replace(/^_/, '')
    const folderName = path.dirname(file).split(path.sep).pop()

    // If the partial has already been registered, show a warning
    if (partials[partialName]) {
      console.warn(`Partial: {{> ${partialName}}} is duplicate:\n${file}`)
      return
    }

    const partialTemplate = (fs.readFileSync(file, 'utf8').trim()) + '\n'
    partials[partialName] = partialTemplate

    if (!folders[folderName]) {
      folders[folderName] = []
    }

    folders[folderName].push(`{{> ${partialName}}}`)
  })

  Object.entries(folders).forEach(([folder, partialList]) => {
    partialList.sort()

    if (partialList.length <= 1) {
      return
    }

    const folderPartialName = `folder.${folder}`

    // Check if the folder partial is already registered
    if (partials[folderPartialName]) {
      console.warn(`Folder partial: {{> ${folderPartialName}}} is duplicate.`)
      return
    }

    partials[folderPartialName] = partialList.join('\n') + '\n'
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
