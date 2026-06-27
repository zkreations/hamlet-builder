import path from 'node:path'
import chalk from 'chalk'
import chokidar from 'chokidar'

import { compileStyle } from '../core/compiler-css.js'
import { compileJS } from '../core/compiler-js.js'
import { compileXML } from '../core/compiler-xml.js'

import {
  currentTime,
  measureTime,
} from '../utils.js'

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

    const { recompileStyleOnAnyChange } = options.hamlet ?? {}

    console.warn(`[${currentTime()}] Compiling... ${chalk.yellow(`(${fileNamesLog.join(', ')})`)}`)

    try {
      const tasks = []

      if (requiresScript) {
        tasks.push(compileJS(options))
      }

      if (requiresStyle || recompileStyleOnAnyChange) {
        tasks.push(compileStyle(options))
      }

      tasks.push(compileXML(options))
      await Promise.all(tasks)
    }
    catch (error) {
      console.error(chalk.red('[Watch Error] Ocurrió un error en la compilación:', error))
    }
    finally {
      const end = performance.now()
      console.warn(`[${currentTime()}] Finishing in ${chalk.blue(measureTime(end, start))}`)
      isCompiling = false
    }
  }

  chokidar.watch(options.input, {
    ignored: [
      /(^|[/\\])\../,
      /node_modules/,
    ],
    ignoreInitial: true,
  }).on('change', (filePath) => {
    pendingChanges.add(filePath)
    clearTimeout(debounceTimeout)
    debounceTimeout = setTimeout(processPendingCompilations, DEBOUNCE_DELAY)
  })
}
