import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { Button } from '../../components/ui'
import { supportActor, supportActive, supportIds, supportPage, supportTicket } from '../../../tests/supportApiFixtures'
import SupportApiWorkspace from './SupportApiWorkspace'
import SupportCreateForm from './SupportCreateForm'
import SupportTicketDetail from './SupportTicketDetail'
import StaffSupportInbox from './StaffSupportInbox'
import ApiPager from '../rental-api/ApiPager'
import { EvidenceUpload } from '../rental-support-integration/EvidenceControls'

// Exercise component handlers with isolated API fixtures; no records are written to the app DB.
const h = vi.hoisted(() => ({
  slots: [] as any[], cursor: 0, effects: [] as (() => void | (() => void))[],
  layouts: [] as (() => void)[],
  resources: [] as { key: string; load: () => Promise<any>; options: any }[],
  role: 'customer' as 'customer' | 'staff' | 'manager',
  command: {} as any, onSuccess: undefined as any, messages: undefined as any,
  refresh: vi.fn(), run: vi.fn(), listMessages: vi.fn(),
}))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState: (initial: any) => {
    const slots = h.slots, index = h.cursor++
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
    return [slots[index], (next: any) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
  },
  useRef: (initial: any) => { const index = h.cursor++; return h.slots[index] ??= { current: initial } },
  useEffect: (effect: () => void) => { h.effects.push(effect) },
  useLayoutEffect: (effect: () => void) => { h.layouts.push(effect) },
}))
vi.mock('../../services/authApi', () => ({ getAuthenticatedActor: () => supportActor(h.role) }))
vi.mock('../manager/managerPresentation', () => ({ useManagerPresentation: () => ({ manager: false, copy: (text: string) => text, errorText: () => 'Lỗi kiểm thử' }) }))
vi.mock('../../services/supportApi', async original => ({ ...await original<typeof import('../../services/supportApi')>(), listSupportMessages: (...args: any[]) => h.listMessages(...args) }))
vi.mock('../../hooks/useSupportCommand', () => ({ useSupportCommand: (_scope: string, success: unknown) => { h.onSuccess = success; return h.command } }))
vi.mock('../../hooks/useRentalApiResource', () => ({ useRentalApiResource: (key: string, load: () => Promise<any>, options: unknown) => {
  h.resources.push({ key, load, options })
  const data = key.includes(':support-create:') ? supportPage([{ id: supportIds.facility, facilityId: supportIds.facility, label: 'Cơ sở của tôi' }])
    : /:(messages|internal):-?\d+$/.test(key) ? h.messages
    : key.includes(':queue:') ? supportPage([])
    : key.includes('{"page"') ? supportPage([{ ...supportTicket, customerName: 'Khách hàng thử nghiệm' }])
    : supportActive
  return { data, loading: false, refresh: h.refresh }
} }))
type Element = ReactElement<any>
function render(fn: () => any, slots: any[] = []) {
  h.slots = slots; h.cursor = 0; h.effects = []; h.layouts = []; h.resources = []
  return fn()
}
function invoke(element: Element, slots: any[] = []) { return render(() => (element.type as any)(element.props), slots) }
function nodes(node: any): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!node || typeof node !== 'object' || !('type' in node)) return []
  return [node, ...nodes(node.props.children)]
}
const find = (tree: any, type: any) => nodes(tree).find(n => n.type === type)!
const button = (tree: any, label: string) => nodes(tree).find(n => n.type === Button && n.props.children === label)!
function createScrollArea() {
  let top = 0
  return {
    scrollHeight: 1200, clientHeight: 300,
    get scrollTop() { return top },
    set scrollTop(value: number) { top = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight)) },
  }
}
function workspace() {
  const root = SupportApiWorkspace({ role: h.role }) as Element
  const slots: any[] = []
  return () => invoke(root, slots)
}
beforeEach(() => {
  h.role = 'customer'; h.slots = []; h.cursor = 0; h.resources = []; h.effects = []
  h.run.mockReset().mockResolvedValue(true); h.refresh.mockReset(); h.listMessages.mockReset()
  h.command = { run: h.run, locked: false, busy: false, uncertain: false, conflict: false, clearError: vi.fn(), retry: vi.fn() }
  h.messages = supportPage([])
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('Support chat workspace', () => {
  it('refreshes a sent Staff message without remounting the open conversation', () => {
    h.role = 'staff'
    const session = workspace()
    find(session(), StaffSupportInbox).props.onOpen(supportIds.ticket)
    const before = find(session(), SupportTicketDetail)
    h.onSuccess({ kind: 'command', role: 'staff', id: supportIds.ticket, command: { kind: 'message', body: 'Đã nhận được tệp.' } }, { id: supportIds.message })
    const after = find(session(), SupportTicketDetail)
    expect(after.key).toBe(before.key)
    expect(after.props.refreshRevision).toBeGreaterThan(before.props.refreshRevision)
    expect(after.props.messageFocus.messageId).toBe(supportIds.message)
    expect(after.props.drafts.messages).toEqual({ body: '', files: [] })
  })
  it('keeps Staff chat at the bottom on updates and preserves the position while reading older messages', () => {
    h.role = 'staff'
    const detail = render(() => SupportTicketDetail({ role: 'staff', id: supportIds.ticket, command: h.command, onFollowUp: vi.fn(), chatLayout: true }))
    const timeline = nodes(detail).find(n => typeof n.type === 'function' && n.type.name === 'SupportTimeline')!
    const slots: any[] = []
    let tree = invoke(timeline, slots)
    expect(nodes(tree).some(n => n.type === 'h3' && n.props.children === 'Tin nhắn')).toBe(false)
    const area = createScrollArea()
    const log = () => nodes(tree).find(n => n.props.role === 'log')!
    log().props.ref.current = area
    h.layouts.forEach(effect => effect())
    expect(area.scrollTop).toBe(900)
    log().props.onScroll()
    area.scrollHeight = 1800
    h.messages = supportPage([])
    tree = invoke(timeline, slots)
    h.layouts.forEach(effect => effect())
    expect(area.scrollTop).toBe(1500)
    area.scrollTop = 100
    log().props.onScroll()
    area.scrollHeight = 2400
    h.messages = supportPage([])
    tree = invoke(timeline, slots)
    h.layouts.forEach(effect => effect())
    expect(area.scrollTop).toBe(100)
  })
  it('returns to the latest page and scrolls to the sent message after replying from an older page', () => {
    h.role = 'staff'
    const detail = render(() => SupportTicketDetail({ role: 'staff', id: supportIds.ticket, command: h.command, onFollowUp: vi.fn(), chatLayout: true }))
    let timeline = nodes(detail).find(n => typeof n.type === 'function' && n.type.name === 'SupportTimeline')!
    h.messages = { ...supportPage([]), pagination: { ...supportPage([]).pagination, totalPages: 3 } }
    const slots: any[] = []
    let tree = invoke(timeline, slots)
    const area = createScrollArea()
    nodes(tree).find(n => n.props.role === 'log')!.props.ref.current = area
    h.layouts.forEach(effect => effect())
    find(tree, ApiPager).props.onPage(0)
    tree = invoke(timeline, slots)
    area.scrollTop = 50
    nodes(tree).find(n => n.props.role === 'log')!.props.onScroll()
    timeline = { ...timeline, props: { ...timeline.props, refreshRevision: 1, messageFocus: { channel: 'messages', messageId: supportIds.message } } }
    tree = invoke(timeline, slots)
    h.refresh.mockClear()
    h.effects.slice(0, 2).forEach(effect => effect())
    expect(h.refresh).toHaveBeenCalledOnce()
    h.messages = supportPage([])
    area.scrollHeight = 2000
    tree = invoke(timeline, slots)
    h.layouts.forEach(effect => effect())
    expect(h.resources[0].key).toMatch(/:messages:-1$/)
    expect(area.scrollTop).toBe(1700)
  })
  it('starts a conversation from the first message and selected facility without a title field', () => {
    const slots: any[] = [], form = () => render(() => SupportCreateForm({ command: h.command }), slots)
    let tree = form()
    expect(nodes(tree).some(n => n.type === 'input')).toBe(false)
    const text = '  Tôi cần hỗ trợ xem biên lai gia hạn.  '
    find(tree, 'textarea').props.onChange({ target: { value: text } })
    nodes(tree).filter(n => n.type === 'select')[1].props.onChange({ target: { value: supportIds.facility } })
    tree = form()
    button(tree, 'Gửi tin nhắn').props.onClick?.()
    find(tree, 'form').props.onSubmit({ preventDefault: vi.fn() })
    expect(h.run).toHaveBeenCalledExactlyOnceWith({ kind: 'create', body: { subject: text.trim(), description: text.trim(), facilityId: supportIds.facility }, parentId: undefined })
  })
  it('blocks first-message submission synchronously while uploading or after a conflicting response', () => {
    const slots: any[] = [], form = () => render(() => SupportCreateForm({ command: h.command }), slots)
    let tree = form()
    find(tree, 'textarea').props.onChange({ target: { value: 'Tôi cần được hỗ trợ.' } })
    nodes(tree).filter(n => n.type === 'select')[1].props.onChange({ target: { value: supportIds.facility } })
    tree = form()
    find(tree, EvidenceUpload).props.onBusy(true)
    find(tree, 'form').props.onSubmit({ preventDefault: vi.fn() })
    expect(h.run).not.toHaveBeenCalled()
    find(tree, EvidenceUpload).props.onBusy(false)
    h.command.conflict = true
    find(tree, 'form').props.onSubmit({ preventDefault: vi.fn() })
    expect(h.run).not.toHaveBeenCalled()
  })
  it('sends with Enter while preserving Shift+Enter and Vietnamese input composition', () => {
    const slots: any[] = [], form = () => render(() => SupportCreateForm({ command: h.command }), slots)
    let tree = form()
    find(tree, 'textarea').props.onChange({ target: { value: 'Nhờ cơ sở hỗ trợ tôi.' } })
    nodes(tree).filter(n => n.type === 'select')[1].props.onChange({ target: { value: supportIds.facility } })
    tree = form()
    const input = find(tree, 'textarea'), preventDefault = vi.fn()
    input.props.onKeyDown({ key: 'Enter', shiftKey: true, nativeEvent: { isComposing: false }, preventDefault })
    input.props.onKeyDown({ key: 'Enter', shiftKey: false, nativeEvent: { isComposing: true }, preventDefault })
    expect(h.run).not.toHaveBeenCalled(); expect(preventDefault).not.toHaveBeenCalled()
    input.props.onKeyDown({ key: 'Enter', shiftKey: false, nativeEvent: { isComposing: false }, preventDefault })
    expect(h.run).toHaveBeenCalledTimes(1); expect(preventDefault).toHaveBeenCalledTimes(1)
  })
  it('opens the persisted conversation after the first message instead of a ticket modal', () => {
    const session = workspace()
    button(session(), 'Cuộc trò chuyện mới').props.onClick()
    expect(find(session(), SupportCreateForm)).toBeDefined()
    h.onSuccess({ kind: 'create', body: { subject: 'Xin chào', description: 'Xin chào' } }, supportTicket)
    const tree = session()
    expect(find(tree, SupportCreateForm)).toBeUndefined()
    expect(find(tree, SupportTicketDetail).props).toMatchObject({ id: supportIds.ticket, chatLayout: true })
    expect(nodes(tree).some(n => typeof n.type === 'function' && n.type.name === 'Modal')).toBe(false)
  })
  it('keeps unsent message drafts when switching away from and back to a conversation', () => {
    const session = workspace()
    let tree = session()
    nodes(tree).find(n => n.type === 'button' && n.props['aria-label']?.startsWith('Mở hội thoại:'))!.props.onClick()
    tree = session()
    find(tree, SupportTicketDetail).props.onDraftChange('messages', { body: 'Bản nháp đang viết', files: [supportIds.message] })
    button(session(), 'Quay lại danh sách').props.onClick()
    tree = session()
    nodes(tree).find(n => n.type === 'button' && n.props['aria-label']?.startsWith('Mở hội thoại:'))!.props.onClick()
    expect(find(session(), SupportTicketDetail).props.drafts.messages).toEqual({ body: 'Bản nháp đang viết', files: [supportIds.message] })
  })
  it('refreshes the sidebar only while visible and unlocked, and removes its timer on unmount', () => {
    vi.useFakeTimers(); vi.stubGlobal('window', globalThis)
    const document = { visibilityState: 'visible' }; vi.stubGlobal('document', document)
    const session = workspace(); session()
    const cleanup = h.effects.map(effect => effect()).filter(fn => typeof fn === 'function') as (() => void)[]
    vi.advanceTimersByTime(8000); expect(h.refresh).toHaveBeenCalledTimes(1)
    h.command.locked = true; vi.advanceTimersByTime(8000); expect(h.refresh).toHaveBeenCalledTimes(1)
    h.command.locked = false
    document.visibilityState = 'hidden'; vi.advanceTimersByTime(8000); expect(h.refresh).toHaveBeenCalledTimes(1)
    cleanup.forEach(fn => fn()); document.visibilityState = 'visible'; vi.advanceTimersByTime(8000); expect(h.refresh).toHaveBeenCalledTimes(1)
  })
  it('loads the latest message page and renders the opening message once, including legacy conversations', async () => {
    const detail = render(() => SupportTicketDetail({ role: 'customer', id: supportIds.ticket, command: h.command, onFollowUp: vi.fn(), chatLayout: true }))
    const timeline = nodes(detail).find(n => typeof n.type === 'function' && n.type.name === 'SupportTimeline')!
    const message = { id: supportIds.message, authorId: supportTicket.customerId, authorRole: 'CUSTOMER', body: supportActive.description, sentAt: supportActive.createdAt, evidenceFileIds: [], evidenceCompleteness: 'COMPLETE' }
    h.messages = supportPage([message])
    let tree = invoke(timeline)
    // Use the log region only, so the composer cannot duplicate the opening text.
    let html = renderToStaticMarkup(<>{nodes(tree).find(n => n.props.role === 'log')!.props.children}</>)
    expect(html.split(supportActive.description)).toHaveLength(2)
    h.messages = supportPage([])
    tree = invoke(timeline)
    html = renderToStaticMarkup(<>{nodes(tree).find(n => n.props.role === 'log')!.props.children}</>)
    expect(html).toContain(supportActive.description)
    const first = { ...supportPage([]), pagination: { ...supportPage([]).pagination, totalPages: 3 } }
    h.listMessages.mockResolvedValueOnce(first).mockResolvedValueOnce(supportPage([message]))
    invoke({ ...timeline, props: { ...timeline.props, messageFocus: { channel: 'messages', messageId: 'older-sent-message' } } })
    await h.resources[0].load()
    expect(h.listMessages.mock.calls.map(call => call[2])).toEqual([0, 2])
    expect(h.resources[0].options).toEqual({ retainDataOnRefresh: true })
  })
})
