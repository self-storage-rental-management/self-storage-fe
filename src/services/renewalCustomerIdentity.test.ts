import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './apiClient'
import { getRenewalCustomerIdentity } from './renewalOperationsApi'

vi.mock('./apiClient', async importOriginal => ({
  ...await importOriginal<typeof import('./apiClient')>(), apiRequest: vi.fn(),
}))
const renewalId = '11111111-1111-4111-8111-111111111111'
const identity = { renewalId, customerId: '22222222-2222-4222-8222-222222222222',
  fullName: 'Khách thử nghiệm', identityDocumentNumber: '079203009988' }
beforeEach(() => vi.clearAllMocks())

describe('renewal signing identity read', () => {
  it('reads the assigned staff endpoint and preserves the stored identity', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: identity })
    expect(await getRenewalCustomerIdentity(renewalId)).toEqual(identity)
    expect(apiRequest).toHaveBeenCalledWith(`/api/staff/renewals/${renewalId}/customer-identity`)
  })
  it('keeps missing identity explicit', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { ...identity, identityDocumentNumber: null } })
    expect((await getRenewalCustomerIdentity(renewalId)).identityDocumentNumber).toBeNull()
  })
  it.each([{ renewalId: 'other' }, { identityDocumentNumber: 123 }, { customerId: 'invalid' }])(
    'rejects invalid or mismatched data %j', async fields => {
      vi.mocked(apiRequest).mockResolvedValue({ data: { ...identity, ...fields } })
      await expect(getRenewalCustomerIdentity(renewalId)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    },
  )
})
