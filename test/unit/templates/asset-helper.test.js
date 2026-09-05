import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHelpers } from '../../../lib/templates/helpers.js'

describe('asset helper', () => {
  let tmpDir
  let helpers

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamlet-asset-'))
    helpers = createHelpers({ basePath: tmpDir })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('reads a valid asset inside basePath', () => {
    const cssPath = path.join(tmpDir, 'style.css')
    fs.writeFileSync(cssPath, '.test { color: red; }')

    const result = helpers.asset('/style.css')
    expect(result.toString()).toBe('.test { color: red; }')
  })

  it('blocks path traversal outside project directory', () => {
    const result = helpers.asset('../secret.txt')
    expect(result.toString()).toBe('/* Access denied: ../secret.txt */')
  })

  it('blocks sibling path traversal starting with project name prefix', () => {
    const siblingFolder = `${tmpDir}-fake`
    fs.mkdirSync(siblingFolder, { recursive: true })
    fs.writeFileSync(path.join(siblingFolder, 'style.css'), '.fake {}')

    try {
      const result = helpers.asset(`../${path.basename(siblingFolder)}/style.css`)
      expect(result.toString()).toContain('Access denied')
    }
    finally {
      fs.rmSync(siblingFolder, { recursive: true, force: true })
    }
  })

  it('blocks non-whitelisted file extensions', () => {
    const dangerousPath = path.join(tmpDir, 'script.sh')
    fs.writeFileSync(dangerousPath, 'echo hello')

    const result = helpers.asset('/script.sh')
    expect(result.toString()).toBe('/* File type not allowed: /script.sh */')
  })

  it('detects circular references', () => {
    const loopFile = path.join(tmpDir, 'loop.html')
    fs.writeFileSync(loopFile, 'initial')

    // To test circular detection, create a helper that re-enters asset() during asset reading
    let circularOutput
    const originalGetAsset = fs.readFileSync

    const spy = vi.spyOn(fs, 'readFileSync').mockImplementation((targetPath, encoding) => {
      if (typeof targetPath === 'string' && targetPath.includes('loop.html')) {
        // While loop.html is being processed (and is in activeAssets), trigger re-entrant call:
        circularOutput = helpers.asset('/loop.html')
        return 'content'
      }
      return originalGetAsset(targetPath, encoding)
    })

    try {
      const result = helpers.asset('/loop.html')
      expect(circularOutput.toString()).toBe('/* Circular reference: /loop.html */')
      expect(result.toString()).toBe('content')
    }
    finally {
      spy.mockRestore()
    }
  })

  it('handles missing file gracefully with not found comment', () => {
    const result = helpers.asset('/non-existent.css')
    expect(result.toString()).toBe('/* The file "non-existent.css" does not exist */')
  })

  it('re-throws unexpected errors like EACCES', () => {
    const error = new Error('Permission denied')
    error.code = 'EACCES'
    const spy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw error
    })

    try {
      expect(() => helpers.asset('/style.css')).toThrow('Permission denied')
    }
    finally {
      spy.mockRestore()
    }
  })

  describe('assetCss and assetJs helpers', () => {
    let outDir

    beforeEach(() => {
      outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamlet-out-'))
      fs.mkdirSync(path.join(outDir, 'css'), { recursive: true })
      fs.mkdirSync(path.join(outDir, 'js'), { recursive: true })
    })

    afterEach(() => {
      fs.rmSync(outDir, { recursive: true, force: true })
    })

    it('loads unminified css in development mode', () => {
      fs.writeFileSync(path.join(outDir, 'css', 'main.css'), 'body { dev: true; }')
      fs.writeFileSync(path.join(outDir, 'css', 'main.min.css'), 'body{dev:false}')

      const devHelpers = createHelpers({
        basePath: tmpDir,
        outputPath: outDir,
        isDevelopment: true,
      })

      const res = devHelpers.assetCss('main')
      expect(res.toString()).toBe('body { dev: true; }')

      const resWithExt = devHelpers.assetCss('main.css')
      expect(resWithExt.toString()).toBe('body { dev: true; }')
    })

    it('loads minified css in production mode', () => {
      fs.writeFileSync(path.join(outDir, 'css', 'main.css'), 'body { dev: true; }')
      fs.writeFileSync(path.join(outDir, 'css', 'main.min.css'), 'body{dev:false}')

      const prodHelpers = createHelpers({
        basePath: tmpDir,
        outputPath: outDir,
        isDevelopment: false,
      })

      const res = prodHelpers.assetCss('main')
      expect(res.toString()).toBe('body{dev:false}')
    })

    it('loads unminified js in development mode', () => {
      fs.writeFileSync(path.join(outDir, 'js', 'bundle.js'), 'console.log("dev");')
      fs.writeFileSync(path.join(outDir, 'js', 'bundle.min.js'), 'console.log("prod")')

      const devHelpers = createHelpers({
        basePath: tmpDir,
        outputPath: outDir,
        isDevelopment: true,
      })

      const res = devHelpers.assetJs('bundle')
      expect(res.toString()).toBe('console.log("dev");')

      const resWithExt = devHelpers.assetJs('bundle.js')
      expect(resWithExt.toString()).toBe('console.log("dev");')
    })

    it('loads minified js in production mode', () => {
      fs.writeFileSync(path.join(outDir, 'js', 'bundle.js'), 'console.log("dev");')
      fs.writeFileSync(path.join(outDir, 'js', 'bundle.min.js'), 'console.log("prod")')

      const prodHelpers = createHelpers({
        basePath: tmpDir,
        outputPath: outDir,
        isDevelopment: false,
      })

      const res = prodHelpers.assetJs('bundle')
      expect(res.toString()).toBe('console.log("prod")')
    })

    it('warns and returns fallback comment when output path is missing', () => {
      const emptyHelpers = createHelpers({ basePath: tmpDir })
      const resCss = emptyHelpers.assetCss('main')
      expect(resCss.toString()).toContain('Output path not configured')

      const resJs = emptyHelpers.assetJs('main')
      expect(resJs.toString()).toContain('Output path not configured')
    })
  })
})
