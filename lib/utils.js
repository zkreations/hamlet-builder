import fs from 'node:fs'
import path from 'node:path'
import { lilconfig } from 'lilconfig'
const regExpCache = {}

// Compile the regular expression for an attribute
// @param {String} attr - The attribute to search
export function regExpAttr (attr) {
  if (!regExpCache[attr]) {
    regExpCache[attr] = new RegExp(`${attr}=['"](.*?)['"]`, 'g')
  }

  return regExpCache[attr]
}

// Get Attribute
// @param {String} string - The string to search
// @param {String} attr - The attribute to search
export const getAttr = (string, attr) => {
  const REG_EXP = regExpAttr(attr)
  const match = string.match(REG_EXP)
  return match ? match[0] : null
}

// Remove an attribute
// @param {String} string - The string to search
// @param {String} attr - The attribute to search
export const removeAttr = (string, attr) => {
  const REG_EXP = regExpAttr(attr)
  return string.replace(REG_EXP, '')
}

// Get the value of an attribute
// @param {String} string - The string to search
// @param {String} attr - The attribute to search
export const getAttrValue = (string, attr) => {
  const REG_EXP = regExpAttr(attr)
  const matches = Array.from(string.matchAll(REG_EXP), match => match[1])
  return matches.length > 0 ? matches[0] : null
}

// Replace the value of an attribute
// @param {String} string - The string to search
// @param {String} attr - The attribute to search
// @param {String} value - The new value
export const replaceAttrValue = (string, attr, value) => {
  const REG_EXP = regExpAttr(attr)
  return string.replace(REG_EXP, `${attr}='${value}'`)
}

// Timestamp to date
// @return {String} - Current time
export const currentTime = () => {
  const date = new Date()
  return date.toLocaleTimeString('en-US', { hour12: false })
}

// Write files in the output directory
// @param {String} output - Output directory
// @param {String} file -The file, Example: file.css
// @param {String} content - File content
export const writeOutput = ({ output, file, content }) => {
  if (!fs.existsSync(output)) {
    fs.mkdirSync(output, { recursive: true })
  }

  // Write normal file
  const outputFile = path.join(output, file)
  fs.writeFileSync(outputFile, content)
}

// Get configuration file
// @param {String} fileName - File name
// @return {Object} - Configuration file
export const getConfig = async (fileName) => {
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
export const measureTime = (end, start) => {
  const time = end - start
  const seconds = (time / 1000).toFixed(2)
  return `${seconds}s (${Math.round(time)}ms)`
}

// Get Asset content
// @param {String} assetFolder - Asset folder
// @return {String} - Asset content
export const getAsset = (assetFolder) => {
  const userPath = process.cwd()

  if (assetFolder.startsWith('~')) {
    assetFolder = assetFolder.replace(/^~/, 'node_modules/')
  }

  const fullPath = path.join(userPath, assetFolder)

  if (!fs.existsSync(fullPath)) {
    const result = `Error: ${fullPath} does not exist`
    console.error(result)
    return `/*${result}*/`
  }

  const content = fs.readFileSync(fullPath, 'utf8')
  return content
}

// Sanitize spacing
// @param {string} string - The attribute string
// @returns {string}
export const sanitizeSpacing = (string) => {
  return string
    .replace(/\n/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Get message, line and column number
// @param {Error} error - The error object
// @param {String} file - The file name
// @returns {Object}
export const getErrorDetails = (error) => {
  const errorMessage = error.message || error.toString()

  const stack = error.stack || ''
  const lineNumber = stack.match(/<anonymous>:(\d+):(\d+)/)

  return {
    message: errorMessage,
    line: lineNumber ? lineNumber[1] : null,
    column: lineNumber ? lineNumber[2] : null
  }
}
