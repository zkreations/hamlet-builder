import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { globSync } from 'glob'
import Handlebars from 'handlebars'
import { markups } from '../data/markups.js'
import { loadPartials } from '../partials/collector.js'
import { loadPlugins } from '../plugins/loader.js'
import {
  lintBloggerTemplate,
  processTemplate,
} from '../templates/blogger-parser.js'
import { formatHandlebarsDiagnostic } from '../templates/diagnostics.js'
import { createHandlebarsEnvironment } from '../templates/registry.js'
import { logger, measureTime, writeOutput } from '../utils/index.js'

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

  let hbs
  try {
    hbs = createHandlebarsEnvironment({
      partials,
      helpers: userHelpers,
      pluginPartials,
      pluginHelpers,
      basePath: options.cwd || process.cwd(),
      outputPath: options.output,
      isDevelopment,
    })
  }
  catch (error) {
    const diagnostic = formatHandlebarsDiagnostic({
      error,
      rootFile: options.input,
    })
    logger.error(diagnostic.message, diagnostic.fullLocation)
    if (!options.watch) {
      const err = new Error(diagnostic.message)
      err._logged = true
      throw err
    }
    return
  }

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

    let rootAst = null
    try {
      rootAst = Handlebars.parse(source)
    }
    catch (error) {
      const diagnostic = formatHandlebarsDiagnostic({
        error,
        rootFile: relFile,
      })
      logger.error(diagnostic.message, diagnostic.fullLocation)
      if (!options.watch) {
        const err = new Error(diagnostic.message)
        err._logged = true
        throw err
      }
      continue
    }

    try {
      const template = hbs.compile(rootAst || source)

      if (hbs.__renderStack) {
        hbs.__renderStack.length = 0
        hbs.__renderStack.push({
          name: '<root>',
          file: relFile,
          source,
          ast: rootAst,
          callSite: null,
          callCounts: new Map(),
        })
      }

      let rendered
      try {
        rendered = template(templateData)
      }
      finally {
        if (hbs.__renderStack) {
          hbs.__renderStack.length = 0
        }
      }

      const diagnostics = lintBloggerTemplate(rendered)
      for (const diag of diagnostics) {
        logger.warn(
          `[${diag.rule}] ${diag.message}`,
          `${relFile}:${diag.line}:${diag.column}`,
        )
      }

      const code = processTemplate(rendered)

      await writeOutput({
        output: options.output,
        file: `${fileName}.xml`,
        content: code,
      })
    }
    catch (error) {
      const diagnostic = formatHandlebarsDiagnostic({
        error,
        rootFile: relFile,
        rootAst,
      })

      logger.error(diagnostic.message, diagnostic.fullLocation)
      if (!options.watch) {
        const err = new Error(diagnostic.message)
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
