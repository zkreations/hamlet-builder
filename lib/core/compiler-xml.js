import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import { globSync } from 'glob'
import Handlebars from 'handlebars'
import { markups } from '../data/markups.js'
import { hamletPartials } from '../data/partials.js'
import { getConfig, getErrorDetails, writeOutput } from '../utils.js'
import { processTemplate } from './Blogger-parser.js'
import { loadPartials } from './load-partials.js'
import { loadPlugins } from './load-plugins.js'

import helpers from './template-helpers.js'

// Register Hamlet Partials
Handlebars.registerHelper(helpers)
Handlebars.registerPartial(hamletPartials)

// Compile all xml and hbs files
// @param {object} options - The options object
export async function compileXML(options) {
  const files = globSync(`${options.input}/**/!(_)*.@(xml|hbs|handlebars)`)

  if (!files.length)
    return

  const { helpers } = options.handlebars

  const [partials, rawThemeData] = await Promise.all([
    loadPartials(options.input),
    getConfig('theme'),
  ])

  const hamletConfig = options.hamlet ?? {}
  const themeData = rawThemeData ?? {}

  const pluginsConfig = Array.isArray(hamletConfig.plugins)
    ? hamletConfig.plugins
    : []

  Handlebars.registerPartial(partials)
  Handlebars.registerHelper(helpers)

  const { partials: pluginPartials, helpers: pluginHelpers } = await loadPlugins(
    pluginsConfig,
    { partials, helpers },
  )

  if (pluginPartials && Object.keys(pluginPartials).length) {
    Handlebars.registerPartial(pluginPartials)
  }

  if (pluginHelpers && Object.keys(pluginHelpers).length) {
    Handlebars.registerHelper(pluginHelpers)
  }

  const dataContent = {
    ...markups,
    ...themeData,
    development: options.mode === 'development',
  }

  for (const file of files) {
    const extension = path.extname(file)
    const fullFileName = path.basename(file)
    const fileName = path.basename(file, extension)

    const source = fs.readFileSync(file, 'utf8')
    const templateData = { ...dataContent }

    try {
      const template = Handlebars.compile(source)
      const code = processTemplate(template(templateData))

      writeOutput({
        output: options.output,
        file: `${fileName}.xml`,
        content: code,
      })
    }
    catch (error) {
      const details = getErrorDetails(error)

      console.error(`${chalk.red('[XML Error]')} ${details.message}`)
      console.warn(`XML not compiled for "${fullFileName}". Continuing...\n`)
    }
  }
}
