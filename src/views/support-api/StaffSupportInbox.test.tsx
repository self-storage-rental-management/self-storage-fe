import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import StaffSupportInbox from './StaffSupportInbox'
import ApiPager from '../rental-api/ApiPager'
import { supportActor, supportActive, supportIds, supportPage } from '../../../tests/supportApiFixtures'

const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, data: undefined as any, resources: [] as any[], refresh: vi.fn(), list: vi.fn(), unread: vi.fn() }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState: (initial: any) => { const index = h.cursor++; if (!(index in h.slots)) h.slots[index] = initial; return [h.slots[index], (value: any) => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value }] },
  useRef: (initial: any) => h.slots[h.cursor++] ??= { current: initial },
  useEffect: () => {},
}))
vi.mock('../../hooks/useRentalApiResource', () => ({ useRentalApiResource: (key: string, load: () => Promise<any>) => { h.resources.push({ key, load }); return { data: h.data, loading: false, refresh: h.refresh } } }))
vi.mock('../../hooks/useSupportMessageReads', () => ({ useSupportUnread: (...args: any[]) => { h.unread(...args); return new Map() } }))
vi.mock('../../services/authApi', () => ({ getAuthenticatedActor: () => supportActor('staff') }))
vi.mock('../../services/supportApi', () => ({ listStaffSupportInbox: (...args: any[]) => h.list(...args) }))

function nodes(node: any): ReactElement<any>[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!node || typeof node !== 'object' || !node.props) return []
  return [node, ...nodes(node.props.children)]
}
function session(extra: object = {}) {
  const props = { locked: false, onOpen: vi.fn(), onClaim: vi.fn().mockResolvedValue(true), ...extra }
  return { props, render: () => { h.cursor = 0; h.resources = []; return StaffSupportInbox(props) } }
}
const findButton = (tree: any, label: string) => nodes(tree).find(node => node.type === 'button' && (node.props.title === label || node.props['aria-label'] === label))!
beforeEach(() => {
  h.slots = []; h.resources = []; h.refresh.mockReset(); h.list.mockReset(); h.unread.mockReset()
  h.data = { ...supportPage([{ ticket: { ...supportActive, customerName: 'Khách A' }, queued: null, historyCount: 12, lastActivityAt: supportActive.createdAt }]), counts: { queue: 0, mine: 1, all: 1, history: 1 } }
})

describe('Grouped Staff inbox', () => {
  it('renders one Customer row without history layers and opens the assigned chat', () => {
    const { render, props } = session()
    const tree = render()
    expect(nodes(tree).filter(node => node.type === 'p' && node.props.children === 'Khách A')).toHaveLength(1)
    expect(findButton(tree, 'Lịch sử hội thoại của Khách A')).toBeUndefined()
    findButton(tree, 'Mở cuộc trò chuyện').props.onClick()
    expect(props.onOpen).toHaveBeenCalledExactlyOnceWith(supportIds.ticket)
    expect(h.unread).toHaveBeenCalledWith('staff', [supportIds.ticket])
    expect(nodes(tree).filter(node => node.type === ApiPager)).toHaveLength(0)
  })
  it('exposes only waiting and active-support tabs without history layers', async () => {
    const { render } = session()
    const tree = render()
    expect(findButton(tree, 'Hội thoại đã xử lý')).toBeUndefined()
    const tabs = nodes(tree).filter(node => node.type === 'button' && node.props['aria-pressed'] !== undefined)
    expect(tabs).toHaveLength(2)
    expect(tabs.map(node => node.props.children[0])).toEqual(['Chờ nhận', 'Đang hỗ trợ'])
    tabs[0].props.onClick()
    render()
    await h.resources[0].load()
    expect(h.list).toHaveBeenLastCalledWith('queue', 0)
  })
  it('uses one pager for all grouped rows and resets it when changing tabs', async () => {
    h.data.pagination = { ...h.data.pagination, totalItems: 21, totalPages: 2 }
    const { render } = session()
    let tree = render()
    const pagers = nodes(tree).filter(node => node.type === ApiPager)
    expect(pagers).toHaveLength(1)
    pagers[0].props.onPage(1)
    tree = render(); await h.resources[0].load()
    expect(h.list).toHaveBeenLastCalledWith('mine', 1)
    nodes(tree).find(node => node.type === 'button' && node.props.children[0] === 'Chờ nhận')!.props.onClick()
    render(); await h.resources[0].load()
    expect(h.list).toHaveBeenLastCalledWith('queue', 0)
  })
  it('requires claiming queued chat before it can be opened', async () => {
    const queued = { id: supportIds.ticket, facilityId: supportIds.facility, subject: 'Help', createdAt: supportActive.createdAt, version: 0 }
    h.data.data = [{ ticket: null, queued, historyCount: 0, lastActivityAt: queued.createdAt }]
    const { render, props } = session()
    const tree = render()
    expect(findButton(tree, 'Nhận trò chuyện trước khi mở và gửi tin nhắn').props.disabled).toBe(true)
    await nodes(tree).find(node => node.type === 'button' && node.props.children === 'Nhận xử lý')!.props.onClick()
    expect(props.onClaim).toHaveBeenCalledExactlyOnceWith(queued)
    expect(props.onOpen).not.toHaveBeenCalled()
  })
  it('does not leave a previous Customer highlighted when another chat is opened externally', () => {
    const other = { ...supportActive, id: supportIds.foreign, customerId: supportIds.foreign, customerName: 'Khách B' }
    h.data.data.push({ ticket: other, queued: null, historyCount: 0, lastActivityAt: other.createdAt })
    const { render, props } = session({ selectedId: supportIds.ticket })
    nodes(render()).find(node => node.type === 'button' && node.props.title === 'Mở cuộc trò chuyện')!.props.onClick()
    Object.assign(props, { selectedId: supportIds.foreign })
    const selected = nodes(render()).filter(node => node.props['aria-current'] === 'true')
    expect(selected).toHaveLength(1)
    expect(nodes(selected[0]).some(node => node.type === 'p' && node.props.children === 'Khách B')).toBe(true)
  })
})
