import chalk from 'chalk'
import {
  isNamespacedHelper,
  isNamespacedPartial,
  isValidHelper,
  isValidHelperName,
  isValidNamespace,
  isValidPartial,
  isValidPartialName,
  isValidPluginShape,
} from './validate-plugin.js'

// Merge and register plugins returned from hamlet.config.js (sync, async, or falsy to skip).
// @param {Array} plugins - List of already-invoked plugin results
// @param {Object} existing - Already registered { partials, helpers } to check collisions against
// @return {Object} - { partials, helpers }
export async function loadPlugins(plugins = [], existing = {}) {
  const partials = Object.create(null)
  const helpers = Object.create(null)

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
        console.warn(`${chalk.yellow('[Warning]')} Plugin "${namespace}" partial "${key}" has an invalid or reserved name. Skipped.\n`)
        continue
      }

      if (!isNamespacedPartial(key, namespace)) {
        console.warn(`${chalk.yellow('[Warning]')} Plugin "${namespace}" partial "${key}" must be prefixed with "${namespace}.". Skipped.\n`)
        continue
      }

      if (!isValidPartial(value)) {
        console.warn(`${chalk.yellow('[Warning]')} Plugin "${namespace}" partial "${key}" must be a string. Skipped.\n`)
        continue
      }

      if (reservedPartials.has(key)) {
        console.warn(`${chalk.yellow('[Warning]')} Plugin "${namespace}" tried to register partial "${key}", which already exists. Skipped.\n`)
        continue
      }

      partials[key] = `${value.trim()}\n`
      reservedPartials.add(key)
    }

    for (const [key, value] of Object.entries(plugin.helpers ?? {})) {
      if (!isValidHelperName(key)) {
        console.warn(`${chalk.yellow('[Warning]')} Plugin "${namespace}" helper "${key}" has an invalid name. Helper names cannot contain dots. Skipped.\n`)
        continue
      }

      if (!isNamespacedHelper(key, namespace)) {
        console.warn(`${chalk.yellow('[Warning]')} Plugin "${namespace}" helper "${key}" must be prefixed with "${namespace}" followed by an uppercase letter (e.g. "${namespace}Format"). Skipped.\n`)
        continue
      }

      if (!isValidHelper(value)) {
        console.warn(`${chalk.yellow('[Warning]')} Plugin "${namespace}" helper "${key}" must be a function. Skipped.\n`)
        continue
      }

      if (reservedHelpers.has(key)) {
        console.warn(`${chalk.yellow('[Warning]')} Plugin "${namespace}" tried to register helper "${key}", which already exists. Skipped.\n`)
        continue
      }

      helpers[key] = value
      reservedHelpers.add(key)
    }
  }

  return { partials, helpers }
}
