// Transport promises only; chat content remains in component state and the authenticated API.
const saves = new Map<string, Set<Promise<void>>>()
const writers = new Map<string, Set<() => Promise<void>>>()

export function registerChatSessionWriter(actorId: string, flush: () => Promise<void>) {
  const registered = writers.get(actorId) ?? new Set<() => Promise<void>>()
  writers.set(actorId, registered)
  registered.add(flush)
  return () => { registered.delete(flush); if (!registered.size) writers.delete(actorId) }
}
export function trackChatSessionSave(actorId: string, job: Promise<void>) {
  const pending = saves.get(actorId) ?? new Set<Promise<void>>()
  saves.set(actorId, pending)
  pending.add(job)
  const cleanup = () => { pending.delete(job); if (!pending.size) saves.delete(actorId) }
  void job.then(cleanup, cleanup)
  return job
}
export async function waitForChatSessionSaves(actorId?: string) {
  if (!actorId) return
  while (saves.get(actorId)?.size) await Promise.allSettled([...saves.get(actorId)!])
  // Retry failed/queued snapshots too, not just requests that are still running.
  await Promise.all([...(writers.get(actorId) ?? [])].map(flush => flush()))
  while (saves.get(actorId)?.size) await Promise.all([...saves.get(actorId)!])
}
