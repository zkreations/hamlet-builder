import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { build } from '../../lib/builder.js'
import { watchMode } from '../../lib/modes/watch.js'
import { logger } from '../../lib/utils/logger.js'
import { createTempDir } from '../helpers/temp.js'

async function waitFor(fn, timeout = 4000, interval = 50) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const result = await fn()
      if (result)
        return
    }
    catch {
      // Continue polling
    }
    await new Promise(r => setTimeout(r, interval))
  }
  throw new Error(`Timeout waiting for condition after ${timeout}ms`)
}

describe('watch mode configuration reload', () => {
  let projectDir
  let srcDir
  let distDir
  let activeWatcher
  let reloadSpy
  let watchLogSpy

  beforeEach(() => {
    projectDir = createTempDir('hamlet-watch-proj-')
    srcDir = path.join(projectDir.dir, 'src')
    distDir = path.join(projectDir.dir, 'dist')
    fs.mkdirSync(srcDir, { recursive: true })
    fs.mkdirSync(distDir, { recursive: true })

    reloadSpy = vi.spyOn(logger, 'reload')
    watchLogSpy = vi.spyOn(logger, 'watch')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(async () => {
    if (activeWatcher) {
      await activeWatcher.close()
      activeWatcher = null
    }
    projectDir.cleanup()
    vi.restoreAllMocks()
  })

  it('detects modification of an existing config file and applies new configuration', async () => {
    const configPath = path.join(projectDir.dir, 'theme.config.js')
    fs.writeFileSync(configPath, 'export default { title: "Initial Title" };')

    const templatePath = path.join(srcDir, 'theme.xml')
    fs.writeFileSync(templatePath, '<html><head><title>{{title}}</title></head><body></body></html>')

    const context = {
      paths: { root: projectDir.dir, src: srcDir, dist: distDir },
      utils: { resolve: (...args) => path.join(projectDir.dir, ...args) },
    }

    const options = {
      cwd: projectDir.dir,
      input: srcDir,
      output: distDir,
      context,
      theme: { title: 'Initial Title' },
      hamlet: {},
      debounceDelay: 50,
    }

    await build(options)
    const outputFile = path.join(distDir, 'theme.xml')
    expect(fs.readFileSync(outputFile, 'utf8')).toContain('<title>Initial Title</title>')

    activeWatcher = watchMode(options)

    // Wait for chokidar ready
    await new Promise(r => setTimeout(r, 200))

    // Modify configuration
    fs.writeFileSync(configPath, 'export default { title: "Updated Title" };')

    await waitFor(() => {
      const content = fs.readFileSync(outputFile, 'utf8')
      return content.includes('<title>Updated Title</title>')
    })

    expect(reloadSpy).toHaveBeenCalledWith('Configuration changed, reloading...')
    expect(watchLogSpy).toHaveBeenCalledWith(expect.stringContaining('theme.config.js modified'))
  })

  it('detects creation of a config file during watch mode', async () => {
    const templatePath = path.join(srcDir, 'theme.xml')
    fs.writeFileSync(templatePath, '<html><head><title>{{#if siteName}}{{siteName}}{{else}}Default Site{{/if}}</title></head><body></body></html>')

    const context = {
      paths: { root: projectDir.dir, src: srcDir, dist: distDir },
      utils: { resolve: (...args) => path.join(projectDir.dir, ...args) },
    }

    const options = {
      cwd: projectDir.dir,
      input: srcDir,
      output: distDir,
      context,
      theme: {},
      hamlet: {},
      debounceDelay: 50,
    }

    await build(options)
    const outputFile = path.join(distDir, 'theme.xml')
    expect(fs.readFileSync(outputFile, 'utf8')).toContain('<title>Default Site</title>')

    activeWatcher = watchMode(options)
    await new Promise(r => setTimeout(r, 200))

    // Create new theme.config.js
    const configPath = path.join(projectDir.dir, 'theme.config.js')
    fs.writeFileSync(configPath, 'export default { siteName: "Created Site" };')

    await waitFor(() => {
      const content = fs.readFileSync(outputFile, 'utf8')
      return content.includes('<title>Created Site</title>')
    })

    expect(reloadSpy).toHaveBeenCalledWith('Configuration changed, reloading...')
  })

  it('detects deletion of a config file and falls back to default values', async () => {
    const configPath = path.join(projectDir.dir, 'theme.config.js')
    fs.writeFileSync(configPath, 'export default { brand: "Hamlet Brand" };')

    const templatePath = path.join(srcDir, 'theme.xml')
    fs.writeFileSync(templatePath, '<html><head><title>{{#if brand}}{{brand}}{{else}}Fallback Brand{{/if}}</title></head><body></body></html>')

    const context = {
      paths: { root: projectDir.dir, src: srcDir, dist: distDir },
      utils: { resolve: (...args) => path.join(projectDir.dir, ...args) },
    }

    const options = {
      cwd: projectDir.dir,
      input: srcDir,
      output: distDir,
      context,
      theme: { brand: 'Hamlet Brand' },
      hamlet: {},
      debounceDelay: 50,
    }

    await build(options)
    const outputFile = path.join(distDir, 'theme.xml')
    expect(fs.readFileSync(outputFile, 'utf8')).toContain('<title>Hamlet Brand</title>')

    activeWatcher = watchMode(options)
    await new Promise(r => setTimeout(r, 200))

    // Delete configuration file
    fs.unlinkSync(configPath)

    await waitFor(() => {
      const content = fs.readFileSync(outputFile, 'utf8')
      return content.includes('<title>Fallback Brand</title>')
    })

    expect(reloadSpy).toHaveBeenCalledWith('Configuration changed, reloading...')
  })

  it('keeps normal src/ changes on regular rebuild flow without reloading configs', async () => {
    const templatePath = path.join(srcDir, 'theme.xml')
    fs.writeFileSync(templatePath, '<html><head><title>Original</title></head><body></body></html>')

    const context = {
      paths: { root: projectDir.dir, src: srcDir, dist: distDir },
      utils: { resolve: (...args) => path.join(projectDir.dir, ...args) },
    }

    const options = {
      cwd: projectDir.dir,
      input: srcDir,
      output: distDir,
      context,
      theme: {},
      hamlet: {},
      debounceDelay: 50,
    }

    await build(options)
    const outputFile = path.join(distDir, 'theme.xml')

    activeWatcher = watchMode(options)
    await new Promise(r => setTimeout(r, 200))

    reloadSpy.mockClear()

    // Modify a src file
    fs.writeFileSync(templatePath, '<html><head><title>Modified Source</title></head><body></body></html>')

    await waitFor(() => {
      const content = fs.readFileSync(outputFile, 'utf8')
      return content.includes('<title>Modified Source</title>')
    })

    // reloadSpy should NOT be called for normal code changes
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('debounces rapid changes and avoids duplicate rebuilds', async () => {
    const configPath = path.join(projectDir.dir, 'theme.config.js')
    fs.writeFileSync(configPath, 'export default { counter: 1 };')

    const templatePath = path.join(srcDir, 'theme.xml')
    fs.writeFileSync(templatePath, '<html><head><title>{{counter}}</title></head><body></body></html>')

    const context = {
      paths: { root: projectDir.dir, src: srcDir, dist: distDir },
      utils: { resolve: (...args) => path.join(projectDir.dir, ...args) },
    }

    const options = {
      cwd: projectDir.dir,
      input: srcDir,
      output: distDir,
      context,
      theme: { counter: 1 },
      hamlet: {},
      debounceDelay: 100,
    }

    await build(options)
    const outputFile = path.join(distDir, 'theme.xml')

    activeWatcher = watchMode(options)
    await new Promise(r => setTimeout(r, 200))

    reloadSpy.mockClear()

    // Fire multiple rapid edits
    fs.writeFileSync(configPath, 'export default { counter: 2 };')
    fs.writeFileSync(configPath, 'export default { counter: 3 };')
    fs.writeFileSync(configPath, 'export default { counter: 4 };')

    await waitFor(() => {
      const content = fs.readFileSync(outputFile, 'utf8')
      return content.includes('<title>4</title>')
    })

    // Wait a bit more to ensure no extra rebuild runs
    await new Promise(r => setTimeout(r, 250))

    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })
})
