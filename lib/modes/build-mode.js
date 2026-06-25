import chalk from 'chalk'

import { compileStyle } from '../core/compiler-css.js'
import { compileJS } from '../core/compiler-js.js'
import { compileXML } from '../core/compiler-xml.js'

import {
  currentTime,
  measureTime,
} from '../utils.js'

export async function buildMode(options) {
  console.warn(`[${currentTime()}] Building the project...`)
  const start = performance.now()

  // Compile
  await Promise.all([
    compileJS(options),
    compileStyle(options),
  ])

  await compileXML(options)

  // Log the time it took to compile
  const end = performance.now()
  console.warn(`[${currentTime()}] Finishing in ${chalk.blue(measureTime(end, start))}`)
}
