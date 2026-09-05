import { describe, expect, it } from 'vitest'
import { loadPlugins } from '../../../lib/plugins/loader.js'

describe('plugin loader', () => {
  it('loads valid plugins, prefixes partials and helpers with namespace', async () => {
    const mockPlugin = {
      namespace: 'custom',
      partials: {
        card: '<div class="card">{{content}}</div>',
      },
      helpers: {
        format: val => `[${val}]`,
      },
      context: {
        version: '1.0.0',
      },
    }

    const result = await loadPlugins([mockPlugin])

    expect(result.partials['custom.card']).toBe('<div class="card">{{content}}</div>\n')
    expect(typeof result.helpers.customFormat).toBe('function')
    expect(result.helpers.customFormat('test')).toBe('[test]')
    expect(result.contexts.custom).toEqual({ version: '1.0.0' })
    expect(Object.isFrozen(result.contexts.custom)).toBe(true)
  })

  it('handles async plugin factories', async () => {
    const asyncPlugin = Promise.resolve({
      namespace: 'asyncPlug',
      partials: {
        badge: '<span>badge</span>',
      },
    })

    const result = await loadPlugins([asyncPlugin])
    expect(result.partials['asyncPlug.badge']).toBe('<span>badge</span>\n')
  })

  it('skips falsy plugin entries without errors', async () => {
    const result = await loadPlugins([null, false, undefined])
    expect(result.partials).toEqual({})
    expect(result.helpers).toEqual({})
  })

  it('skips duplicate namespaces', async () => {
    const plugins = [
      {
        namespace: 'duplicateNs',
        partials: { a: 'first' },
      },
      {
        namespace: 'duplicateNs',
        partials: { a: 'second' },
      },
    ]

    const result = await loadPlugins(plugins)
    expect(result.partials['duplicateNs.a']).toBe('first\n')
  })

  it('handles failing plugin promises gracefully without breaking remaining plugins', async () => {
    const failingPlugin = Promise.reject(new Error('Network load error'))
    const goodPlugin = {
      namespace: 'good',
      partials: { item: '<div>item</div>' },
    }

    const result = await loadPlugins([failingPlugin, goodPlugin])
    expect(result.partials['good.item']).toBe('<div>item</div>\n')
  })

  it('skips invalid plugin shapes and reserved helper name collisions', async () => {
    const invalidShapePlugin = 'not-a-plugin-object'
    const collidingPlugin = {
      namespace: 'core',
      helpers: {
        existingHelper: () => 'override',
      },
    }

    const existing = {
      helpers: {
        coreExistingHelper: () => 'original',
      },
    }

    const result = await loadPlugins([invalidShapePlugin, collidingPlugin], existing)
    expect(result.helpers.coreExistingHelper).toBeUndefined()
  })
})
