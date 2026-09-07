import { printPartialsInfo } from '../formatters/info-printer.js'
import { logger, measureTime } from '../utils/index.js'

export async function infoMode(options) {
  const start = performance.now()
  const progress = logger.progress('inspect', 'cyan', 'analyzing partials...')

  try {
    await printPartialsInfo(options, (msg) => {
      if (msg) {
        progress.update(msg)
      }
      else {
        progress.clear()
      }
    })
  }
  finally {
    progress.clear()
  }

  const end = performance.now()
  logger.ready(`inspect completed in ${measureTime(end, start)}`)
}
