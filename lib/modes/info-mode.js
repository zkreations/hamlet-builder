import { loadPartialsInfo } from '../core/load-partials.js'

export const infoMode = async (options) => {
  loadPartialsInfo(options.input)
  process.exit(0)
}
