import { useCallback, useEffect, useRef, useState } from "react"

// Identity includes actor, scope, resource and query. apiClient owns its AbortSignal;
// discard obsolete responses instead of assuming caller cancellation is honored.
export function useRentalApiResource<T>(
  identity: string,
  load: () => Promise<T>,
) {
  const loader = useRef(load)
  loader.current = load
  const [tick, setTick] = useState(0)
  const [state, setState] = useState<{
    identity: string
    data?: T
    error?: unknown
    loading: boolean
  }>({ identity, loading: true })
  useEffect(() => {
    let current = true
    setState({ identity, loading: true })
    loader.current().then(
      (data) => {
        if (current) setState({ identity, data, loading: false })
      },
      (error) => {
        if (current) setState({ identity, error, loading: false })
      },
    )
    return () => {
      current = false
    }
  }, [identity, tick])
  const refresh = useCallback(() => setTick((value) => value + 1), [])
  return {
    ...(state.identity === identity
      ? state
      : { loading: true, data: undefined, error: undefined }),
    refresh,
  }
}
