import path from 'node:path'
import process from 'node:process'
import { styleText } from 'node:util'
import { analyzePartials } from '../partials/analyzer.js'
import { createHelpers } from '../templates/helpers.js'

function formatRelativePath(root, targetPath) {
  const rel = path.relative(root, targetPath).split(path.sep).join('/')
  return rel.startsWith('.') ? rel : `./${rel}`
}

function printConfig(options) {
  const root = options.cwd || process.cwd()

  const minifyItems = []
  if (options.minify !== false) {
    if (options.minifyCss ?? true) {
      minifyItems.push('css')
    }
    if (options.minifyJs ?? true) {
      minifyItems.push('js')
    }
  }
  const minifyStr = minifyItems.length > 0 ? minifyItems.join(', ') : 'none'

  console.warn(styleText('blue', '[config]'))
  console.warn(`  input:                ${formatRelativePath(root, options.input)}`)
  console.warn(`  output:               ${formatRelativePath(root, options.output)}`)
  console.warn(`  mode:                 ${options.mode}`)
  console.warn(`  minify:               ${minifyStr}`)
  console.warn(`  recompileOnAnyChange: ${options.hamlet?.recompileOnAnyChange ?? false}`)
  console.warn(`  resolveMarkups:       ${options.hamlet?.resolveMarkups ?? true}`)
  console.warn('')
}

function printHamletPartials(items, refs = new Set()) {
  const sorted = [...items].sort()
  const used = sorted.filter(name => refs.has(name))
  const available = sorted.filter(name => !refs.has(name))
  const strip = name => name.replace(/^hamlet\./, '')

  console.warn(`${styleText('cyan', '[partials]')} ${styleText('dim', `hamlet (${sorted.length} built-in)`)}`)
  console.warn(`  ${styleText('dim', 'syntax: {{> hamlet.<name>}}')}`)
  console.warn('')

  if (used.length > 0) {
    console.warn(`  in use (${used.length}):     ${used.map(strip).join(', ')}`)
    console.warn(`  available (${available.length}): ${available.map(strip).join(', ')}`)
  }
  else {
    const names = sorted.map(strip)
    const mid = Math.ceil(names.length / 2)
    console.warn(`  ${names.slice(0, mid).join(', ')},`)
    console.warn(`  ${names.slice(mid).join(', ')}`)
  }
  console.warn('')
}

function printEmptyProjectPartials() {
  console.warn(`${styleText('cyan', '[partials]')} ${styleText('dim', 'project')}`)
  console.warn('  normal:  none')
  console.warn('  folders: none')
  console.warn('  plugins: none')
  console.warn('')
}

function printNormalPartialsByFolder(normalPartialsByFolder, partials, refs, root) {
  const total = Object.values(normalPartialsByFolder).reduce((sum, arr) => sum + arr.length, 0)
  if (total === 0) {
    return
  }

  console.warn(`${styleText('cyan', '[partials]')} ${styleText('dim', `project (${total})`)}`)
  console.warn(`  ${styleText('dim', 'syntax: {{> <name>}}')}`)
  console.warn('')

  let maxNameLen = 0
  for (const names of Object.values(normalPartialsByFolder)) {
    for (const name of names) {
      if (name.length > maxNameLen) {
        maxNameLen = name.length
      }
    }
  }
  const colWidth = Math.max(16, maxNameLen + 2)

  for (const [folderPath, names] of Object.entries(normalPartialsByFolder)) {
    const relFolder = path.relative(root, folderPath).split(path.sep).join('/')
    console.warn(`  ${styleText('dim', `${relFolder}/`)}`)

    for (const name of names) {
      const isUnused = !refs.has(name)
      const fileName = partials[name]?.file
        ? path.basename(partials[name].file)
        : `_${name}.hbs`

      const paddedName = name.padEnd(colWidth)
      const statusBadge = isUnused ? `${styleText('yellow', 'unused')}  ` : '        '
      console.warn(`    ${paddedName}${statusBadge}${styleText('dim', fileName)}`)
    }
  }
  console.warn('')
}

function printFolderPartialsInfo(items, refs, root) {
  if (!items || items.length === 0) {
    return
  }

  console.warn(`${styleText('cyan', '[partials]')} ${styleText('dim', `folders (${items.length})`)}`)
  console.warn(`  ${styleText('dim', 'syntax: {{> folder.<name>}}')}`)
  console.warn('')

  for (const { name, folderPath, count } of items) {
    const shortName = name.replace(/^folder\./, '')
    const isUnused = !refs.has(name)
    const status = isUnused ? ` · ${styleText('yellow', 'unused')}` : ''
    const relFolder = path.relative(root, folderPath).split(path.sep).join('/')

    console.warn(`  ${shortName} (${count} ${count === 1 ? 'partial' : 'partials'}${status})`)
    console.warn(`    ${styleText('dim', `${relFolder}/`)}`)
  }
  console.warn('')
}

function printPluginPartials(pluginPartials, refs) {
  const entries = Object.entries(pluginPartials)
  if (entries.length === 0) {
    return
  }

  const byNamespace = {}
  for (const [name] of entries) {
    const [namespace, key] = name.split('.')
    if (!byNamespace[namespace]) {
      byNamespace[namespace] = []
    }
    byNamespace[namespace].push({ fullName: name, key: key || name })
  }

  console.warn(`${styleText('cyan', '[partials]')} ${styleText('dim', `plugins (${entries.length})`)}`)

  for (const [namespace, list] of Object.entries(byNamespace)) {
    console.warn(`  ${namespace} (${list.length})`)
    console.warn(`    ${styleText('dim', `syntax: {{> ${namespace}.<name>}}`)}`)
    for (const { fullName, key } of list) {
      const isUnused = !refs.has(fullName)
      const status = isUnused ? `  ${styleText('yellow', 'unused')}` : ''
      console.warn(`    ${key}${status}`)
    }
    console.warn('')
  }
}

function printHelpers(customHelpers = {}) {
  const builtInCount = Object.keys(createHelpers()).length
  const customCount = Object.keys(customHelpers).length

  console.warn(styleText('magenta', '[helpers]'))
  console.warn(`  ${builtInCount} built-in · ${customCount} custom`)
  console.warn('')
}

function printDiagnostics({ allDuplicates = [], unused = [], root = process.cwd() }) {
  console.warn(styleText('yellow', '[diagnostics]'))

  if (allDuplicates.length === 0 && unused.length === 0) {
    console.warn('  no conflicts or issues detected')
    console.warn('')
    return
  }

  if (allDuplicates.length > 0) {
    const count = allDuplicates.length
    console.warn(`  warn: ${count} name ${count === 1 ? 'collision' : 'collisions'} detected`)
    for (const item of allDuplicates) {
      const relRegistered = path.relative(root, item.registered).split(path.sep).join('/')
      console.warn(`    ${item.name}`)
      console.warn(`    registered: ${styleText('dim', relRegistered)}`)
      for (const dup of item.duplicates) {
        const relDup = path.relative(root, dup).split(path.sep).join('/')
        console.warn(`    duplicate:  ${styleText('dim', relDup)}`)
      }
    }
    console.warn('')
  }

  if (unused.length > 0) {
    const count = unused.length
    console.warn(`  note: ${count} unused ${count === 1 ? 'partial' : 'partials'} (static analysis may not detect dynamic references)`)
    const maxLen = Math.max(...unused.map(u => u.name.length))
    for (const { name, origin } of unused) {
      const relOrigin = origin.includes(path.sep)
        ? path.relative(root, origin).split(path.sep).join('/')
        : origin
      const pad = ' '.repeat(Math.max(2, maxLen - name.length + 2))
      console.warn(`    - ${name}${pad}${styleText('dim', relOrigin)}`)
    }
    console.warn('')
  }
}

function printSummary({ hamlet, normal, folders, plugins, conflicts, unused }) {
  const total = hamlet + normal + folders + plugins
  console.warn(styleText('dim', '[summary]'))
  console.warn(`  Partials: ${total} total (${hamlet} built-in · ${normal} project · ${folders} folders · ${plugins} plugins)`)
  console.warn(`  Conflicts: ${conflicts} · Unused: ${unused}`)
  console.warn('')
}

export async function printPartialsInfo(options, onProgress) {
  const root = options.cwd || process.cwd()
  const analysis = await analyzePartials(options, onProgress)
  onProgress?.(null)
  const {
    hamletPartials: hamlet,
    normalPartialsByFolder,
    folderPartialsInfo,
    pluginPartials,
    unused,
    duplicates,
    folderDuplicates,
    normalPartials,
    folderPartials,
    refs = new Set(),
  } = analysis

  const allDuplicates = [...duplicates, ...folderDuplicates]
  const hasUserPartials = normalPartials.length > 0 || folderPartials.length > 0 || Object.keys(pluginPartials).length > 0

  printConfig(options)
  printHamletPartials(hamlet, refs)

  if (hasUserPartials) {
    if (normalPartials.length > 0) {
      printNormalPartialsByFolder(normalPartialsByFolder, analysis.partials, refs, root)
    }
    if (folderPartialsInfo.length > 0) {
      printFolderPartialsInfo(folderPartialsInfo, refs, root)
    }
    if (Object.keys(pluginPartials).length > 0) {
      printPluginPartials(pluginPartials, refs)
    }
  }
  else {
    printEmptyProjectPartials()
  }

  printHelpers(options.hamlet?.helpers ?? {})

  printDiagnostics({
    allDuplicates,
    unused,
    root,
  })

  printSummary({
    hamlet: hamlet.length,
    normal: normalPartials.length,
    folders: folderPartials.length,
    plugins: Object.keys(pluginPartials).length,
    conflicts: allDuplicates.length,
    unused: unused.length,
  })
}
