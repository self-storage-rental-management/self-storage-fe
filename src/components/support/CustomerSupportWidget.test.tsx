import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import CustomerSupportWidget from './CustomerSupportWidget'

const h = vi.hoisted(() => ({ actor: undefined as any, slots: [] as any[], cursor: 0, session: { version: 0, snapshot: { messages: [] as any[], ticketId: null as string | null, autoReturn: false } } }))
vi.mock('../../hooks/useRentalApiResource', () => ({ useRentalApiResource: () => ({ data: h.session, loading: false, refresh: vi.fn() }) }))
vi.mock('../../hooks/useCustomerChatPersistence', () => ({ useCustomerChatPersistence: () => ({ save: vi.fn(), retry: vi.fn(), error: undefined }) }))
vi.mock('../../hooks/useSupportMessageReads', () => ({ useSupportUnread: () => new Map() }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState: (initial: any) => {
    const index = h.cursor++
    if (!(index in h.slots)) h.slots[index] = initial
    return [h.slots[index], (value: any) => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value }]
  },
  useRef: () => ({ current: null }),
  useId: () => 'widget-test',
  useEffect: () => {},
}))
vi.mock('react-dom', () => ({ createPortal: (children: any) => children }))
vi.mock('../../services/authApi', () => ({ getAuthenticatedActor: () => h.actor }))
vi.mock('../../views/support-api/presentation', () => ({ canReadSupport: (actor: any, role: string) => actor.roles.includes(role.toUpperCase()) }))

type Element = ReactElement<any>
function nodes(tree: any): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return tree && typeof tree === 'object' && 'type' in tree ? [tree, ...nodes(tree.props.children)] : []
}
function shell() {
  const root = CustomerSupportWidget() as Element
  const widget = (root.type as any)(root.props) as Element
  return () => { h.cursor = 0; return (widget.type as any)(widget.props) }
}
function button(tree: any, label: string) { return nodes(tree).find(node => node.type === 'button' && node.props['aria-label'] === label)! }

beforeEach(() => {
  h.actor = { id: 'customer-one', roles: ['CUSTOMER'] }
  h.slots = []; h.cursor = 0
  h.session = { version: 0, snapshot: { messages: [], ticketId: null, autoReturn: false } }
  vi.stubGlobal('document', { body: {} })
})
afterEach(() => vi.unstubAllGlobals())

describe('API Customer support widget', () => {
  it('returns to AI with an icon while retaining the Staff conversation and saved AI text', () => {
    h.session = { version: 4, snapshot: { messages: [{ id: 1, role: 'customer', body: 'Nội dung đã lưu' }], ticketId: 'active-ticket', autoReturn: true } }
    const render = shell()
    button(render(), 'Mở chat hỗ trợ').props.onClick()
    const back = button(render(), 'Quay về chat AI')
    expect(back).toBeDefined()
    expect(nodes(back).some(node => node.type === 'svg')).toBe(true)
    expect(nodes(render()).some(node => node.props.role === 'tooltip' && node.props.children === 'Quay về chat AI')).toBe(true)
    back.props.onClick()
    const assistant = nodes(render()).find(node => typeof node.type === 'function' && 'onMeetStaff' in node.props)!
    expect(assistant.props.staffTicketId).toBe('active-ticket')
    expect(assistant.props.staffActive).toBe(false)
    expect(assistant.props.initialMessages).toEqual(h.session.snapshot.messages)
    expect(typeof assistant.props.onMeetStaff).toBe('function')
    expect(button(render(), 'Quay về chat AI')).toBeUndefined()
  })
  it('uses one conversation without a session list or a new-conversation action', () => {
    const render = shell()
    button(render(), 'Mở chat hỗ trợ').props.onClick()
    expect(button(render(), 'Lịch sử hỗ trợ')).toBeUndefined()
    expect(nodes(render()).some(node => node.props.children === 'Cuộc trò chuyện mới')).toBe(false)
  })
  it('restores the saved AI transcript and active Staff ticket on a new login', () => {
    h.session = { version: 4, snapshot: { messages: [{ id: 1, role: 'customer', body: 'Câu hỏi đã lưu' }], ticketId: 'existing-ticket', autoReturn: true } }
    const render = shell()
    button(render(), 'Mở chat hỗ trợ').props.onClick()
    const assistant = nodes(render()).find(node => typeof node.type === 'function' && 'onMeetStaff' in node.props)!
    expect(assistant.props.initialMessages).toEqual(h.session.snapshot.messages)
    expect(assistant.props.staffTicketId).toBe('existing-ticket')
    expect(assistant.props.onMeetStaff).toBeUndefined()
    expect(typeof assistant.props.onStaffResolved).toBe('function')
  })
  it('returns to AI inside the same conversation after Staff completion and allows another handoff', () => {
    const render = shell()
    button(render(), 'Mở chat hỗ trợ').props.onClick()
    const assistant = () => nodes(render()).find(node => typeof node.type === 'function' && 'onMeetStaff' in node.props)!
    let chat = assistant()
    const originalKey = chat.key
    chat.props.onMeetStaff('Cần gia hạn', [{ role: 'CUSTOMER', body: 'Cần gia hạn' }])
    chat = assistant()
    chat.props.staffRequest.props.onCreated('ticket-first')
    chat = assistant()
    expect(chat.props.staffTicketId).toBe('ticket-first')
    expect(chat.props.onMeetStaff).toBeUndefined()
    chat.props.onStaffResolved()
    chat = assistant()
    expect(chat.props.staffTicketId).toBe('ticket-first')
    expect(chat.props.staffActive).toBe(false)
    expect(chat.key).not.toBe(originalKey)
    expect(typeof chat.props.onMeetStaff).toBe('function')
    expect(nodes(render()).some(node => node.props.role === 'status')).toBe(true)
    chat.props.onMeetStaff('Hỗ trợ lần nữa', [])
    chat = assistant()
    expect(chat.props.staffRequest.props.question).toBe('Hỗ trợ lần nữa')
    chat.props.staffRequest.props.onCreated('ticket-first')
    expect(assistant().props.staffTicketId).toBe('ticket-first')
  })

  it('restores the same completed conversation beneath the AI composer after login', () => {
    h.session = { version: 4, snapshot: { messages: [{ id: 2, role: 'customer', body: 'Tiếp tục với AI' }], ticketId: 'ticket-archived', autoReturn: false } }
    const render = shell()
    button(render(), 'Mở chat hỗ trợ').props.onClick()
    const assistant = () => nodes(render()).find(node => typeof node.type === 'function' && 'onMeetStaff' in node.props)!
    expect(assistant().props.staffTicketId).toBe('ticket-archived')
    expect(assistant().props.staffActive).toBe(false)
    expect(assistant().props.initialMessages).toEqual(h.session.snapshot.messages)
    expect(assistant().props.onStaffResolved).toBeUndefined()
    assistant().props.onStaffRequestAgain()
    expect(assistant().props.staffTicketId).toBe('ticket-archived')
    expect(assistant().props.staffRequest).toBeTruthy()
  })
  it('does not expose the widget to a signed-out account or Staff', () => {
    h.actor = undefined
    expect(CustomerSupportWidget()).toBeNull()
    h.actor = { id: 'staff-one', roles: ['STAFF'] }
    expect(CustomerSupportWidget()).toBeNull()
  })

  it('keys the session by Customer to discard the previous account state', () => {
    expect((CustomerSupportWidget() as Element).key).toBe('customer-one')
    h.actor.id = 'customer-two'
    expect((CustomerSupportWidget() as Element).key).toBe('customer-two')
  })

  it('keeps the same content mounted when minimized and reopened', () => {
    const render = shell()
    let tree = render()
    expect(nodes(tree).some(node => node.props.role === 'dialog')).toBe(false)
    button(tree, 'Mở chat hỗ trợ').props.onClick()
    tree = render()
    const panel = nodes(tree).find(node => node.props.role === 'dialog')!
    const content = nodes(panel).find(node => node.props.actorId === 'customer-one')!
    expect(panel.props['aria-hidden']).toBe(false)
    button(tree, 'Đóng chat').props.onClick()
    tree = render()
    const minimized = nodes(tree).find(node => node.props.role === 'dialog')!
    expect(minimized.props['aria-hidden']).toBe(true)
    expect(minimized.props.inert).toBe(true)
    expect(nodes(minimized).find(node => node.props.actorId === 'customer-one')!.type).toBe(content.type)
    button(tree, 'Mở chat hỗ trợ').props.onClick()
    expect(nodes(render()).find(node => node.props.role === 'dialog')!.props['aria-hidden']).toBe(false)
  })

  it('minimizes with Escape and keeps the chat icon visible under the global SVG rule', () => {
    const render = shell()
    let tree = render()
    const icon = nodes(button(tree, 'Mở chat hỗ trợ')).find(node => typeof node.type === 'function')!
    const svg = (icon.type as any)(icon.props) as Element
    expect(svg.props.className).toContain('show-icon')
    button(tree, 'Mở chat hỗ trợ').props.onClick()
    tree = render()
    const stopPropagation = vi.fn()
    nodes(tree).find(node => node.props.role === 'dialog')!.props.onKeyDown({ key: 'Escape', stopPropagation })
    expect(stopPropagation).toHaveBeenCalledOnce()
    expect(nodes(render()).find(node => node.props.role === 'dialog')!.props['aria-hidden']).toBe(true)
  })
})
