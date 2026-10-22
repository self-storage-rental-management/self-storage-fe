import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import type { ApiActor } from '../../services/authApi'
import type { ManagerReportActivity } from '../../services/managerReportingApi'
import { manager } from '../../../tests/rentalApiFixtures'
import { Button, Modal } from '../../components/ui'
import ManagerReportsApiPanel from './ManagerReportsApiPanel'

// Controlled hook lifecycle to exercise the actual detail and close handlers.
const h = vi.hoisted(() => ({ actor: null as ApiActor | null, slots: [] as unknown[], cursor: 0, reads: [] as string[], result: {} as Record<string, unknown> }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = h.cursor++
    if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial
    return [h.slots[index], (next: unknown) => { h.slots[index] = typeof next === 'function' ? next(h.slots[index]) : next }]
  },
}))
vi.mock('../../services/authApi', () => ({ getAuthenticatedActor: () => h.actor }))
vi.mock('../../hooks/useRentalApiResource', () => ({ useRentalApiResource: (identity: string) => {
  h.reads.push(identity)
  return { loading: false, refresh: vi.fn(), ...(identity.includes(':report-activities:') ? h.result : {}) }
} }))

const activity: ManagerReportActivity = {
  id: 'event-1', action: 'RECOVERY_START', actionLabel: 'RECOVERY START', entityType: 'RecoveryTask', entityId: 'task-full-reference-1',
  actorName: 'Demo Manager', actorRole: 'manager@storagehub.demo', facilityId: 'f1', facilityName: 'Cơ sở 1', notes: 'Đã tiếp nhận hồ sơ.',
  beforeStateJson: '{"status":"OPEN"}', afterStateJson: '{"status":"IN_PROGRESS"}', correlationId: 'trace-full-reference-1', timestamp: '2026-10-22T17:08:48Z',
}
const page = (rows: ManagerReportActivity[]) => ({ data: rows, pagination: { page: 0, pageSize: 10, totalItems: rows.length, totalPages: rows.length ? 1 : 0, sort: 'timestamp,desc' } })
function render() { h.cursor = 0; return renderToStaticMarkup(<ManagerReportsApiPanel overview />) }
function nodes(node: unknown): ReactElement<any>[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!node || typeof node !== 'object' || !('type' in node)) return []
  const element = node as ReactElement<any>
  return [element, ...nodes(element.props.children)]
}
function session() {
  const outer = ManagerReportsApiPanel({ overview: true }) as ReactElement<any>
  h.cursor = 0
  return (outer.type as (props: any) => ReactElement<any>)(outer.props)
}
beforeEach(() => {
  h.actor = { ...manager, permissions: [...manager.permissions, 'reports:read'] }
  h.slots = []; h.cursor = 0; h.reads = []
  h.result = { data: page([activity]) }
})

describe('Manager activity journal', () => {
  it('shows readable action and object labels with Vietnam time, keeping trace details off the main table', () => {
    const html = render()
    expect(html).toContain('Bắt đầu xử lý thu hồi')
    expect(html).toContain('Nhiệm vụ thu hồi')
    expect(html).toContain('23/10/2026')
    expect(html).toContain('00:08:48')
    expect(html).toContain(activity.notes)
    expect(html).not.toContain(activity.correlationId)
    expect(html).not.toContain(activity.beforeStateJson)
  })
  it('opens and closes the selected activity with full identifiers and audit data', () => {
    const button = nodes(session()).find(n => n.type === Button && n.props['aria-label'] === 'Chi tiết: Bắt đầu xử lý thu hồi')!
    button.props.onClick()
    let tree = session()
    const modal = nodes(tree).find(n => n.type === Modal)!
    const details = renderToStaticMarkup(<>{modal.props.children}</>)
    expect(details).toContain(activity.entityId)
    expect(details).toContain(activity.correlationId)
    expect(details).toContain('RECOVERY_START')
    expect(details).toContain('OPEN')
    expect(details).toContain('IN_PROGRESS')
    modal.props.onClose()
    tree = session()
    expect(nodes(tree).some(n => n.type === Modal)).toBe(false)
  })
  it.each(['loading', 'error'])('hides stale events and details while %s', state => {
    h.result = { data: page([activity]), ...(state === 'loading' ? { loading: true } : { error: new Error('Offline') }) }
    expect(render()).not.toContain(activity.entityId)
  })
  it('retains unknown action labels and shows an empty state only for an empty successful response', () => {
    h.result = { data: page([{ ...activity, action: 'NEW_ACTION', actionLabel: 'Nghiệp vụ mới' }]) }
    expect(render()).toContain('Nghiệp vụ mới')
    h.result = { data: page([]) }
    expect(render()).toContain('Không có hoạt động phù hợp')
  })
  it('does not read the journal without report permission', () => {
    h.actor = { ...manager, permissions: [] }
    expect(render()).toContain('role="alert"')
    expect(h.reads).toHaveLength(0)
  })
})
