import { styleText } from 'node:util'
import { printPartialsInfo } from '../formatters/info-printer.js'
import { currentTime, measureTime } from '../utils/index.js'

/**
 * Display diagnostic and project configuration information.
 *
 * @param {object} options - Resolved options
 */
export async function infoMode(options) {
  const start = performance.now()

  await printPartialsInfo(options)

  const end = performance.now()
  console.warn(`[${currentTime()}] Task completed in ${styleText('blue', measureTime(end, start))}`)
}
