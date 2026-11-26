export type ProcessingTarget = 'RESERVATION' | 'ASSIGNMENT' | 'CHECK_IN' | 'RENTAL' | 'RETURN'
export interface ProcessingView {
  reservationId: string; ownerId: string | null; ownerName: string | null; expiresAt: string | null
  maxExpiresAt?: string | null
  revision: number; sourceStamp: string; owned: boolean; occupied: boolean
}
export interface LocalProcessingLease {
  target: ProcessingTarget; id: string; token: string; view: ProcessingView; invalid: boolean; inFlight: boolean; ready: boolean
}
const leases = new Map<string, LocalProcessingLease>()
const listeners = new Set<() => void>()
const key = (target: ProcessingTarget, id: string) => target + ':' + id
export const getProcessingLease = (target: ProcessingTarget, id: string) => leases.get(key(target, id))
export function putProcessingLease(lease: LocalProcessingLease) { leases.set(key(lease.target, lease.id), lease); notifyProcessing() }
export function forgetProcessingLease(target: ProcessingTarget, id: string, token: string) {
  if (leases.get(key(target, id))?.token === token) leases.delete(key(target, id))
  notifyProcessing()
}
export function notifyProcessing() { listeners.forEach(listener => listener()) }
export function subscribeProcessing(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function invalidateProcessing(lease: LocalProcessingLease) { lease.invalid = true; notifyProcessing() }
export function processingTarget(path: string, method = 'GET'): { target: ProcessingTarget; id: string } | null {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) return null
  const route = path.split('?')[0]
  let match = route.match(/^\/api\/manager\/unit-assignments\/([0-9a-f-]{36})(?:\/change)?$/i)
  if (match) return { target: 'ASSIGNMENT', id: match[1] }
  match = route.match(/^\/api\/staff\/check-ins\/reservations\/([0-9a-f-]{36})\/schedule$/i)
  if (match) return { target: 'RESERVATION', id: match[1] }
  match = route.match(/^\/api\/staff\/check-ins\/([0-9a-f-]{36})\/(identity-correction|identity-verification|complete|contract-signing|payment-confirmation|setup\/(?:start|complete)|remaining-payment|no-show|reject|inventory-(?:arrival|identity|partial-removal|resolution-at-site|draft(?:\/resolve)?))$/i)
  if (match) return { target: 'CHECK_IN', id: match[1] }
  match = route.match(/^\/api\/(?:staff|manager|business)\/returns\/([0-9a-f-]{36})\/(inspection|complete-refund|settlement-receipts|review-dispute|setup-exit-decision|legacy-pricing-decision)$/i)
  if (match) return { target: 'RETURN', id: match[1] }
  return null
}

export function clearProcessingLeases() { leases.forEach(lease => { lease.invalid = true }); leases.clear(); notifyProcessing() }

const openViews = new Map<string, number>()
export function watchProcessingView(target: ProcessingTarget, id: string) {
  const resource = key(target, id)
  openViews.set(resource, (openViews.get(resource) || 0) + 1)
  return () => { const remaining = (openViews.get(resource) || 1) - 1; if (remaining > 0) openViews.set(resource, remaining); else openViews.delete(resource) }
}
export const isProcessingViewOpen = (target: ProcessingTarget, id: string) => openViews.has(key(target, id))
