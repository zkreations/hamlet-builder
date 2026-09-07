const GROUP_RE = /<Group\s+description="([^"]+)">([\s\S]*?)<\/Group>/g
const VARIABLE_RE = /<Variable\s([^>]*)>/g
const ATTR_RE = /(name|type)="([^"]+)"/g
const ALLOWED_TYPES = new Set(['background', 'color', 'font'])

export function extractGroupVariables(contents) {
  const parseAttrs = (str = '') => {
    const attrs = {}
    for (const match of str.matchAll(ATTR_RE)) {
      attrs[match[1]] = match[2]
    }
    return attrs
  }

  const parseVariables = (groupContent) => {
    const variables = []
    for (const match of groupContent.matchAll(VARIABLE_RE)) {
      const { name, type } = parseAttrs(match[1])

      if (name && ALLOWED_TYPES.has(type))
        variables.push({ name, type })
    }
    return variables
  }

  const variablesByGroup = {}

  for (const content of contents) {
    for (const [, description, groupContent] of content.matchAll(GROUP_RE)) {
      const existingVariables = (variablesByGroup[description] ??= [])
      const existingNames = new Set(existingVariables.map(variable => variable.name))

      for (const variable of parseVariables(groupContent)) {
        if (!existingNames.has(variable.name)) {
          existingVariables.push(variable)
          existingNames.add(variable.name)
        }
      }
    }
  }

  return variablesByGroup
}

export function createHamletSkinVars(groupVariables) {
  const toKebab = name => name.replaceAll('.', '-')
  const toRef = name => `$(${name})`

  const lines = Object.entries(groupVariables).flatMap(([groupName, variables]) => {
    if (!variables.length)
      return []

    const declarations = variables.flatMap(({ name, type }) => {
      const prop = `--${toKebab(name)}: ${toRef(name)};`
      return type === 'font'
        ? [prop, `--${toKebab(name)}-family: ${toRef(`${name}.family`)};`]
        : [prop]
    })

    return [`/* ${groupName} Group */`, ...declarations, '']
  })

  if (lines.length === 0)
    return '/* No Group variables found */\n'

  return lines.join('\n')
}
