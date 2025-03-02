import chalk from 'chalk'
import chokidar from 'chokidar'
import path from 'node:path'

import { compileStyle } from '../core/compiler-css.js'
import { compileJS } from '../core/compiler-js.js'
import { compileXML } from '../core/compiler-xml.js'

import {
  measureTime,
  currentTime
} from '../utils.js'

export const watchMode = (options) => {
  console.log(`[${currentTime()}] Watching for file changes...`)

  chokidar.watch(options.input, {
    ignored: [
      /(^|[/\\])\../, // Ignore hidden files and folders
      /node_modules/ // Ignore node_modules folder
    ]
  }).on('change', async (filePath) => {
    const fileName = path.basename(filePath)
    const extension = path.extname(filePath).slice(1)
    const start = performance.now()

    const isScript = ['js', 'mjs'].includes(extension)
    const isStyle = ['scss', 'sass', 'css'].includes(extension)

    console.log(`[${currentTime()}] Compiling... ${chalk.yellow(`(${fileName})`)}`)

    if (isScript) {
      await compileJS(options)
    }

    if (isStyle) {
      await compileStyle(options)
    }

    await compileXML(options)

    const end = performance.now()
    console.log(`[${currentTime()}] Finishing in ${chalk.blue(measureTime(end, start))}`)
  })
}
