const GROUP_RE = /<Group\s+description="([^"]+)">([\s\S]*?)<\/Group>/g
const VARIABLE_RE = /<Variable\s([^>]*)>/g
const ATTR_RE = /(name|type)="([^"]+)"/g
const ALLOWED_TYPES = new Set(['background', 'color', 'font'])

export function extractGroupVariables(contents) {
  const parseAttrs = (str = '') => {
    const attrs = {}
    ATTR_RE.lastIndex = 0
    let match = ATTR_RE.exec(str)

    while (match !== null) {
      attrs[match[1]] = match[2]
      match = ATTR_RE.exec(str)
    }

    return attrs
  }

  const parseVariables = (groupContent) => {
    const variables = []
    VARIABLE_RE.lastIndex = 0
    let match = VARIABLE_RE.exec(groupContent)

    while (match !== null) {
      const { name, type } = parseAttrs(match[1])

      if (name && ALLOWED_TYPES.has(type))
        variables.push({ name, type })

      match = VARIABLE_RE.exec(groupContent)
    }

    return variables
  }

  const variablesByGroup = {}

  for (const content of contents) {
    GROUP_RE.lastIndex = 0
    let groupMatch = GROUP_RE.exec(content)

    while (groupMatch !== null) {
      const [, description, groupContent] = groupMatch

      const existingVariables = (variablesByGroup[description] ??= [])
      const existingNames = new Set(existingVariables.map(variable => variable.name))

      for (const variable of parseVariables(groupContent)) {
        if (!existingNames.has(variable.name)) {
          existingVariables.push(variable)
          existingNames.add(variable.name)
        }
      }

      groupMatch = GROUP_RE.exec(content)
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
