import path from 'node:path'
import { styleText } from 'node:util'
import chokidar from 'chokidar'
import { compileStyle } from '../compilers/css.js'
import { compileJS } from '../compilers/js.js'
import { compileXML } from '../compilers/xml.js'
import { currentTime, measureTime } from '../utils/index.js'

const SCRIPT_EXTENSIONS = new Set(['js', 'mjs', 'cjs'])
const STYLE_EXTENSIONS = new Set(['scss', 'sass', 'css'])
const TEMPLATE_EXTENSIONS = new Set(['xml', 'hbs', 'handlebars'])

/**
 * Watch source files for changes and recompile incrementally.
 *
 * @param {object} options - Resolved watch options
 * @returns {import('chokidar').FSWatcher} The active file watcher instance
 */
export function watchMode(options) {
  console.warn(`[${currentTime()}] Watching for file changes...`)

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
    const fileNamesLog = []

    changesToProcess.forEach((filePath) => {
      const fileName = path.basename(filePath)
      const extension = path.extname(filePath).slice(1).toLowerCase()

      fileNamesLog.push(fileName)

      if (SCRIPT_EXTENSIONS.has(extension)) {
        requiresScript = true
      }
      if (STYLE_EXTENSIONS.has(extension)) {
        requiresStyle = true
      }
      if (TEMPLATE_EXTENSIONS.has(extension)) {
        requiresTemplate = true
      }
    })

    const { recompileOnAnyChange } = options.hamlet ?? {}

    // Skip compilation if no recognized extensions changed
    // (unless recompileOnAnyChange is enabled)
    if (!requiresScript && !requiresStyle && !requiresTemplate && !recompileOnAnyChange) {
      isCompiling = false
      return
    }

    console.warn(`[${currentTime()}] Compiling... ${styleText('yellow', `(${fileNamesLog.join(', ')})`)}`)

    try {
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
    }
    catch (error) {
      console.error(styleText('red', '[Watch Error] Compilation error:'), error)
    }
    finally {
      const end = performance.now()
      console.warn(`[${currentTime()}] Finishing in ${styleText('blue', measureTime(end, start))}`)
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
