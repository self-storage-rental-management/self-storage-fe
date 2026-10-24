import { beforeEach, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import CustomerSupportAssistant from './CustomerSupportAssistant'
import SupportLiveConversation from './SupportLiveConversation'

const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, request: vi.fn() }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState: (initial: any) => {
    const i = h.cursor++
    if (!(i in h.slots)) h.slots[i] = initial
    return [h.slots[i], (value: any) => { h.slots[i] = typeof value === 'function' ? value(h.slots[i]) : value }]
  },
  useRef: (initial: any) => h.slots[h.cursor++] ??= { current: initial },
  useEffect: () => {},
}))
vi.mock('../../services/authApi', () => ({ getAuthenticatedActor: () => ({ id: 'customer' }) }))
vi.mock('../../services/supportAiApi', () => ({ newSupportAiRequestId: () => 'request', requestSupportAiReply: (...args: any[]) => h.request(...args), supportAiErrorMessage: () => 'Error' }))
function nodes(node: any): ReactElement<any>[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!node || typeof node !== 'object' || !node.props) return []
  return [node, ...nodes(node.props.children)]
}
const props = { actorId: 'customer', active: true, staffTicketId: 'saved-ticket', onStaffStatus: vi.fn(), onStaffLocked: vi.fn() }
function render(staffActive: boolean) { h.cursor = 0; return CustomerSupportAssistant({ ...props, staffActive }) as ReactElement<any> }
beforeEach(() => { h.slots = []; h.request.mockReset().mockResolvedValue({ answer: 'AI reply', source: 'FAQ' }) })

it('keeps saved Staff messages in the same viewport while allowing a new AI question', async () => {
  let tree = render(false)
  expect(tree.type).toBe(SupportLiveConversation)
  expect(tree.props.id).toBe('saved-ticket')
  expect(tree.props.assistantContent).toBeTruthy()
  let input = nodes(tree.props.assistantComposer).find(node => node.type === 'textarea')!
  input.props.onChange({ target: { value: 'Tiếp tục hỏi AI' } })
  tree = render(false)
  nodes(tree.props.assistantComposer).find(node => node.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() })
  await vi.waitFor(() => expect(h.request).toHaveBeenCalledOnce())
  expect(h.request.mock.calls[0][0].message).toBe('Tiếp tục hỏi AI')
  tree = render(false)
  expect(tree.props.id).toBe('saved-ticket')
  expect(nodes(tree.props.assistantContent).some(node => node.props.children === 'Tiếp tục hỏi AI')).toBe(true)
})

it('uses only the Staff composer while waiting or being supported', () => {
  const tree = render(true)
  expect(tree.type).toBe(SupportLiveConversation)
  expect(tree.props.assistantContent).toBeUndefined()
  expect(tree.props.assistantComposer).toBeUndefined()
  expect(h.request).not.toHaveBeenCalled()
})
