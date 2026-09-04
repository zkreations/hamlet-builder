import { lilconfig } from 'lilconfig'

export * from './errors.js'
export * from './fs.js'
export * from './strings.js'
export * from './time.js'
export * from './xml-attrs.js'

/**
 * Search and load configuration file using lilconfig.
 *
 * @param {string} fileName - Base configuration name (e.g. 'hamlet', 'postcss')
 * @returns {Promise<any>} The loaded config object or null
 */
export async function getConfig(fileName) {
  const explorer = lilconfig(fileName)
  const result = await explorer.search()

  return result && result.config
    ? result.config
    : null
}
