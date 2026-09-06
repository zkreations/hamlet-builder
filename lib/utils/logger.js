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

let warningCount = 0
let errorCount = 0

export const logger = {
  hamlet(version, mode) {
    const brand = badge('hamlet', ['bgCyan', 'black'])
    const meta = styleText('dim', `v${version} in ${mode} mode`)
    console.warn(`${brand} ${meta}`)
  },

  built(msg) {
    console.warn(`${badge('built', ['bgGreen', 'black'])} ${msg}`)
  },

  ready(msg) {
    console.warn(`${badge('ready', ['bgGreen', 'black'])} ${msg}`)
  },

  warn(msg, location) {
    warningCount++
    console.warn(`${badge('warn', ['bgYellow', 'black'])} ${msg}`)
    if (location) {
      console.warn(`       ${styleText('dim', location)}`)
    }
  },

  getWarningCount() {
    return warningCount
  },

  resetWarnings() {
    warningCount = 0
  },

  error(msg, location) {
    errorCount++
    console.error(`${badge('error', ['bgRed', 'white'])} ${msg}`)
    if (location) {
      console.error(`       ${styleText('dim', location)}`)
    }
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
}
