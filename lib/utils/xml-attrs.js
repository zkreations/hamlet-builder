export function regExpAttr(attr) {
  return new RegExp(`${attr}=['"](.*?)['"]`, 'g')
}

export function getAttr(string, attr) {
  const match = string.match(regExpAttr(attr))
  return match ? match[0] : null
}

export function getAttrValue(string, attr) {
  const match = string.match(new RegExp(`${attr}=['"](.*?)['"]`))
  return match ? match[1] : null
}

export function replaceAttrValue(string, attr, value) {
  return string.replace(regExpAttr(attr), `${attr}='${value}'`)
}
