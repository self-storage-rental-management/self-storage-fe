/** Apply presentation punctuation only. Stored values and request payloads stay unchanged. */
export function displayText(value: string): string {
  return value.replace(/\s*\u003b\s*/g, ', ').replace(/,\s*([.!?])/g, '$1')
}

function childrenText(value: unknown): unknown {
  if (typeof value === 'string') return displayText(value)
  if (Array.isArray(value)) return value.map(childrenText)
  return value
}

export function displayProps(type: unknown, props: unknown): unknown {
  if ((typeof type !== 'string' && type !== Symbol.for('react.fragment')) || !props || typeof props !== 'object') return props
  const source = props as Record<string, unknown>
  const result = { ...source }
  result.children = childrenText(source.children)
  for (const key of ['title', 'placeholder', 'alt', 'aria-label', 'aria-description']) {
    if (typeof source[key] === 'string') result[key] = displayText(source[key])
  }
  return result
}
