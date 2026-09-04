import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import { globSync } from 'glob'
import { markups } from '../data/markups.js'
import { loadPartials } from '../partials/collector.js'
import { loadPlugins } from '../plugins/loader.js'
import { processTemplate } from '../templates/blogger-parser.js'
import { createHandlebarsEnvironment } from '../templates/registry.js'
import { getConfig, getErrorDetails, writeOutput } from '../utils/index.js'

/**
 * Compile all XML/HBS/Handlebars template files into Blogger XML.
 *
 * @param {object} options - Build options
 */
export async function compileXML(options) {
  const files = globSync(`${options.input}/**/!(_)*.@(xml|hbs|handlebars)`)

  if (!files.length)
    return

  const userHelpers = options.hamlet?.helpers ?? {}

  const [partials, rawThemeData] = await Promise.all([
    loadPartials(options.input),
    getConfig('theme'),
  ])

  const hamletConfig = options.hamlet ?? {}
  const themeData = rawThemeData ?? {}

  const pluginsConfig = Array.isArray(hamletConfig.plugins)
    ? hamletConfig.plugins
    : []

  const {
    partials: pluginPartials,
    helpers: pluginHelpers,
    contexts: pluginContexts,
  } = await loadPlugins(
    pluginsConfig,
    { partials, helpers: userHelpers },
  )

  const hbs = createHandlebarsEnvironment({
    partials,
    helpers: userHelpers,
    pluginPartials,
    pluginHelpers,
  })

  const dataContent = {
    ...markups,
    ...themeData,
    ...pluginContexts,
    development: options.mode === 'development',
  }

  for (const file of files) {
    const extension = path.extname(file)
    const fullFileName = path.basename(file)
    const fileName = path.basename(file, extension)

    const source = fs.readFileSync(file, 'utf8')
    const templateData = { ...dataContent }

    try {
      const template = hbs.compile(source)
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
