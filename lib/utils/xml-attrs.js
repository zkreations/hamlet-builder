const regexCache = new Map()

export function regExpAttr(attr) {
  let regExp = regexCache.get(attr)
  if (!regExp) {
    regExp = new RegExp(`${attr}=['"](.*?)['"]`, 'g')
    regexCache.set(attr, regExp)
  }
  return new RegExp(regExp.source, regExp.flags)
}

export function getAttr(string, attr) {
  const REG_EXP = regExpAttr(attr)
  const match = string.match(REG_EXP)
  return match ? match[0] : null
}

export function removeAttr(string, attr) {
  const REG_EXP = regExpAttr(attr)
  return string.replace(REG_EXP, '')
}

export function getAttrValue(string, attr) {
  const REG_EXP = regExpAttr(attr)
  const matches = Array.from(string.matchAll(REG_EXP), match => match[1])
  return matches.length > 0 ? matches[0] : null
}

export function replaceAttrValue(string, attr, value) {
  const REG_EXP = regExpAttr(attr)
  return string.replace(REG_EXP, `${attr}='${value}'`)
}
