import fs from 'node:fs/promises'
import { globSync } from 'glob'
import { loadPlugins } from '../plugins/loader.js'
import { collectPartials } from './collector.js'

const GLOB_IGNORED = ['**/node_modules/**', '**/.git/**']

export async function buildSearchCorpus(input, partials, pluginPartials) {
  const mainFiles = globSync(`${input}/**/!(_)*.@(xml|hbs|handlebars)`, {
    ignore: GLOB_IGNORED,
  })
  const mainContents = await Promise.all(mainFiles.map(f => fs.readFile(f, 'utf8')))

  const partialTemplates = Object.entries(partials)
    .filter(([key]) => !key.startsWith('folder.') && !key.startsWith('hamlet.'))
    .map(([, p]) => p.template ?? '')
  const pluginTemplates = Object.values(pluginPartials)

  return [...mainContents, ...partialTemplates, ...pluginTemplates].join('\n')
}

export function extractReferences(corpus) {
  const refs = new Set()
  for (const match of corpus.matchAll(/\{\{#?>\s*([\w./-]+)/g)) {
    refs.add(match[1].trim())
  }
  return refs
}

export function propagateReferences(refs, partials) {
  let changed = true
  while (changed) {
    changed = false
    for (const ref of Array.from(refs)) {
      if (ref.startsWith('folder.') && partials[ref]?.template) {
        const childRefs = extractReferences(partials[ref].template)
        for (const child of childRefs) {
          if (!refs.has(child)) {
            refs.add(child)
            changed = true
          }
        }
      }
    }
  }
}

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

export async function analyzePartials(options, onProgress) {
  onProgress?.('analyzing partials...')
  const collected = await collectPartials(options.input)
  const { partials, normalPartialsByFolder, folderPartialsInfo } = collected

  const pluginsConfig = Array.isArray(options.hamlet?.plugins) ? options.hamlet.plugins : []
  const { partials: pluginPartials } = await loadPlugins(pluginsConfig, { partials })

  onProgress?.('analyzing references...')
  const corpus = await buildSearchCorpus(options.input, partials, pluginPartials)
  const refs = extractReferences(corpus)
  propagateReferences(refs, partials)
  const unused = findUnusedPartials(normalPartialsByFolder, folderPartialsInfo, pluginPartials, refs)

  return {
    ...collected,
    pluginPartials,
    unused,
    refs,
  }
}
