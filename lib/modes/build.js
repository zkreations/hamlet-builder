import { build } from '../builder.js'
import { logger, measureTime } from '../utils/index.js'

export async function buildMode(options) {
  logger.resetWarnings()
  const start = performance.now()

  await build(options)

  const count = logger.getWarningCount()
  const warnSuffix = count > 0 ? ` (with ${count} ${count === 1 ? 'warning' : 'warnings'})` : ''
  logger.built(`completed in ${measureTime(performance.now(), start)}${warnSuffix}`)
}
