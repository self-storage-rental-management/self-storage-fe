import { beforeEach, expect, it, vi } from 'vitest'
import App from './App'

const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, logout: vi.fn(), actor: { id: 'customer', status: 'ACTIVE', roles: ['CUSTOMER'] } }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState: (initial: any) => {
    const index = h.cursor++
    if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial
    return [h.slots[index], (value: any) => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value }]
  },
  useRef: (initial: unknown) => h.slots[h.cursor++] ??= { current: initial },
  useEffect: () => {},
}))
vi.mock('./store/StorageHubContext', () => ({ StorageHubProvider: () => null, useStorageHub: () => ({ users: [], sessions: [] }) }))
vi.mock('./services/authApi', () => ({
  getAuthenticatedActor: () => h.actor,
  actorToUser: () => ({ id: h.actor.id, role: 'customer' }),
  logoutFromApi: () => h.logout(),
}))
vi.mock('./services/apiClient', () => ({ getRefreshToken: () => null }))
vi.mock('./views/Login', () => ({ default: () => null }))
vi.mock('./views/home/HomePage', () => ({ default: () => null }))
vi.mock('./views/RequiredPasswordChange', () => ({ default: () => null }))

function nodes(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!node || typeof node !== 'object' || !node.props) return []
  return [node, ...nodes(node.props.children)]
}
function render() {
  const main = (App() as any).props.children.props.children
  h.cursor = 0
  return main.type(main.props)
}
const roleApp = (tree: any) => nodes(tree).find(node => node.props.onLogout)
beforeEach(() => {
  h.slots = []; h.logout.mockReset()
  vi.stubGlobal('window', { location: { href: 'http://localhost/', pathname: '/', hostname: 'localhost' }, history: { replaceState: vi.fn() } })
})

it('keeps the chat mounted and prevents a second logout while waiting for a failed save', async () => {
  let fail!: (error: Error) => void
  h.logout.mockImplementation(() => new Promise((_, reject) => { fail = reject }))
  const first = roleApp(render())
  const pending = first.props.onLogout()
  const waiting = render()
  expect(roleApp(waiting).type).toBe(first.type)
  expect(nodes(waiting).some(node => node.props.inert === true)).toBe(true)
  await roleApp(waiting).props.onLogout()
  expect(h.logout).toHaveBeenCalledTimes(1)
  fail(new Error('Offline'))
  await pending
  const failed = render()
  expect(roleApp(failed).type).toBe(first.type)
  expect(nodes(failed).some(node => node.props.role === 'alert')).toBe(true)
  expect(nodes(failed).some(node => node.props.inert === true)).toBe(false)
})

it('leaves the account screen only after chat saving and logout succeed', async () => {
  let finish!: (ok: boolean) => void
  h.logout.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const pending = roleApp(render()).props.onLogout()
  expect(roleApp(render())).toBeDefined()
  finish(true)
  await pending
  expect(roleApp(render())).toBeUndefined()
})
