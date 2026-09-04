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
})
