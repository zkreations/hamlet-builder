import process from 'node:process'
import chalk from 'chalk'
import { loadPartialsInfo } from '../core/load-partials.js'
import { measureTime } from '../utils.js'

// Info mode: Show information about the current project
// @param {object} options - The options object
// @return void
export async function infoMode(options) {
  const start = performance.now()

  await loadPartialsInfo(options.input)

  const end = performance.now()

  console.warn(`Task completed in ${chalk.blue(measureTime(end, start))}`)
  process.exit(0)
}
