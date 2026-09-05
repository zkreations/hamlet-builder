import { describe, expect, it } from 'vitest'
import { createHamletSkinVars, extractGroupVariables } from '../../../lib/partials/skin-vars.js'

describe('skin variables generator', () => {
  describe('extractGroupVariables', () => {
    it('extracts allowed variable types (background, color, font) grouped by description', () => {
      const xml = `
        <Group description="Theme Colors">
          <Variable name="body.bg" type="background" value="#ffffff"/>
          <Variable name="text.color" type="color" value="#111111"/>
          <Variable name="invalid.type" type="unsupported" value="none"/>
        </Group>
        <Group description="Typography">
          <Variable name="main.font" type="font" value="16px Arial"/>
        </Group>
      `

      const result = extractGroupVariables([xml])

      expect(result['Theme Colors']).toEqual([
        { name: 'body.bg', type: 'background' },
        { name: 'text.color', type: 'color' },
      ])
      expect(result.Typography).toEqual([
        { name: 'main.font', type: 'font' },
      ])
    })

    it('deduplicates variable names within the same group', () => {
      const xml1 = '<Group description="Colors"><Variable name="accent" type="color"/></Group>'
      const xml2 = '<Group description="Colors"><Variable name="accent" type="color"/></Group>'

      const result = extractGroupVariables([xml1, xml2])

      expect(result.Colors.length).toBe(1)
      expect(result.Colors[0].name).toBe('accent')
    })
  })

  describe('createHamletSkinVars', () => {
    it('generates standard CSS variables and double declarations for font types', () => {
      const groupVariables = {
        Palette: [
          { name: 'theme.primary', type: 'color' },
          { name: 'page.bg', type: 'background' },
        ],
        Fonts: [
          { name: 'header.font', type: 'font' },
        ],
      }

      const css = createHamletSkinVars(groupVariables)

      expect(css).toContain('/* Palette Group */')
      expect(css).toContain('--theme-primary: $(theme.primary);')
      expect(css).toContain('--page-bg: $(page.bg);')

      expect(css).toContain('/* Fonts Group */')
      expect(css).toContain('--header-font: $(header.font);')
      expect(css).toContain('--header-font-family: $(header.font.family);')
    })

    it('returns comment when no group variables exist', () => {
      expect(createHamletSkinVars({})).toBe('/* No Group variables found */\n')
      expect(createHamletSkinVars({ Empty: [] })).toBe('/* No Group variables found */\n')
    })
  })
})
