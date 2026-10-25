import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCustomerChatPersistence } from './useCustomerChatPersistence'
import { saveCustomerChatSession } from '../services/customerChatSessionApi'
import type { ChatSessionSnapshot } from '../services/customerChatSessionApi'
import { waitForChatSessionSaves } from '../services/chatSessionSaveQueue'

const h = vi.hoisted(() => ({ actorId: 'customer-one', key: 0, cleanup: [] as (() => void)[] }))
vi.mock('react', () => ({ useRef: (current: unknown) => ({ current }), useState: () => [undefined, vi.fn()], useCallback: (fn: unknown) => fn, useEffect: (effect: () => () => void) => { h.cleanup.push(effect()) } }))
vi.mock('../services/authApi', () => ({ getAuthenticatedActor: () => ({ id: h.actorId }) }))
vi.mock('../services/supportAiApi', () => ({ newSupportAiRequestId: () => `mutation-${++h.key}` }))
vi.mock('../services/customerChatSessionApi', () => ({ saveCustomerChatSession: vi.fn() }))
const initial = { version: 3, snapshot: { messages: [], ticketId: null, autoReturn: false } }
const snapshot = (body: string): ChatSessionSnapshot => ({ messages: [{ id: 1, role: 'customer', body }], ticketId: null, autoReturn: false })
beforeEach(() => { vi.resetAllMocks(); h.actorId = 'customer-one'; h.key = 0 })
afterEach(() => { h.cleanup.splice(0).forEach(cleanup => cleanup()) })

describe('Customer chat snapshot persistence', () => {
  it('retries failed autosave and flushes the newest snapshot before logout can proceed', async () => {
    const lost = new Error('Lost response')
    vi.mocked(saveCustomerChatSession).mockRejectedValueOnce(lost).mockRejectedValueOnce(lost)
      .mockResolvedValueOnce({ version: 4, snapshot: snapshot('first') })
      .mockResolvedValueOnce({ version: 5, snapshot: snapshot('latest') })
    const state = useCustomerChatPersistence('customer-one', initial)
    state.save(snapshot('first'))
    await state.retry()
    state.save(snapshot('latest'))
    await state.retry()
    await waitForChatSessionSaves('customer-one')
    const calls = vi.mocked(saveCustomerChatSession).mock.calls
    expect(calls).toHaveLength(4)
    expect(calls[1]).toEqual(calls[0])
    expect(calls[2]).toEqual(calls[0])
    expect(calls[3]).toEqual([snapshot('latest'), 4, 'mutation-2'])
  })
  it('rejects logout draining if saving keeps failing, and retains the snapshot for retry', async () => {
    vi.mocked(saveCustomerChatSession).mockRejectedValue(new Error('Offline'))
    const state = useCustomerChatPersistence('customer-one', initial)
    state.save(snapshot('unsaved'))
    await expect(waitForChatSessionSaves('customer-one')).rejects.toThrow('Offline')
    vi.mocked(saveCustomerChatSession).mockResolvedValueOnce({ version: 4, snapshot: snapshot('unsaved') })
    await waitForChatSessionSaves('customer-one')
    const calls = vi.mocked(saveCustomerChatSession).mock.calls
    expect(calls.at(-1)).toEqual(calls[0])
  })
  it('serializes saves with server versions and keeps the latest queued state', async () => {
    let complete!: (value: any) => void
    vi.mocked(saveCustomerChatSession).mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
      .mockResolvedValueOnce({ version: 5, snapshot: snapshot('latest') })
    const state = useCustomerChatPersistence('customer-one', initial)
    state.save(snapshot('first')); state.save(snapshot('intermediate')); state.save(snapshot('latest'))
    expect(saveCustomerChatSession).toHaveBeenCalledTimes(1)
    complete({ version: 4, snapshot: snapshot('first') })
    await vi.waitFor(() => expect(saveCustomerChatSession).toHaveBeenCalledTimes(2))
    expect(vi.mocked(saveCustomerChatSession).mock.calls[1]).toEqual([snapshot('latest'), 4, 'mutation-2'])
  })
  it('retries a lost response with the same snapshot, version and mutation id', async () => {
    vi.mocked(saveCustomerChatSession).mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ version: 4, snapshot: snapshot('saved') })
    const state = useCustomerChatPersistence('customer-one', initial)
    state.save(snapshot('saved'))
    await vi.waitFor(() => expect(saveCustomerChatSession).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    await state.retry()
    expect(vi.mocked(saveCustomerChatSession).mock.calls[1]).toEqual(vi.mocked(saveCustomerChatSession).mock.calls[0])
  })
  it('stops queued writes after switching accounts', async () => {
    let complete!: (value: any) => void
    vi.mocked(saveCustomerChatSession).mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    const state = useCustomerChatPersistence('customer-one', initial)
    state.save(snapshot('first')); state.save(snapshot('not sent'))
    h.actorId = 'customer-two'
    complete({ version: 4, snapshot: snapshot('first') })
    await state.retry()
    expect(saveCustomerChatSession).toHaveBeenCalledTimes(1)
    state.save(snapshot('must not leak'))
    expect(saveCustomerChatSession).toHaveBeenCalledTimes(1)
  })
})
