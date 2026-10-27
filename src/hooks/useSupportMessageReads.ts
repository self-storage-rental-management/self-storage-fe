import { useEffect, useRef, type RefObject } from 'react'
import { getAuthenticatedActor } from '../services/authApi'
import { listSupportReadStatus, markSupportMessagesRead, type ReadRole } from '../services/supportReadApi'
import { useRentalApiResource } from './useRentalApiResource'
import type { SupportMessage } from '../types/supportApi'

export function useSupportUnread(role: ReadRole, ids: string[], active = true) {
  const actorId = getAuthenticatedActor()?.id
  const key = [...ids].sort().join(',')
  const read = useRentalApiResource(`${actorId}:unread:${role}:${active}:${key}`, () => active ? listSupportReadStatus(role, key ? key.split(',') : []) : Promise.resolve([]), { retainDataOnRefresh: true })
  useEffect(() => {
    if (!active || !key) return
    const refresh = () => { if (document.visibilityState === 'visible') read.refresh() }
    const timer = window.setInterval(refresh, 5000)
    window.addEventListener('storagehub:support-read', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('storagehub:support-read', refresh) }
  }, [active, key, read.refresh])
  return new Map(read.data?.map(item => [item.ticketId, item]))
}

/** Only acknowledge incoming public messages that actually intersect the focused chat viewport. */
export function useSupportMessageReads(role: 'customer' | 'staff' | 'manager', id: string, messages: SupportMessage[], active: boolean, root: RefObject<HTMLDivElement | null>) {
  const actorId = getAuthenticatedActor()?.id
  const confirmed = useRef(new Set<string>())
  const busy = useRef(false)
  useEffect(() => {
    if (role === 'manager' || !active || !actorId || !root.current) return
    const area = root.current
    const incoming = new Set(messages.filter(m => m.visibility === 'PUBLIC' && m.authorRole !== 'AI_CONTEXT' && m.authorId !== actorId).map(m => m.id))
    const check = () => {
      if (busy.current || document.visibilityState !== 'visible' || !document.hasFocus() || document.querySelector('dialog[open]') || area.closest('[hidden], [inert]') || getAuthenticatedActor()?.id !== actorId) return
      const bounds = area.getBoundingClientRect()
      if (bounds.height <= 0 || bounds.width <= 0) return
      const ids = Array.from(area.querySelectorAll<HTMLElement>('[data-support-message-id]')).filter(node => {
        const rect = node.getBoundingClientRect()
        return rect.bottom > bounds.top && rect.top < bounds.bottom && rect.height > 0
      }).map(node => node.dataset.supportMessageId!).filter(messageId => incoming.has(messageId) && !confirmed.current.has(messageId)).slice(0, 100)
      if (!ids.length) return
      busy.current = true
      void markSupportMessagesRead(role, id, ids).then(() => { ids.forEach(messageId => confirmed.current.add(messageId)) }).catch(() => {}).finally(() => { busy.current = false })
    }
    let timer = window.setTimeout(check, 150)
    const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(check, 150) }
    area.addEventListener('scroll', schedule, { passive: true }); window.addEventListener('focus', schedule); document.addEventListener('visibilitychange', schedule)
    return () => { window.clearTimeout(timer); area.removeEventListener('scroll', schedule); window.removeEventListener('focus', schedule); document.removeEventListener('visibilitychange', schedule) }
  }, [role, id, messages, active, actorId, root])
}
