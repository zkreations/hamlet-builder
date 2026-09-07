import process from 'node:process'
import { styleText } from 'node:util'
import { currentTime } from './time.js'

function badge(text, styles) {
  return styleText(styles, ` ${text} `)
}

function processLine(tag, color, msg) {
  const time = styleText('dim', currentTime())
  const label = styleText(color, `[${tag}]`)
  console.warn(`${time} ${label} ${msg}`)
}

function printLocation(writer, location) {
  if (!location)
    return

  const lines = Array.isArray(location)
    ? location
    : String(location).split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) {
      writer(`       ${styleText('dim', trimmed)}`)
    }
  }
}

let warningCount = 0
let errorCount = 0

export const logger = {
  hamlet(version, mode) {
    const brand = badge('hamlet', ['bgCyan', 'black'])
    const meta = styleText('dim', `v${version} in ${mode} mode`)
    console.warn(`${brand} ${meta}`)
  },

  built(msg) {
    console.warn(`\n${badge('built', ['bgGreen', 'black'])} ${msg}\n`)
  },

  ready(msg) {
    console.warn(`\n${badge('ready', ['bgGreen', 'black'])} ${msg}\n`)
  },

  reload(msg) {
    console.warn(`\n${badge('reload', ['bgMagenta', 'white'])} ${msg}\n`)
  },

  warn(msg, location) {
    warningCount++
    console.warn(`\n${badge('warn', ['bgYellow', 'black'])} ${msg}`)
    printLocation(console.warn, location)
    console.warn('')
  },

  getWarningCount() {
    return warningCount
  },

  resetWarnings() {
    warningCount = 0
  },

  error(msg, location) {
    errorCount++
    console.error(`\n${badge('error', ['bgRed', 'white'])} ${msg}`)
    printLocation(console.error, location)
    console.error('')
  },

  getErrorCount() {
    return errorCount
  },

  resetErrors() {
    errorCount = 0
  },

  css(msg) {
    processLine('css', 'magenta', msg)
  },

  js(msg) {
    processLine('js', 'yellow', msg)
  },

  xml(msg) {
    processLine('xml', 'cyan', msg)
  },

  watch(msg) {
    processLine('watch', 'blue', msg)
  },

  progress(tag, color, initialMsg) {
    const isTTY = Boolean(process.stderr.isTTY)
    let active = false

    const render = (msg) => {
      if (!isTTY)
        return
      const time = styleText('dim', currentTime())
      const label = styleText(color, `[${tag}]`)
      process.stderr.write(`\r\x1B[2K${time} ${label} ${styleText('dim', msg)}`)
      active = true
    }

    if (initialMsg) {
      render(initialMsg)
    }

    return {
      update(msg) {
        render(msg)
      },
      clear() {
        if (!isTTY || !active)
          return
        process.stderr.write('\r\x1B[2K')
        active = false
      },
    }
  },
}
