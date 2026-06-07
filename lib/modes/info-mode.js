import chalk from 'chalk'

import { loadPartialsInfo } from '../core/load-partials.js'
import { measureTime } from '../utils.js'

// Info mode: Show information about the current project
// @param {object} options - The options object
// @return void
export const infoMode = async (options) => {
  const start = performance.now()

  await loadPartialsInfo(options.input)

  const end = performance.now()

  console.log(`Task completed in ${chalk.blue(measureTime(end, start))}`)
  process.exit(0)
}
