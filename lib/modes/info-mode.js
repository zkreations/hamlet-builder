import { loadPartialsInfo } from '../core/load-partials.js'

// Info mode: Show information about the current project
// @param {object} options - The options object
// @return void
export const infoMode = async (options) => {
  loadPartialsInfo(options.input)
  process.exit(0)
}
