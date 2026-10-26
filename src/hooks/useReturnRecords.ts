import { useCallback, useEffect, useRef, useState } from 'react'
import { getAuthenticatedActor } from '../services/authApi'
import { listReturns, returnError, type ApiReturn, type ReturnRole } from '../services/returnApi'

/** Supplies existing list screens without substituting demo data on API failure. */
export function useReturnRecords(role: ReturnRole, enabled: boolean) {
  const actor = getAuthenticatedActor()
  const identity = JSON.stringify([actor?.id, actor?.roles, actor?.permissions, actor?.facilityScopes, role, enabled])
  const generation = useRef(0)
  const [state, setState] = useState<{ identity: string; rows: ApiReturn[]; loading: boolean; error: string | null }>({ identity, rows: [], loading: enabled, error: null })
  const refresh = useCallback(async () => {
    const version = ++generation.current
    if (!enabled) return
    setState(previous => ({ identity, rows: previous.identity === identity ? previous.rows : [], loading: true, error: null }))
    try {
      const first = await listReturns(role, 0, 100)
      const remaining = await Promise.all(Array.from({ length: Math.max(0, first.pagination.totalPages - 1) }, (_, index) => listReturns(role, index + 1, 100)))
      if (generation.current !== version) return
      const records = [...first.data, ...remaining.flatMap(page => page.data)]
      const unique = new Map(records.map(record => [record.id, record]))
      setState({ identity, rows: [...unique.values()], loading: false, error: null })
    } catch (error) {
      if (generation.current === version) setState({ identity, rows: [], loading: false, error: returnError(error) })
    }
  }, [identity, enabled, role])
  useEffect(() => {
    void refresh()
    return () => { generation.current++ }
  }, [refresh])
  return { identity, rows: state.identity === identity ? state.rows : [], loading: enabled && (state.identity !== identity || state.loading), error: state.identity === identity ? state.error : null, refresh }
}
