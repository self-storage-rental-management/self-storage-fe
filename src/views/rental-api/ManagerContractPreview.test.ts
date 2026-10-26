import { beforeEach, expect, it, vi } from 'vitest'
import { listRenewalOperationEvents } from '../../services/renewalOperationsApi'
import type { RenewalOperationEvent } from '../../types/renewalOperationsApi'
import { loadManagerRenewalContracts } from './ManagerContractPreview'

vi.mock('../../services/renewalOperationsApi', async importOriginal => ({
  ...await importOriginal<typeof import('../../services/renewalOperationsApi')>(),
  listRenewalOperationEvents: vi.fn(),
}))

const renewalId = '11111111-1111-4111-8111-111111111111'
const fileId = '22222222-2222-4222-8222-222222222222'
const occurredAt = '2026-10-26T13:00:00Z'
const event = (kind: RenewalOperationEvent['kind'], data: unknown): RenewalOperationEvent => ({ id: kind, kind, data, occurredAt, actorId: null })
const page = (data: RenewalOperationEvent[], index: number, totalPages: number) => ({
  data, pagination: { page: index, pageSize: 100, totalItems: 5, totalPages, sort: 'occurredAt,desc' }, correlationId: null,
})

beforeEach(() => vi.mocked(listRenewalOperationEvents).mockReset())

it('finds signed contracts across pages without treating arrival evidence as a contract or duplicating files', async () => {
  vi.mocked(listRenewalOperationEvents)
    .mockResolvedValueOnce(page([
      event('ARRIVAL', { signedDocumentFileId: fileId }),
      event('COMPLETION', { signedDocumentFileId: 'invalid' }),
    ], 0, 2))
    .mockResolvedValueOnce(page([
      event('COMPLETION', { signedDocumentFileId: fileId }),
      event('COMPLETION', { signedDocumentFileId: fileId }),
    ], 1, 2))
  expect(await loadManagerRenewalContracts(renewalId)).toEqual([{ id: fileId, signedAt: occurredAt }])
  expect(listRenewalOperationEvents).toHaveBeenNthCalledWith(2, 'manager', renewalId, 'documents', 1, 100)
})

it('keeps an unavailable document source as an error instead of reporting that no contract exists', async () => {
  vi.mocked(listRenewalOperationEvents).mockRejectedValueOnce(new Error('Document access denied'))
  await expect(loadManagerRenewalContracts(renewalId)).rejects.toThrow('Document access denied')
})
