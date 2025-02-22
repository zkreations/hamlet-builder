import chalk from 'chalk'
import chokidar from 'chokidar'

import { compileStyle } from '../core/compiler-css.js'
import { compileJS } from '../core/compiler-js.js'
import { compileXML } from '../core/compiler-xml.js'

import {
  measureTime,
  currentTime
} from '../utils.js'

export const watchMode = (config) => {
  console.log(`[${currentTime()}] Watching for file changes...`)

  chokidar.watch(config.input, {
    ignored: [
      /(^|[/\\])\../, // Ignore hidden files and folders
      /node_modules/ // Ignore node_modules folder
    ]
  }).on('change', async (filePath) => {
    console.log(`[${currentTime()}] Compiling...`)

    const extension = filePath.split('.').pop()
    const start = performance.now()

    if (['js', 'mjs'].includes(extension)) {
      await compileJS(config)
    }

    if (['scss', 'sass', 'css'].includes(extension)) {
      await compileStyle(config)
    }

    await compileXML(config)

    const end = performance.now()
    console.log(`[${currentTime()}] Finishing in ${chalk.blue(measureTime(end, start))}`)
  })
}
