import fs from 'node:fs'
import path from 'node:path'
import { lilconfig } from 'lilconfig'

const regExpCache = {}

// Compile the regular expression for an attribute
// @param {String} attr - The attribute to search
export function regExpAttr(attr) {
  if (!regExpCache[attr]) {
    regExpCache[attr] = new RegExp(`${attr}=['"](.*?)['"]`, 'g')
  }

  return regExpCache[attr]
}

// Get Attribute
// @param {String} string - The string to search
// @param {String} attr - The attribute to search
export function getAttr(string, attr) {
  const REG_EXP = regExpAttr(attr)
  const match = string.match(REG_EXP)
  return match ? match[0] : null
}

// Remove an attribute
// @param {String} string - The string to search
// @param {String} attr - The attribute to search
export function removeAttr(string, attr) {
  const REG_EXP = regExpAttr(attr)
  return string.replace(REG_EXP, '')
}

// Get the value of an attribute
// @param {String} string - The string to search
// @param {String} attr - The attribute to search
export function getAttrValue(string, attr) {
  const REG_EXP = regExpAttr(attr)
  const matches = Array.from(string.matchAll(REG_EXP), match => match[1])
  return matches.length > 0 ? matches[0] : null
}

// Replace the value of an attribute
// @param {String} string - The string to search
// @param {String} attr - The attribute to search
// @param {String} value - The new value
export function replaceAttrValue(string, attr, value) {
  const REG_EXP = regExpAttr(attr)
  return string.replace(REG_EXP, `${attr}='${value}'`)
}

// Timestamp to date
// @return {String} - Current time
export function currentTime() {
  const date = new Date()
  return date.toLocaleTimeString('en-US', { hour12: false })
}

// Write files in the output directory
// @param {String} output - Output directory
// @param {String} file -The file, Example: file.css
// @param {String} content - File content
export function writeOutput({ output, file, content }) {
  fs.mkdirSync(output, { recursive: true })

  const outputFile = path.join(output, file)
  fs.writeFileSync(outputFile, content)
}

// Get configuration file
// @param {String} fileName - File name
// @return {Object} - Configuration file
export async function getConfig(fileName) {
  const explorer = lilconfig(fileName)
  const result = await explorer.search()

  return result && result.config
    ? result.config
    : null
}

// Measure time
// @param {Number} end - End time
// @param {Number} start - Start time
// @return {String} - Time in seconds
export function measureTime(end, start) {
  const time = end - start
  const seconds = (time / 1000).toFixed(2)
  return `${seconds}s (${Math.round(time)}ms)`
}

// Get Asset content
// @param {String} resolvedPath - The resolved path of the asset
// @return {Object} - The asset content and error (if any)
export function getAsset(resolvedPath) {
  const fileName = path.basename(resolvedPath)

  try {
    const content = fs.readFileSync(resolvedPath, 'utf8')
    return { content }
  }
  catch {
    const error = `The file "${fileName}" does not exist`
    return {
      content: `/* ${error} */`,
      error,
    }
  }
}

// Sanitize spacing
// @param {string} string - The attribute string
// @returns {string}
export function sanitizeSpacing(string) {
  return string
    .replace(/\n/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Get message, line and column number
// @param {Error} error - The error object
// @param {String} file - The file name
// @returns {Object}
export function getErrorDetails(error) {
  const errorMessage = error.message || error.toString()

  const stack = error.stack || ''
  const lineNumber = stack.match(/<anonymous>:(\d+):(\d+)/)

  return {
    message: errorMessage,
    line: lineNumber ? lineNumber[1] : null,
    column: lineNumber ? lineNumber[2] : null,
  }
}
