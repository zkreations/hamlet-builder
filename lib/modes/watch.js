import path from 'node:path'
import process from 'node:process'
import chokidar from 'chokidar'
import { compileStyle } from '../compilers/css.js'
import { compileJS } from '../compilers/js.js'
import { compileXML } from '../compilers/xml.js'
import { logger, measureTime } from '../utils/index.js'

const SCRIPT_EXTENSIONS = new Set(['js', 'mjs', 'cjs'])
const STYLE_EXTENSIONS = new Set(['scss', 'sass', 'css'])
const TEMPLATE_EXTENSIONS = new Set(['xml', 'hbs', 'handlebars'])

export function watchMode(options) {
  const relSrc = path.relative(options.cwd || process.cwd(), options.input)
  logger.watch(`watching for file changes in ${relSrc}/`)

  let isCompiling = false
  let pendingRerun = false
  let debounceTimeout = null
  const pendingChanges = new Set()
  const DEBOUNCE_DELAY = 150

  const processPendingCompilations = async () => {
    if (isCompiling) {
      pendingRerun = true
      return
    }

    isCompiling = true
    const start = performance.now()

    const changesToProcess = Array.from(pendingChanges)
    pendingChanges.clear()

    if (changesToProcess.length === 0) {
      isCompiling = false
      return
    }

    let requiresScript = false
    let requiresStyle = false
    let requiresTemplate = false
    const fileNames = changesToProcess.map(p => path.basename(p))

    changesToProcess.forEach((filePath) => {
      const extension = path.extname(filePath).slice(1).toLowerCase()

      if (SCRIPT_EXTENSIONS.has(extension))
        requiresScript = true
      if (STYLE_EXTENSIONS.has(extension))
        requiresStyle = true
      if (TEMPLATE_EXTENSIONS.has(extension))
        requiresTemplate = true
    })

    const { recompileOnAnyChange } = options.hamlet ?? {}

    if (!requiresScript && !requiresStyle && !requiresTemplate && !recompileOnAnyChange) {
      isCompiling = false
      return
    }

    const triggerDesc = fileNames.length === 1
      ? `${fileNames[0]} modified`
      : `${fileNames.length} files modified (${fileNames.slice(0, 3).join(', ')}${fileNames.length > 3 ? ` and ${fileNames.length - 3} more` : ''})`

    logger.watch(triggerDesc)

    try {
      logger.resetErrors()
      const assetTasks = []

      if (requiresScript) {
        assetTasks.push(compileJS(options))
      }

      if (requiresStyle || recompileOnAnyChange) {
        assetTasks.push(compileStyle(options))
      }

      if (assetTasks.length > 0) {
        await Promise.all(assetTasks)
      }

      // Recompile XML when templates changed, or when CSS/JS changed
      // (because {{asset}}/{{assetCss}}/{{assetJs}} embed compiled assets into XML)
      if (requiresTemplate || requiresScript || requiresStyle || recompileOnAnyChange) {
        await compileXML(options)
      }

      if (logger.getErrorCount() > 0) {
        logger.watch('Failed to rebuild. Watching for fixes...')
      }
      else {
        logger.watch(`Rebuilt in ${measureTime(performance.now(), start)}`)
      }
    }
    catch (error) {
      if (!error._logged) {
        logger.error(error.message || String(error))
      }
      logger.watch('Failed to rebuild. Watching for fixes...')
    }
    finally {
      isCompiling = false

      if (pendingRerun) {
        pendingRerun = false
        debounceTimeout = setTimeout(processPendingCompilations, DEBOUNCE_DELAY)
      }
    }
  }

  const watcher = chokidar.watch(options.input, {
    ignored: [
      /(^|[/\\])\../,
      /node_modules/,
      options.output,
    ],
    ignoreInitial: true,
  })

  watcher.on('all', (event, filePath) => {
    if (event === 'addDir' || event === 'unlinkDir')
      return

    pendingChanges.add(filePath)
    clearTimeout(debounceTimeout)
    debounceTimeout = setTimeout(processPendingCompilations, DEBOUNCE_DELAY)
  })

  return watcher
}
