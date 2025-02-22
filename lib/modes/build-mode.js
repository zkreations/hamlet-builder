import chalk from 'chalk'

import { compileStyle } from '../core/compiler-css.js'
import { compileJS } from '../core/compiler-js.js'
import { compileXML } from '../core/compiler-xml.js'

import {
  measureTime,
  currentTime
} from '../utils.js'

export const buildMode = async (config) => {
  console.log(`[${currentTime()}] Building the project...`)
  const start = performance.now()

  // Compile
  await compileJS(config)
  await compileStyle(config)
  await compileXML(config)

  // Log the time it took to compile
  const end = performance.now()
  console.log(`[${currentTime()}] Finishing in ${chalk.blue(measureTime(end, start))}`)
}
