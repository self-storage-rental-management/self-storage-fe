import { useCallback, useState } from 'react'

const readHiddenIds = (storageKey: string): string[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
    return Array.isArray(stored)
      ? stored.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

export default function useManagerSoftDelete(storageKey: string) {
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => readHiddenIds(storageKey))

  const persist = useCallback((ids: string[]) => {
    setHiddenIds(ids)
    try {
      if (ids.length) window.localStorage.setItem(storageKey, JSON.stringify(ids))
      else window.localStorage.removeItem(storageKey)
      return true
    } catch {
      return false
    }
  }, [storageKey])

  const hide = useCallback((id: string) => {
    return persist(Array.from(new Set([...hiddenIds, id])))
  }, [hiddenIds, persist])

  const restoreAll = useCallback(() => persist([]), [persist])
  const isHidden = useCallback((id: string) => hiddenIds.includes(id), [hiddenIds])

  return { hiddenIds, hide, restoreAll, isHidden }
}
