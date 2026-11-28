import { useRef } from 'react'

/** Keep the identity of JSON API data stable across equivalent refreshes. */
export function useStableJsonValue<T>(value: T): T {
  const json = JSON.stringify(value)
  const previous = useRef({ json, value })
  if (previous.current.json !== json) previous.current = { json, value }
  return previous.current.value
}
