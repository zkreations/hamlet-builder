import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { globSync } from 'glob'
import { markups } from '../data/markups.js'
import { loadPartials } from '../partials/collector.js'
import { loadPlugins } from '../plugins/loader.js'
import { processTemplate } from '../templates/blogger-parser.js'
import { createHandlebarsEnvironment } from '../templates/registry.js'
import { getErrorDetails, logger, measureTime, writeOutput } from '../utils/index.js'

const GLOB_IGNORED = ['**/node_modules/**', '**/.git/**']

export async function compileXML(options) {
  const files = globSync(`${options.input}/**/!(_)*.@(xml|hbs|handlebars)`, {
    ignore: GLOB_IGNORED,
  })

  if (!files.length)
    return

  const prevErrors = logger.getErrorCount()
  const start = performance.now()

  const userHelpers = options.hamlet?.helpers ?? {}
  const partials = await loadPartials(options.input)
  const themeData = options.theme ?? {}

  const hamletConfig = options.hamlet ?? {}

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

  const isDevelopment = options.mode === 'development'

  const hbs = createHandlebarsEnvironment({
    partials,
    helpers: userHelpers,
    pluginPartials,
    pluginHelpers,
    basePath: options.cwd || process.cwd(),
    outputPath: options.output,
    isDevelopment,
  })

  const dataContent = {
    ...markups,
    ...themeData,
    ...pluginContexts,
    development: isDevelopment,
  }

  for (const file of files) {
    const extension = path.extname(file)
    const fileName = path.basename(file, extension)
    const relFile = path.relative(process.cwd(), file)

    const source = await fs.readFile(file, 'utf8')
    const templateData = { ...dataContent }

    try {
      const template = hbs.compile(source)
      const code = processTemplate(template(templateData))

      await writeOutput({
        output: options.output,
        file: `${fileName}.xml`,
        content: code,
      })
    }
    catch (error) {
      const details = getErrorDetails(error)
      const location = details.line
        ? `${relFile}:${details.line}:${details.column ?? 0}`
        : relFile

      logger.error(details.message, location)
      if (!options.watch) {
        const err = new Error(details.message)
        err._logged = true
        throw err
      }
    }
  }

  if (logger.getErrorCount() === prevErrors) {
    const count = files.length
    logger.xml(`Compiled ${count} ${count === 1 ? 'template' : 'templates'} in ${measureTime(performance.now(), start)}`)
  }
}
