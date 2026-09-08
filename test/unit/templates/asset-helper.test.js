import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHelpers } from '../../../lib/templates/helpers.js'
import * as utils from '../../../lib/utils/index.js'
import { createTempDir } from '../../helpers/temp.js'

vi.mock('../../../lib/utils/index.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getAsset: vi.fn(actual.getAsset),
  }
})

describe('asset helper', () => {
  let tmpDir
  let helpers

  beforeEach(() => {
    tmpDir = createTempDir('hamlet-asset-')
    helpers = createHelpers({ basePath: tmpDir.dir })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    tmpDir.cleanup()
    vi.restoreAllMocks()
  })

  it('reads a valid asset inside basePath', () => {
    const cssPath = path.join(tmpDir.dir, 'style.css')
    fs.writeFileSync(cssPath, '.test { color: red; }')

    const result = helpers.asset('/style.css')
    expect(result.toString()).toBe('.test { color: red; }')
  })

  it('blocks path traversal outside project directory', () => {
    const result = helpers.asset('../secret.txt')
    expect(result.toString()).toBe('/* Access denied: ../secret.txt */')
  })

  it('blocks sibling path traversal starting with project name prefix', () => {
    const siblingFolder = `${tmpDir.dir}-fake`
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
    const dangerousPath = path.join(tmpDir.dir, 'script.sh')
    fs.writeFileSync(dangerousPath, 'echo hello')

    const result = helpers.asset('/script.sh')
    expect(result.toString()).toBe('/* File type not allowed: /script.sh */')
  })

  it('detects circular references', () => {
    const loopFile = path.join(tmpDir.dir, 'loop.html')
    fs.writeFileSync(loopFile, 'initial')

    let circularOutput

    vi.mocked(utils.getAsset).mockImplementationOnce((targetPath) => {
      if (typeof targetPath === 'string' && targetPath.includes('loop.html')) {
        circularOutput = helpers.asset('/loop.html')
        return { content: 'content' }
      }
      return utils.getAsset(targetPath)
    })

    const result = helpers.asset('/loop.html')
    expect(circularOutput.toString()).toBe('/* Circular reference: /loop.html */')
    expect(result.toString()).toBe('content')
  })

  it('handles missing file gracefully with not found comment', () => {
    const result = helpers.asset('/non-existent.css')
    expect(result.toString()).toBe('/* The file "non-existent.css" does not exist */')
  })

  it('re-throws unexpected errors like EACCES', () => {
    const error = new Error('Permission denied')
    error.code = 'EACCES'

    vi.mocked(utils.getAsset).mockImplementationOnce(() => {
      throw error
    })

    expect(() => helpers.asset('/style.css')).toThrow('Permission denied')
  })

  describe('assetCss and assetJs helpers', () => {
    let outDir

    beforeEach(() => {
      outDir = createTempDir('hamlet-out-')
      fs.mkdirSync(path.join(outDir.dir, 'css'), { recursive: true })
      fs.mkdirSync(path.join(outDir.dir, 'js'), { recursive: true })
    })

    afterEach(() => {
      outDir.cleanup()
    })

    it('loads unminified css in development mode', () => {
      fs.writeFileSync(path.join(outDir.dir, 'css', 'main.css'), 'body { dev: true; }')
      fs.writeFileSync(path.join(outDir.dir, 'css', 'main.min.css'), 'body{dev:false}')

      const devHelpers = createHelpers({
        basePath: tmpDir.dir,
        outputPath: outDir.dir,
        isDevelopment: true,
      })

      const res = devHelpers.assetCss('main')
      expect(res.toString()).toBe('body { dev: true; }')

      const resWithExt = devHelpers.assetCss('main.css')
      expect(resWithExt.toString()).toBe('body { dev: true; }')
    })

    it('loads minified css in production mode', () => {
      fs.writeFileSync(path.join(outDir.dir, 'css', 'main.css'), 'body { dev: true; }')
      fs.writeFileSync(path.join(outDir.dir, 'css', 'main.min.css'), 'body{dev:false}')

      const prodHelpers = createHelpers({
        basePath: tmpDir.dir,
        outputPath: outDir.dir,
        isDevelopment: false,
      })

      const res = prodHelpers.assetCss('main')
      expect(res.toString()).toBe('body{dev:false}')
    })

    it('loads unminified js in development mode', () => {
      fs.writeFileSync(path.join(outDir.dir, 'js', 'bundle.js'), 'console.log("dev");')
      fs.writeFileSync(path.join(outDir.dir, 'js', 'bundle.min.js'), 'console.log("prod")')

      const devHelpers = createHelpers({
        basePath: tmpDir.dir,
        outputPath: outDir.dir,
        isDevelopment: true,
      })

      const res = devHelpers.assetJs('bundle')
      expect(res.toString()).toBe('console.log("dev");')

      const resWithExt = devHelpers.assetJs('bundle.js')
      expect(resWithExt.toString()).toBe('console.log("dev");')
    })

    it('loads minified js in production mode', () => {
      fs.writeFileSync(path.join(outDir.dir, 'js', 'bundle.js'), 'console.log("dev");')
      fs.writeFileSync(path.join(outDir.dir, 'js', 'bundle.min.js'), 'console.log("prod")')

      const prodHelpers = createHelpers({
        basePath: tmpDir.dir,
        outputPath: outDir.dir,
        isDevelopment: false,
      })

      const res = prodHelpers.assetJs('bundle')
      expect(res.toString()).toBe('console.log("prod")')
    })

    it('warns and returns fallback comment when output path is missing', () => {
      const emptyHelpers = createHelpers({ basePath: tmpDir.dir })
      const resCss = emptyHelpers.assetCss('main')
      expect(resCss.toString()).toContain('Output path not configured')

      const resJs = emptyHelpers.assetJs('main')
      expect(resJs.toString()).toContain('Output path not configured')
    })
  })
})
