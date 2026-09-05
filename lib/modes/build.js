import { styleText } from 'node:util'
import { build } from '../builder.js'
import { currentTime, measureTime } from '../utils/index.js'

/**
 * Orchestrate build mode for compiling styles, scripts, and templates.
 *
 * @param {object} options - Resolved build options
 */
export async function buildMode(options) {
  console.warn(`[${currentTime()}] Building the project...`)
  const start = performance.now()

  await build(options)

  const end = performance.now()
  console.warn(`[${currentTime()}] Finishing in ${styleText('blue', measureTime(end, start))}`)
}
