import chalk from 'chalk'

import { compileStyle } from './compiler/style.js'
import { compileJS } from './compiler/script.js'
import { compileXML } from './compiler/xml.js'

import {
  measureTime,
  currentTime
} from './utils.js'

export const buildMode = async (input, output, options) => {
  console.log(`[${currentTime()}] Building the project...`)
  const start = performance.now()

  // Compile
  await compileJS(input, output, options)
  await compileStyle(input, output, options)
  await compileXML(input, output, options)

  // Log the time it took to compile
  const end = performance.now()
  console.log(`[${currentTime()}] Finishing in ${chalk.blue(measureTime(end, start))}`)
}
