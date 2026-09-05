import fs from 'node:fs/promises'
import { globSync } from 'glob'
import { loadPlugins } from '../plugins/loader.js'
import { collectPartials } from './collector.js'

const GLOB_IGNORED = ['**/node_modules/**', '**/.git/**']

/**
 * Build a combined search corpus from main template files, user partials, and plugin partials.
 *
 * @param {string} input - The input directory
 * @param {object} partials - Collected partials
 * @param {object} pluginPartials - Plugin partials
 * @returns {Promise<string>} Combined template corpus
 */
export async function buildSearchCorpus(input, partials, pluginPartials) {
  const mainFiles = globSync(`${input}/**/!(_)*.@(xml|hbs|handlebars)`, {
    ignore: GLOB_IGNORED,
  })
  const mainContents = await Promise.all(mainFiles.map(f => fs.readFile(f, 'utf8')))

  const partialTemplates = Object.values(partials).map(p => p.template ?? '')
  const pluginTemplates = Object.values(pluginPartials)

  return [...mainContents, ...partialTemplates, ...pluginTemplates].join('\n')
}

/**
 * Extract all partial references from the search corpus.
 *
 * @param {string} corpus - The combined search corpus
 * @returns {Set<string>} Set of referenced partial names
 */
export function extractReferences(corpus) {
  const RE = /\{\{#?>\s*([\w./-]+)/g
  const refs = new Set()

  let match = RE.exec(corpus)
  while (match !== null) {
    refs.add(match[1].trim())
    match = RE.exec(corpus)
  }

  return refs
}

/**
 * Find partials that are not referenced anywhere in the corpus.
 *
 * @param {object} normalPartialsByFolder - Partials grouped by folder
 * @param {Array<object>} folderPartialsInfo - Folder partials metadata
 * @param {object} pluginPartials - Plugin partials map
 * @param {Set<string>} refs - Referenced partial names
 * @returns {Array<{ name: string, origin: string }>} Unused partials
 */
export function findUnusedPartials(normalPartialsByFolder, folderPartialsInfo, pluginPartials, refs) {
  const unused = []

  for (const [folder, names] of Object.entries(normalPartialsByFolder)) {
    for (const name of names) {
      if (!refs.has(name))
        unused.push({ name, origin: `${folder}/` })
    }
  }

  for (const { name, folderPath } of folderPartialsInfo) {
    if (!refs.has(name))
      unused.push({ name, origin: folderPath })
  }

  for (const name of Object.keys(pluginPartials)) {
    if (!refs.has(name))
      unused.push({ name, origin: `${name.split('.')[0]} (plugin)` })
  }

  return unused
}

/**
 * Perform a full partials analysis for diagnostic/reporting purposes.
 *
 * @param {object} options - Configuration and paths options
 * @returns {Promise<object>} Complete analysis results
 */
export async function analyzePartials(options) {
  const collected = await collectPartials(options.input)
  const { partials, normalPartialsByFolder, folderPartialsInfo } = collected

  const pluginsConfig = Array.isArray(options.hamlet?.plugins) ? options.hamlet.plugins : []
  const { partials: pluginPartials } = await loadPlugins(pluginsConfig, { partials })

  const corpus = await buildSearchCorpus(options.input, partials, pluginPartials)
  const refs = extractReferences(corpus)
  const unused = findUnusedPartials(normalPartialsByFolder, folderPartialsInfo, pluginPartials, refs)

  return {
    ...collected,
    pluginPartials,
    unused,
  }
}
