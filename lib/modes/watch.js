import path from 'node:path'
import chalk from 'chalk'
import chokidar from 'chokidar'
import { compileStyle } from '../compilers/css.js'
import { compileJS } from '../compilers/js.js'
import { compileXML } from '../compilers/xml.js'
import { currentTime, measureTime } from '../utils/index.js'

/**
 * Watch source files for changes and recompile incrementally.
 *
 * @param {object} options - Resolved watch options
 * @returns {import('chokidar').FSWatcher} The active file watcher instance
 */
export function watchMode(options) {
  console.warn(`[${currentTime()}] Watching for file changes...`)

  let isCompiling = false
  let debounceTimeout = null
  const pendingChanges = new Set()
  const DEBOUNCE_DELAY = 150

  const processPendingCompilations = async () => {
    if (isCompiling) {
      debounceTimeout = setTimeout(processPendingCompilations, DEBOUNCE_DELAY)
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
    const fileNamesLog = []

    changesToProcess.forEach((filePath) => {
      const fileName = path.basename(filePath)
      const extension = path.extname(filePath).slice(1)

      fileNamesLog.push(fileName)

      if (['js', 'mjs', 'cjs'].includes(extension)) {
        requiresScript = true
      }
      if (['scss', 'sass', 'css'].includes(extension)) {
        requiresStyle = true
      }
    })

    const { recompileOnAnyChange } = options.hamlet ?? {}

    console.warn(`[${currentTime()}] Compiling... ${chalk.yellow(`(${fileNamesLog.join(', ')})`)}`)

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

      await compileXML(options)
    }
    catch (error) {
      console.error(chalk.red('[Watch Error] Compilation error:'), error)
    }
    finally {
      const end = performance.now()
      console.warn(`[${currentTime()}] Finishing in ${chalk.blue(measureTime(end, start))}`)
      isCompiling = false
    }
  }

  const watcher = chokidar.watch(options.input, {
    ignored: [
      /(^|[/\\])\../,
      /node_modules/,
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
