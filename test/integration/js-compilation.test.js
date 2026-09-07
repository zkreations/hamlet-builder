import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compileJS } from '../../lib/compilers/js.js'
import { createTempDir } from '../helpers/temp.js'

describe('js compilation pipeline', () => {
  let inDir
  let outDir

  beforeEach(() => {
    inDir = createTempDir('hamlet-js-in-')
    outDir = createTempDir('hamlet-js-out-')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    inDir.cleanup()
    outDir.cleanup()
    vi.restoreAllMocks()
  })

  it('bundles entry file into IIFE unminified and minified js', async () => {
    const jsContent = `
      const message = 'Hello from Hamlet';
      export function greet() {
        return message;
      }
    `
    fs.writeFileSync(path.join(inDir.dir, 'app.bundle.js'), jsContent)

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      minify: true,
      minifyJs: true,
      rollup: { plugins: [] },
    }

    await compileJS(options)

    const unminified = path.join(outDir.dir, 'js', 'app.js')
    const minified = path.join(outDir.dir, 'js', 'app.min.js')

    expect(fs.existsSync(unminified)).toBe(true)
    expect(fs.existsSync(minified)).toBe(true)

    const unminContent = fs.readFileSync(unminified, 'utf8')
    expect(unminContent).toContain('Hello from Hamlet')

    const minContent = fs.readFileSync(minified, 'utf8')
    expect(minContent.length).toBeLessThan(unminContent.length)
  })

  it('ignores files that do not match the *.bundle.@(js|mjs|cjs) pattern', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'helper.js'), 'export const x = 1;')
    fs.writeFileSync(path.join(inDir.dir, 'main.bundle.js'), 'import { x } from "./helper.js"; console.log(x);')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      minify: false,
      minifyJs: false,
    }

    await compileJS(options)

    expect(fs.existsSync(path.join(outDir.dir, 'js', 'helper.js'))).toBe(false)
    expect(fs.existsSync(path.join(outDir.dir, 'js', 'main.js'))).toBe(true)
  })

  it('respects minifyJs false and produces only unminified bundle', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'script.bundle.js'), 'console.log("unminified only");')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      minify: true,
      minifyJs: false,
    }

    await compileJS(options)

    expect(fs.existsSync(path.join(outDir.dir, 'js', 'script.js'))).toBe(true)
    expect(fs.existsSync(path.join(outDir.dir, 'js', 'script.min.js'))).toBe(false)
  })

  it('returns early when input contains no bundle files', async () => {
    const options = {
      input: inDir.dir,
      output: outDir.dir,
    }

    await expect(compileJS(options)).resolves.not.toThrow()
    expect(fs.existsSync(path.join(outDir.dir, 'js'))).toBe(false)
  })

  it('throws error in build mode on invalid JS syntax', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'broken.bundle.js'), 'const broken = ;')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      watch: false,
    }

    await expect(compileJS(options)).rejects.toThrow()
  })

  it('suppresses error in watch mode on invalid JS syntax', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'broken.bundle.js'), 'const broken = ;')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      watch: true,
    }

    await expect(compileJS(options)).resolves.not.toThrow()
  })

  it('generates source map file in development mode', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'dev.bundle.js'), 'export const hello = "world";')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      mode: 'development',
    }

    await compileJS(options)

    const jsFile = path.join(outDir.dir, 'js', 'dev.js')
    const mapFile = path.join(outDir.dir, 'js', 'dev.js.map')

    expect(fs.existsSync(jsFile)).toBe(true)
    expect(fs.existsSync(mapFile)).toBe(true)

    const jsContent = fs.readFileSync(jsFile, 'utf8')
    expect(jsContent).toContain('//# sourceMappingURL=dev.js.map')

    const mapContent = JSON.parse(fs.readFileSync(mapFile, 'utf8'))
    expect(mapContent.version).toBe(3)
    expect(mapContent.sources).toEqual(expect.arrayContaining([expect.stringContaining('dev.bundle.js')]))
  })

  it('does not generate source map in production mode', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'prod.bundle.js'), 'export const hello = "world";')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      mode: 'production',
    }

    await compileJS(options)

    const jsFile = path.join(outDir.dir, 'js', 'prod.js')
    const mapFile = path.join(outDir.dir, 'js', 'prod.js.map')

    expect(fs.existsSync(jsFile)).toBe(true)
    expect(fs.existsSync(mapFile)).toBe(false)
  })

  it('compiles .bundle.ts with TypeScript types and enums into valid IIFE', async () => {
    const tsContent = `
      export enum Direction {
        Up = 'UP',
        Down = 'DOWN',
      }

      interface Config {
        dir: Direction;
        count: number;
      }

      export function move(cfg: Config): string {
        return 'Moved ' + cfg.dir + ' ' + cfg.count;
      }
    `
    fs.writeFileSync(path.join(inDir.dir, 'main.bundle.ts'), tsContent)

    const options = {
      input: inDir.dir,
      output: outDir.dir,
    }

    await compileJS(options)

    const jsFile = path.join(outDir.dir, 'js', 'main.js')
    expect(fs.existsSync(jsFile)).toBe(true)

    const content = fs.readFileSync(jsFile, 'utf8')
    expect(content).toContain('var main = (function')
    expect(content).toContain('UP')
    expect(content).toContain('DOWN')
    expect(content).toContain('Moved ')
    // Type annotations should be stripped
    expect(content).not.toContain(': Config')
  })

  it('compiles .bundle.tsx with JSX syntax into valid IIFE', async () => {
    const tsxContent = `
      export function renderWidget() {
        return <div className="blogger-widget"><span>Active</span></div>;
      }
    `
    fs.writeFileSync(path.join(inDir.dir, 'widget.bundle.tsx'), tsxContent)

    const options = {
      input: inDir.dir,
      output: outDir.dir,
    }

    await compileJS(options)

    const jsFile = path.join(outDir.dir, 'js', 'widget.js')
    expect(fs.existsSync(jsFile)).toBe(true)

    const content = fs.readFileSync(jsFile, 'utf8')
    expect(content).toContain('var widget = (function')
    expect(content).toContain('React.createElement')
    expect(content).toContain('blogger-widget')
  })

  it('generates source map file for .bundle.ts in development mode', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'tsdev.bundle.ts'), 'export const num: number = 42;')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      mode: 'development',
    }

    await compileJS(options)

    const jsFile = path.join(outDir.dir, 'js', 'tsdev.js')
    const mapFile = path.join(outDir.dir, 'js', 'tsdev.js.map')

    expect(fs.existsSync(jsFile)).toBe(true)
    expect(fs.existsSync(mapFile)).toBe(true)

    const jsContent = fs.readFileSync(jsFile, 'utf8')
    expect(jsContent).toContain('//# sourceMappingURL=tsdev.js.map')

    const mapContent = JSON.parse(fs.readFileSync(mapFile, 'utf8'))
    expect(mapContent.version).toBe(3)
    expect(mapContent.sources).toEqual(expect.arrayContaining([expect.stringContaining('tsdev.bundle.ts')]))
  })

  it('supports relative imports between .ts files without extensions or with ts extensions', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'math.ts'), 'export const add = (a: number, b: number): number => a + b;')
    fs.writeFileSync(path.join(inDir.dir, 'calc.bundle.ts'), 'import { add } from "./math"; export const sum = add(2, 3);')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
    }

    await compileJS(options)

    const jsFile = path.join(outDir.dir, 'js', 'calc.js')
    expect(fs.existsSync(jsFile)).toBe(true)

    const content = fs.readFileSync(jsFile, 'utf8')
    expect(content).toContain('var calc = (function')
    expect(content).toContain('add(2, 3)')
  })
})
