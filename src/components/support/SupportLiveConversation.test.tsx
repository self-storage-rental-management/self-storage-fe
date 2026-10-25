import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import SupportLiveConversation from './SupportLiveConversation'

const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as (() => void)[], layouts: [] as (() => void)[], loading: true, refresh: vi.fn() }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = h.cursor++
    if (!(index in h.slots)) h.slots[index] = initial
    return [h.slots[index], (value: unknown) => { h.slots[index] = value }]
  },
  useRef: (initial: unknown) => h.slots[h.cursor++] ??= { current: initial },
  useLayoutEffect: (effect: () => void) => { h.layouts.push(effect) },
  useEffect: (fn: () => void | (() => void), deps: unknown[]) => {
    const index = h.cursor++, previous = h.slots[index]
    if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
      h.slots[index] = { deps, cleanup: undefined }
      h.effects.push(() => { previous?.cleanup?.(); h.slots[index].cleanup = fn() })
    }
  },
}))
vi.mock('../../hooks/useRentalApiResource', () => ({ useRentalApiResource: () => ({ loading: h.loading, refresh: h.refresh }) }))
vi.mock('../../hooks/useSupportCommand', () => ({ useSupportCommand: () => ({ locked: false }) }))
vi.mock('../../hooks/useSupportMessageReads', () => ({ useSupportMessageReads: () => {} }))
vi.mock('../../services/authApi', () => ({ getAuthenticatedActor: () => undefined }))
const props = { actorId: 'customer', id: 'ticket', active: true, fallback: null, onStatus: vi.fn(), onLocked: vi.fn() }
function render(active = true) {
  h.cursor = 0
  const tree = SupportLiveConversation({ ...props, active })
  h.effects.splice(0).forEach(effect => effect())
  return tree
}
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('window', globalThis); vi.stubGlobal('document', { visibilityState: 'visible' })
  h.slots = []; h.effects = []; h.layouts = []; h.loading = true; h.refresh.mockReset()
})

function nodes(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!node || typeof node !== 'object' || !node.props) return []
  return [node, ...nodes(node.props.children)]
}

it('grows the input with its content, scrolls only beyond the limit, and shrinks after clearing', () => {
  let tree = render()
  let input = nodes(tree).find(node => node.type === 'textarea')!
  const field = { style: { height: '', overflowY: '' }, scrollHeight: 32 }
  input.props.ref.current = field
  h.layouts.splice(0).forEach(effect => effect())
  expect(field.style).toEqual({ height: '32px', overflowY: 'hidden' })

  input.props.onChange({ target: { value: 'Dòng một\nDòng hai\nDòng ba' } })
  field.scrollHeight = 72
  tree = render()
  h.layouts.splice(0).forEach(effect => effect())
  expect(field.style).toEqual({ height: '72px', overflowY: 'hidden' })

  input = nodes(tree).find(node => node.type === 'textarea')!
  input.props.onChange({ target: { value: 'Nhiều dòng\n'.repeat(20) } })
  field.scrollHeight = 180
  render()
  h.layouts.splice(0).forEach(effect => effect())
  expect(field.style).toEqual({ height: '120px', overflowY: 'auto' })

  input.props.onChange({ target: { value: '' } })
  field.scrollHeight = 32
  render()
  h.layouts.splice(0).forEach(effect => effect())
  expect(field.style).toEqual({ height: '32px', overflowY: 'hidden' })
})
afterEach(() => {
  h.slots.forEach(slot => slot?.cleanup?.()); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals()
})

it('waits for slow chat loads before polling again, then resumes polling after completion', () => {
  render()
  vi.advanceTimersByTime(15000)
  expect(h.refresh).not.toHaveBeenCalled()
  h.loading = false; render()
  vi.advanceTimersByTime(5000)
  expect(h.refresh).toHaveBeenCalledTimes(1)
  h.loading = true; render()
  vi.advanceTimersByTime(15000)
  expect(h.refresh).toHaveBeenCalledTimes(1)
  h.loading = false; render()
  vi.advanceTimersByTime(5000)
  expect(h.refresh).toHaveBeenCalledTimes(2)
})

it('does not poll while the chat is hidden or inactive', () => {
  h.loading = false; render()
  vi.stubGlobal('document', { visibilityState: 'hidden' })
  vi.advanceTimersByTime(5000)
  expect(h.refresh).not.toHaveBeenCalled()
  render(false)
  vi.stubGlobal('document', { visibilityState: 'visible' })
  vi.advanceTimersByTime(10000)
  expect(h.refresh).not.toHaveBeenCalled()
})
