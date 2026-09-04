import { compileStyle } from './compilers/css.js'
import { compileJS } from './compilers/js.js'
import { compileXML } from './compilers/xml.js'

/**
 * Orchestrate complete build by compiling styles, scripts, and XML templates.
 *
 * @param {object} options - Resolved build options
 * @returns {Promise<void>}
 */
export async function build(options) {
  await Promise.all([
    compileJS(options),
    compileStyle(options),
  ])

  await compileXML(options)
}
