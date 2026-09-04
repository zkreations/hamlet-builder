import Handlebars from 'handlebars'
import { hamletPartials } from '../data/partials.js'
import builtInHelpers from './helpers.js'

/**
 * Create an isolated Handlebars instance configured with Hamlet built-ins,
 * user-defined and plugin-defined partials and helpers.
 *
 * @param {object} [options]
 * @param {object} [options.partials] - User partials
 * @param {object} [options.helpers] - User helpers
 * @param {object} [options.pluginPartials] - Plugin partials
 * @param {object} [options.pluginHelpers] - Plugin helpers
 * @returns {typeof Handlebars} An isolated Handlebars instance
 */
export function createHandlebarsEnvironment({
  partials = {},
  helpers = {},
  pluginPartials = {},
  pluginHelpers = {},
} = {}) {
  const hbs = Handlebars.create()

  hbs.registerHelper(builtInHelpers)
  hbs.registerPartial(hamletPartials)

  if (partials && Object.keys(partials).length > 0) {
    hbs.registerPartial(partials)
  }

  if (helpers && Object.keys(helpers).length > 0) {
    hbs.registerHelper(helpers)
  }

  if (pluginPartials && Object.keys(pluginPartials).length > 0) {
    hbs.registerPartial(pluginPartials)
  }

  if (pluginHelpers && Object.keys(pluginHelpers).length > 0) {
    hbs.registerHelper(pluginHelpers)
  }

  return hbs
}
