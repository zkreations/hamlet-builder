import chalk from 'chalk'
import chokidar from 'chokidar'
import fs from 'node:fs'
import { globSync } from 'glob'

import { compileStyle } from './compiler/style.js'
import { compileJS } from './compiler/script.js'
import { compileXML } from './compiler/xml.js'

import {
  measureTime,
  currentTime
} from './utils.js'

export const watchMode = (input, output, options) => {
  console.log(`[${currentTime()}] Watching for file changes...`)

  chokidar.watch(input, {
    ignored: [
      /(^|[/\\])\../, // Ignore hidden files and folders
      /node_modules/, // Ignore node_modules folder
      '!**/*.{mjs,js,scss,sass,css,xml}' // Only watch for these file types
    ]
  }).on('change', async (filePath) => {
    console.log(`[${currentTime()}] Compiling...`)

    const extension = filePath.split('.').pop()
    const start = performance.now()

    const hasTailwind = globSync(`${input}/**/*.css`).filter(file => {
      return fs.readFileSync(file, 'utf8')
        .includes('@import "tailwindcss"')
    })

    if (['js', 'mjs'].includes(extension)) {
      await compileJS(input, output, options)
    }

    if (['scss', 'sass', 'css'].includes(extension) || hasTailwind.length > 0) {
      await compileStyle(input, output, options)
    }

    await compileXML(input, output, options)

    const end = performance.now()
    console.log(`[${currentTime()}] Finishing in ${chalk.blue(measureTime(end, start))}`)
  })
}
