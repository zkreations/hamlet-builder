import Handlebars from 'handlebars'
import { describe, expect, it } from 'vitest'
import { createHandlebarsEnvironment } from '../../../lib/templates/registry.js'

describe('handlebars registry environment', () => {
  it('creates an isolated Handlebars instance without polluting global Handlebars', () => {
    const hbs1 = createHandlebarsEnvironment({
      helpers: { customA: () => 'from_env1' },
      partials: { partialA: 'Partial A' },
    })

    const hbs2 = createHandlebarsEnvironment({
      helpers: { customB: () => 'from_env2' },
      partials: { partialB: 'Partial B' },
    })

    expect(hbs1.helpers.customA).toBeDefined()
    expect(hbs1.helpers.customB).toBeUndefined()
    expect(hbs1.partials.partialA).toBeDefined()
    expect(hbs1.partials.partialB).toBeUndefined()

    expect(hbs2.helpers.customB).toBeDefined()
    expect(hbs2.helpers.customA).toBeUndefined()
    expect(hbs2.partials.partialB).toBeDefined()
    expect(hbs2.partials.partialA).toBeUndefined()

    expect(Handlebars.helpers.customA).toBeUndefined()
    expect(Handlebars.helpers.customB).toBeUndefined()
  })

  it('registers Hamlet built-in partials and helpers into the environment', () => {
    const hbs = createHandlebarsEnvironment()
    expect(hbs.helpers.concat).toBeDefined()
    expect(hbs.helpers.eq).toBeDefined()
    expect(hbs.partials['hamlet.functions']).toBeDefined()
    expect(hbs.partials['hamlet.picture']).toBeDefined()
  })

  it('validates syntax and attaches file info when registering broken partial', () => {
    const brokenPartials = {
      broken: 'line 1\n{{#if unclosed}\nline 3',
    }
    Object.defineProperty(brokenPartials, '_partialsInfo', {
      value: {
        broken: { file: 'src/partials/_broken.hbs' },
      },
      enumerable: false,
    })

    expect(() => {
      createHandlebarsEnvironment({ partials: brokenPartials })
    }).toThrowError(/Parse error on line 2/)
  })

  it('tracks execution stack and attaches __renderStack on error', () => {
    const partials = {
      child: 'child start\n{{> missing}}\nchild end',
      parent: 'parent start\n{{> child}}\nparent end',
    }
    Object.defineProperty(partials, '_partialsInfo', {
      value: {
        child: { file: 'src/partials/_child.hbs' },
        parent: { file: 'src/partials/_parent.hbs' },
      },
      enumerable: false,
    })

    const hbs = createHandlebarsEnvironment({ partials })
    const template = hbs.compile('{{> parent}}')

    let caughtError = null
    try {
      template({})
    }
    catch (err) {
      caughtError = err
    }

    expect(caughtError).toBeDefined()
    expect(caughtError.message).toContain('The partial missing could not be found')
    expect(caughtError.__renderStack).toBeDefined()
    expect(caughtError.__renderStack).toHaveLength(2)
    expect(caughtError.__renderStack[0].name).toBe('parent')
    expect(caughtError.__renderStack[0].file).toBe('src/partials/_parent.hbs')
    expect(caughtError.__renderStack[1].name).toBe('child')
    expect(caughtError.__renderStack[1].file).toBe('src/partials/_child.hbs')
    expect(caughtError.__renderStack[1].callSite).toEqual({ line: 2, column: 0 })
  })

  it('tags __activeHelper on error when helper throws', () => {
    const hbs = createHandlebarsEnvironment({
      helpers: {
        failingHelper: () => {
          throw new Error('Helper exploded')
        },
      },
    })

    const template = hbs.compile('hello {{failingHelper}}')
    let caughtError = null
    try {
      template({})
    }
    catch (err) {
      caughtError = err
    }

    expect(caughtError).toBeDefined()
    expect(caughtError.message).toBe('Helper exploded')
    expect(caughtError.__activeHelper).toBe('failingHelper')
  })
})
