import { useCallback, useEffect, useRef, useState } from 'react'
import { getAuthenticatedActor } from '../services/authApi'
import { saveCustomerChatSession, type ChatSessionSnapshot, type CustomerChatSession } from '../services/customerChatSessionApi'
import { newSupportAiRequestId } from '../services/supportAiApi'
import { registerChatSessionWriter, trackChatSessionSave } from '../services/chatSessionSaveQueue'

/** Serialize snapshots; keep the same mutation id on a lost response, never overwrite another tab. */
export function useCustomerChatPersistence(actorId: string, initial: CustomerChatSession) {
  const version = useRef(initial.version)
  const saved = useRef(JSON.stringify(initial.snapshot))
  const next = useRef<ChatSessionSnapshot | undefined>(undefined)
  const pending = useRef<{ snapshot: ChatSessionSnapshot; mutationId: string } | undefined>(undefined)
  const busy = useRef(false)
  const [error, setError] = useState<unknown>()
  const inFlight = useRef<Promise<void> | undefined>(undefined)
  const flush = useCallback(() => {
    if (busy.current || getAuthenticatedActor()?.id !== actorId) return inFlight.current ?? Promise.resolve()
    const job = (async () => {
    busy.current = true
    try {
      while (getAuthenticatedActor()?.id === actorId && (pending.current || next.current)) {
        if (!pending.current) {
          const snapshot = next.current!
          next.current = undefined
          if (JSON.stringify(snapshot) === saved.current) continue
          pending.current = { snapshot, mutationId: newSupportAiRequestId() }
        }
        const result = await saveCustomerChatSession(pending.current.snapshot, version.current, pending.current.mutationId)
        version.current = result.version
        saved.current = JSON.stringify(pending.current.snapshot)
        pending.current = undefined
      }
      if (getAuthenticatedActor()?.id === actorId) setError(undefined)
    } catch (failure) {
      if (getAuthenticatedActor()?.id === actorId) setError(failure)
      throw failure
    } finally { busy.current = false }
    })()
    inFlight.current = trackChatSessionSave(actorId, job)
    return job
  }, [actorId])
  useEffect(() => registerChatSessionWriter(actorId, flush), [actorId, flush])
  const save = useCallback((snapshot: ChatSessionSnapshot) => {
    next.current = snapshot
    void flush().catch(() => {})
  }, [flush])
  const retry = useCallback(() => flush().catch(() => {}), [flush])
  return { save, error, retry }
}
