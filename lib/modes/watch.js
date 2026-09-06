import path from 'node:path'
import process from 'node:process'
import chokidar from 'chokidar'
import { compileStyle } from '../compilers/css.js'
import { clearBundleCache, compileJS } from '../compilers/js.js'
import { compileXML } from '../compilers/xml.js'
import { CONFIG_FILES, isConfigFile, loadConfigurations } from '../config.js'
import { logger, measureTime } from '../utils/index.js'

const SCRIPT_EXTENSIONS = new Set(['js', 'mjs', 'cjs'])
const STYLE_EXTENSIONS = new Set(['scss', 'sass', 'css'])
const TEMPLATE_EXTENSIONS = new Set(['xml', 'hbs', 'handlebars'])

export function watchMode(options) {
  const root = options.cwd || process.cwd()
  const relSrc = path.relative(root, options.input)
  logger.watch(`watching for file changes in ${relSrc}/`)

  const context = options.context || {
    paths: {
      root,
      src: options.input ? path.resolve(root, options.input) : path.join(root, 'src'),
      dist: options.output ? path.resolve(root, options.output) : path.join(root, 'dist'),
    },
    utils: {
      resolve: (...args) => path.join(root, ...args),
    },
  }

  let isCompiling = false
  let pendingRerun = false
  let debounceTimeout = null
  const pendingChanges = new Set()
  const DEBOUNCE_DELAY = options.debounceDelay ?? 150

  const processPendingCompilations = async () => {
    if (isCompiling) {
      pendingRerun = true
      return
    }

    isCompiling = true
    const start = performance.now()

    const changesToProcess = Array.from(pendingChanges)
    pendingChanges.clear()

    if (changesToProcess.length === 0) {
      isCompiling = false
      return
    }

    const configChanges = []
    const codeChanges = []

    for (const filePath of changesToProcess) {
      if (isConfigFile(filePath, root)) {
        configChanges.push(filePath)
      }
      else {
        codeChanges.push(filePath)
      }
    }

    const hasConfigChange = configChanges.length > 0
    let requiresScript = false
    let requiresStyle = false
    let requiresTemplate = false

    if (hasConfigChange) {
      const configFileNames = Array.from(new Set(configChanges.map(p => path.basename(p))))
      const triggerDesc = configFileNames.length === 1
        ? `${configFileNames[0]} modified`
        : `${configFileNames.length} files modified (${configFileNames.join(', ')})`

      logger.watch(triggerDesc)
      logger.reload('Configuration changed, reloading...')

      try {
        clearBundleCache()
        const newConfig = await loadConfigurations(context, { fresh: true })
        options.postcss = newConfig.postcss
        options.rollup = newConfig.rollup
        options.hamlet = newConfig.hamlet
        options.theme = newConfig.theme

        requiresScript = true
        requiresStyle = true
        requiresTemplate = true
      }
      catch (error) {
        if (!error._logged) {
          logger.error(error.message || String(error))
        }
        logger.watch('Failed to rebuild. Watching for fixes...')
        isCompiling = false
        return
      }
    }
    else {
      codeChanges.forEach((filePath) => {
        const extension = path.extname(filePath).slice(1).toLowerCase()

        if (SCRIPT_EXTENSIONS.has(extension))
          requiresScript = true
        if (STYLE_EXTENSIONS.has(extension))
          requiresStyle = true
        if (TEMPLATE_EXTENSIONS.has(extension))
          requiresTemplate = true
      })

      const { recompileOnAnyChange } = options.hamlet ?? {}

      if (!requiresScript && !requiresStyle && !requiresTemplate && !recompileOnAnyChange) {
        isCompiling = false
        return
      }

      const fileNames = codeChanges.map(p => path.basename(p))
      const triggerDesc = fileNames.length === 1
        ? `${fileNames[0]} modified`
        : `${fileNames.length} files modified (${fileNames.slice(0, 3).join(', ')}${fileNames.length > 3 ? ` and ${fileNames.length - 3} more` : ''})`

      logger.watch(triggerDesc)
    }

    const { recompileOnAnyChange } = options.hamlet ?? {}

    try {
      logger.resetErrors()
      const assetTasks = []

      if (requiresScript) {
        assetTasks.push(compileJS(options))
      }

      if (requiresStyle || recompileOnAnyChange) {
        assetTasks.push(compileStyle(options))
      }

      if (assetTasks.length > 0) {
        await Promise.all(assetTasks)
      }

      // Recompile XML when templates changed, or when CSS/JS changed
      // (because {{asset}}/{{assetCss}}/{{assetJs}} embed compiled assets into XML)
      if (requiresTemplate || requiresScript || requiresStyle || recompileOnAnyChange) {
        await compileXML(options)
      }

      if (logger.getErrorCount() > 0) {
        logger.watch('Failed to rebuild. Watching for fixes...')
      }
      else {
        logger.watch(`Rebuilt in ${measureTime(performance.now(), start)}`)
        if (hasConfigChange) {
          logger.watch(`watching for file changes in ${relSrc}/`)
        }
      }
    }
    catch (error) {
      if (!error._logged) {
        logger.error(error.message || String(error))
      }
      logger.watch('Failed to rebuild. Watching for fixes...')
    }
    finally {
      isCompiling = false

      if (pendingRerun) {
        pendingRerun = false
        debounceTimeout = setTimeout(processPendingCompilations, DEBOUNCE_DELAY)
      }
    }
  }

  const watchTargets = [
    options.input,
    ...CONFIG_FILES.map(file => path.resolve(root, file)),
    path.resolve(root, '.config'),
  ]

  const watcher = chokidar.watch(watchTargets, {
    ignored: [
      '**/.git/**',
      '**/node_modules/**',
      options.output,
      (filePath) => {
        const basename = path.basename(filePath)
        if (!basename.startsWith('.'))
          return false
        if (basename === '.config')
          return false
        if (isConfigFile(filePath, root))
          return false
        return true
      },
    ],
    ignoreInitial: true,
  })

  watcher.on('all', (event, filePath) => {
    if (event === 'addDir' || event === 'unlinkDir')
      return

    pendingChanges.add(filePath)
    clearTimeout(debounceTimeout)
    debounceTimeout = setTimeout(processPendingCompilations, DEBOUNCE_DELAY)
  })

  return watcher
}
