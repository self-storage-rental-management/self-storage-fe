import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import CustomerSupportWidget from './CustomerSupportWidget'

const h = vi.hoisted(() => ({ actor: undefined as any, slots: [] as any[], cursor: 0 }))
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
  return () => { h.cursor = 0; return (root.type as any)(root.props) }
}
function button(tree: any, label: string) { return nodes(tree).find(node => node.type === 'button' && node.props['aria-label'] === label)! }

beforeEach(() => {
  h.actor = { id: 'customer-one', roles: ['CUSTOMER'] }
  h.slots = []; h.cursor = 0
  vi.stubGlobal('document', { body: {} })
})
afterEach(() => vi.unstubAllGlobals())

describe('API Customer support widget', () => {
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
    button(tree, 'Thu nhỏ chat').props.onClick()
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
