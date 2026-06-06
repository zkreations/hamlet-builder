import chalk from 'chalk'
import path from 'node:path'
import Handlebars from 'handlebars'
import { getAsset } from '../utils.js'

// Whitelist of allowed file extensions for asset inclusion
const ALLOWED_EXTENSIONS = new Set([
  '.css',
  '.js',
  '.html', '.xml', '.svg',
  '.md', '.txt', '.json', '.yaml', '.yml', '.toml'
])

// Base directory for path traversal protection
const ALLOWED_BASE = process.cwd()

// Set to track files currently being processed (circular reference protection)
const activeAssets = new Set()

// Resolve the asset path replicating getAsset logic
// @param {String} assetFolder - The asset folder
// @return {String} - The resolved path
function resolveAssetPath (assetFolder) {
  const normalized = assetFolder.startsWith('~')
    ? assetFolder.replace(/^~/, 'node_modules/')
    : assetFolder.replace(/^\//, '')

  return path.resolve(ALLOWED_BASE, normalized)
}

// Check if the resolved path is within the project directory
// @param {String} resolvedPath - The resolved path
// @return {Boolean}
function isPathAllowed (resolvedPath) {
  return resolvedPath.startsWith(ALLOWED_BASE)
}

// Check if the file extension is in the whitelist
// @param {String} resolvedPath - The resolved path
// @return {Boolean}
function isAllowedExtension (resolvedPath) {
  const ext = path.extname(resolvedPath).toLowerCase()
  return ALLOWED_EXTENSIONS.has(ext)
}

// Get asset content
// @param {String} assetFolder - The asset folder
// @return {String} - The asset content
function asset (assetFolder) {
  const resolvedPath = resolveAssetPath(assetFolder)

  if (!isPathAllowed(resolvedPath)) {
    console.warn(`${chalk.yellow('[Warning]')} Access denied outside project: "${assetFolder}"\n`)
    return new Handlebars.SafeString(`/* Access denied: ${assetFolder} */`)
  }

  if (!isAllowedExtension(resolvedPath)) {
    const ext = path.extname(resolvedPath) || '(no extension)'
    console.warn(`${chalk.yellow('[Warning]')} File type not allowed: "${ext}" in "${assetFolder}"\n`)
    return new Handlebars.SafeString(`/* File type not allowed: ${assetFolder} */`)
  }

  if (activeAssets.has(resolvedPath)) {
    console.warn(`${chalk.yellow('[Warning]')} Circular reference detected: "${assetFolder}"\n`)
    return new Handlebars.SafeString(`/* Circular reference: ${assetFolder} */`)
  }

  activeAssets.add(resolvedPath)

  try {
    const content = getAsset(resolvedPath)

    if (content.error) {
      console.warn(`${chalk.yellow('[Warning]')} ${content.error}: "${assetFolder}"\n`)
      return new Handlebars.SafeString(`/* ${content.error} */`)
    }

    return new Handlebars.SafeString(content.content)
  } finally {
    activeAssets.delete(resolvedPath)
  }
}

// Get the current year
// @return {String} - The current year
function currentYear () {
  return new Date().getFullYear()
}

// Helper to show a warning when a helper is missing
// @return {String} - Warning message
function helperMissing (...args) {
  const options = args.pop()
  return console.warn(`${chalk.yellow('[Warning]')} The helper {{${options.name}}} does not exist\n`)
}

// Helper to show a warning when a block helper is missing
// @return {String} - Warning message
function blockHelperMissing (...args) {
  const options = args.pop()
  return console.warn(`${chalk.yellow('[Warning]')} The block helper {{#${options.name}}} does not exist\n`)
}

export default {
  asset,
  currentYear,
  helperMissing,
  blockHelperMissing
}
