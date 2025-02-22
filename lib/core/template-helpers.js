import Handlebars from 'handlebars'
import { getAsset } from '../utils.js'

// Get asset content
// @param {String} assetFolder - The asset folder
// @return {String} - The asset content
function asset (assetFolder) {
  return new Handlebars.SafeString(getAsset(assetFolder))
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
  return console.warn(`Helper: {{${options.name}}} does not exist`)
}

// Helper to show a warning when a block helper is missing
// @return {String} - Warning message
function blockHelperMissing (...args) {
  const options = args.pop()
  return console.warn(`Block Helper: {{${options.name}}} does not exist`)
}

export default {
  asset,
  currentYear,
  helperMissing,
  blockHelperMissing
}
