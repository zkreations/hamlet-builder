import chalk from 'chalk'
import { capitalize } from '../utils/index.js'
import {
  isValidContext,
  isValidHelper,
  isValidHelperName,
  isValidNamespace,
  isValidPartial,
  isValidPartialName,
  isValidPluginShape,
} from './validator.js'

/**
 * Merge and register plugins returned from hamlet.config.js.
 *
 * @param {Array} plugins - List of plugin configs or promises
 * @param {object} existing - Already registered { partials, helpers } to check collisions against
 * @returns {Promise<{ partials: object, helpers: object, contexts: object }>} Resolved plugins bundle
 */
export async function loadPlugins(plugins = [], existing = {}) {
  const partials = Object.create(null)
  const helpers = Object.create(null)
  const contexts = Object.create(null)

  const reservedPartials = new Set([
    ...Object.keys(existing.partials ?? {}),
  ])

  const reservedHelpers = new Set([
    ...Object.keys(existing.helpers ?? {}),
  ])

  const namespaces = new Set()

  let index = 0

  for (const entry of plugins) {
    index++

    if (!entry)
      continue

    let plugin

    try {
      plugin = await entry
    }
    catch (error) {
      console.warn(`${chalk.yellow('[Warning]')} Plugin at index ${index} failed during execution: ${error.message}\n`)
      continue
    }

    if (!isValidPluginShape(plugin)) {
      console.warn(`${chalk.yellow('[Warning]')} Plugin #${index} must resolve to a plain object. Skipped.\n`)
      continue
    }

    const { namespace } = plugin

    if (!isValidNamespace(namespace)) {
      console.warn(`${chalk.yellow('[Warning]')} Plugin #${index} must define a valid namespace. Skipped.\n`)
      continue
    }

    if (namespaces.has(namespace)) {
      console.warn(`${chalk.yellow('[Warning]')} Duplicate plugin namespace "${namespace}". Skipped.\n`)
      continue
    }

    namespaces.add(namespace)

    for (const [key, value] of Object.entries(plugin.partials ?? {})) {
      if (!isValidPartialName(key)) {
        console.warn(`${chalk.yellow('[Warning]')} Plugin "${namespace}" partial "${key}" has an invalid name. Skipped.\n`)
        continue
      }

      if (!isValidPartial(value)) {
        console.warn(`${chalk.yellow('[Warning]')} Plugin "${namespace}" partial "${key}" must be a string. Skipped.\n`)
        continue
      }

      const fullName = `${namespace}.${key}`

      if (reservedPartials.has(fullName)) {
        console.warn(`${chalk.yellow('[Warning]')} Plugin "${namespace}" tried to register partial "${fullName}", which already exists. Skipped.\n`)
        continue
      }

      partials[fullName] = `${value.trim()}\n`
      reservedPartials.add(fullName)
    }

    for (const [key, value] of Object.entries(plugin.helpers ?? {})) {
      if (!isValidHelperName(key)) {
        console.warn(`${chalk.yellow('[Warning]')} Plugin "${namespace}" helper "${key}" has an invalid name. Skipped.\n`)
        continue
      }

      if (!isValidHelper(value)) {
        console.warn(`${chalk.yellow('[Warning]')} Plugin "${namespace}" helper "${key}" must be a function. Skipped.\n`)
        continue
      }

      const fullName = `${namespace}${capitalize(key)}`

      if (reservedHelpers.has(fullName)) {
        console.warn(`${chalk.yellow('[Warning]')} Plugin "${namespace}" tried to register helper "${fullName}", which already exists. Skipped.\n`)
        continue
      }

      helpers[fullName] = value
      reservedHelpers.add(fullName)
    }

    if ('context' in plugin) {
      if (!isValidContext(plugin.context)) {
        console.warn(`${chalk.yellow('[Warning]')} Plugin "${namespace}" context must be a plain object. Ignored.\n`)
      }
      else {
        contexts[namespace] = Object.freeze({ ...plugin.context })
      }
    }
  }

  return { partials, helpers, contexts }
}
