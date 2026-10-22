import { beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { manager } from '../../../tests/rentalApiFixtures'
import DuongPolicyWorkspace from './DuongPolicyWorkspace'

const h = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = h.cursor++
    if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial
    return [h.slots[index], (next: unknown) => { h.slots[index] = typeof next === 'function' ? next(h.slots[index]) : next }]
  },
  useRef: (initial: unknown) => { const index = h.cursor++; return h.slots[index] ??= { current: initial } },
  useEffect: () => {},
}))
vi.mock('../../services/authApi', () => ({ getAuthenticatedActor: () => ({ ...manager, roles: ['BUSINESS'], permissions: ['policies:read'] }) }))
vi.mock('../../store/StorageHubContext', () => ({ useStorageHub: () => null }))
vi.mock('../../hooks/useRentalApiResource', () => ({ useRentalApiResource: (key: string) => ({
  loading: false, refresh: vi.fn(), data: key.includes('integration-facilities') ? { data: [{ id: 'f1', name: 'Cơ sở 1' }], pagination: { totalPages: 1 } }
    : key.endsWith('renewal-packages') ? [] : { eligiblePackageIds: [], term: { warningThroughDay: 3, seriousThroughDay: 6, urgentThroughDay: 7, recoveryFromDay: 8, recoveryCutoffTime: '17:00:00', recoveryStartTime: '08:00:00' } },
}) }))
function nodes(node: unknown): ReactElement<any>[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!node || typeof node !== 'object' || !('type' in node)) return []
  const element = node as ReactElement<any>
  return [element, ...nodes(element.props.children)]
}
beforeEach(() => { h.slots = []; h.cursor = 0 })
it('groups overdue days one to seven while preserving distinct signing and recovery milestones from the policy', () => {
  let tree = DuongPolicyWorkspace({})
  nodes(tree).find(n => n.type === 'select')!.props.onChange({ target: { value: 'f1' } })
  h.cursor = 0
  tree = DuongPolicyWorkspace({})
  const editor = nodes(tree).find(n => typeof n.type === 'function' && n.type.name === 'PolicyEditor')!
  h.slots = []; h.cursor = 0
  const html = renderToStaticMarkup(editor)
  expect(html).toContain('Ngày 1 đến 7 sau khi hết hạn thuê')
  expect(html).toContain('Nhắc khách hoàn tất gia hạn hoặc trả kho')
  expect(html).toContain('17:00 ngày 7')
  expect(html).toContain('Hết thời gian hoàn tất gia hạn')
  expect(html).toContain('Từ 08:00 ngày 8')
  expect(html).toContain('Chuyển hồ sơ sang xử lý thu hồi khi đủ điều kiện')
  expect(html).not.toContain('Cảnh báo quá hạn nghiêm trọng')
  expect(html).not.toContain('Cảnh báo khẩn cấp')
  expect(html).not.toContain('Lưu chỉnh sửa')
})
