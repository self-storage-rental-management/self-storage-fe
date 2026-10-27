import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { setAccessToken, clearAuthTokens } from './apiClient'
import { completeRefund, recordReturnSettlement, isApiReturn, requestReturn, listReturns, getReturn, inspectReturn, reviewDispute, confirmReturn, paySettlement, returnError, uploadReturnEvidence, type ApiReturn } from './returnApi'
import { ReturnSummary } from '../views/return-api/ReturnApiPanel'
import { ids, operationsActor } from '../../tests/rentalOperationsApiFixtures'
import type { ApiActor } from './authApi'
const state = vi.hoisted(() => ({ actor: null as ApiActor | null }))
vi.mock('./authApi', () => ({ getAuthenticatedActor: () => state.actor }))
export const record: ApiReturn = {
  id: ids.event, rentalId: ids.rental, facilityId: ids.facility, customerId: ids.customer,
  facilityName: 'Cơ sở kiểm thử', unitNumber: 'TEST-1', customerName: 'Khách kiểm thử',
  status: 'awaiting_customer_confirmation', scheduledDate: '2026-10-25', inspectionNotes: 'Đã nghiệm thu', managerResolutionNote: null,
  depositAmount: 500000, totalDeductions: 5000, netRefundAmount: null, amountDueFromCustomer: null,
  settlementBlocker: 'Chưa có chứng cứ tiền thực thu; cần cơ sở đối soát trước khi quyết toán.', customerConfirmed: false,
  damageFee: 5000, cleaningFee: 0, lostItemFee: 0, overdueFee: 0, outstandingFee: 0,
  proposedUnitStatus: 'maintenance',
}
function respond(data: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetch); return fetch
}
beforeEach(() => { state.actor = operationsActor('customer'); setAccessToken('TEST-token') })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); clearAuthTokens() })
describe('real Return transport and unknown settlement presentation', () => {
  it('accepts and displays the backend inspected state', () => {
    const inspected: ApiReturn = { ...record, status: 'inspected' }
    expect(isApiReturn(inspected)).toBe(true)
    expect(renderToStaticMarkup(<ReturnSummary record={inspected} />)).toContain('Đã nghiệm thu')
  })
  it('accepts the backend return contract when no optional settlement blocker is present', () => {
    const backendRecord = { ...record, settlementBlocker: undefined }
    expect(isApiReturn(backendRecord)).toBe(true)
  })
  it('preserves null balances and displays unresolved money without a refund success claim', () => {
    expect(isApiReturn(record)).toBe(true)
    const html = renderToStaticMarkup(<ReturnSummary record={record} />)
    expect(html).toContain('Chưa xác định')
    expect(html).toContain('cần cơ sở đối soát trước khi quyết toán')
    expect(html).not.toContain('FIN_06')
    expect(html).not.toContain('Khoản hoàn tiền: 0')
  })
  it.each([{ ...record, id: 'RET-DEMO' }, { ...record, netRefundAmount: -1 }, { ...record, scheduledDate: '2026-02-30' }, { ...record, damageFee: 1.001 }])('rejects invalid server data', value => {
    expect(isApiReturn(value)).toBe(false)
  })
  it('creates request through the existing rental route, no amount or payment proof supplied', async () => {
    const fetch = respond({ data: record })
    expect(await requestReturn(ids.rental, '2026-10-25', 'TEST request')).toEqual(record)
    expect(fetch.mock.calls[0][0]).toContain(`/api/customer/rentals/${ids.rental}/return-request`)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ scheduledDate: '2026-10-25', notes: 'TEST request' })
    expect(new Headers(fetch.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer TEST-token')
  })
  it('reads paginated ownership-bound rows and detail', async () => {
    respond({ data: [record], pagination: { page: 0, pageSize: 20, totalItems: 1, totalPages: 1, sort: 'createdAt: DESC' }, correlationId: 'test' })
    expect((await listReturns('customer')).data[0].netRefundAmount).toBeNull()
    respond({ data: record }); expect(await getReturn('customer', ids.event)).toEqual(record)
  })
  it.each(['customer', 'staff', 'manager'] as const)('rejects cross-resource readback for %s', async role => {
    state.actor = operationsActor(role)
    state.actor.permissions.push('returns:read')
    respond({ data: { ...record, id: ids.file } })
    await expect(getReturn(role, ids.event)).rejects.toThrow('contract')
  })
  it('cannot read another customer record', async () => {
    respond({ data: { ...record, customerId: ids.staff } })
    await expect(getReturn('customer', ids.event)).rejects.toThrow('contract')
  })
  it('sends Customer dispute, and a 409 never becomes settlement success', async () => {
    const fetch = respond({ data: { ...record, status: 'disputed' } })
    expect((await confirmReturn(ids.event, 'disputed', 'Đề nghị xem xét')).status).toBe('disputed')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ decision: 'disputed', note: 'Đề nghị xem xét' })
    respond({ error: { message: 'verified paid security deposit required', code: 'CONFLICT' } }, 409)
    try { await confirmReturn(ids.event, 'accepted', 'TEST'); throw new Error('Unexpected success') } catch (e) {
      expect(returnError(e)).toContain('chưa xác nhận thành công')
    }
  })
  it('keeps the backend rejection of a customer-declared settlement payment', async () => {
    const fetch = respond({ error: { message: 'Vui lòng thanh toán tại cơ sở.', code: 'CONFLICT' } }, 409)
    await expect(paySettlement(ids.event, 'CASH', 'Khách tự khai đã thanh toán')).rejects.toThrow('thanh toán tại cơ sở')
    expect(fetch.mock.calls[0][0]).toContain(`/api/customer/returns/${ids.event}/pay-settlement`)
  })
  it('sends inspection with explicit deductions and returned-access items', async () => {
    state.actor = operationsActor('staff'); state.actor.permissions.push('returns:process', 'returns:read')
    const fetch = respond({ data: record })
    await inspectReturn(ids.event, { damageFee: 5000, cleaningFee: 0, lostItemFee: 0, overdueFee: 0, outstandingFee: 0,
      inventoryMatch: 'match', damageClassification: 'minor_damage', staffNotes: 'TEST inspection', evidencePhotos: [],
      unitVacated: true, returnedKey: true, returnedCard: false, returnedLock: true, proposedUnitStatus: 'maintenance' })
    expect(fetch.mock.calls[0][0]).toContain(`/api/staff/returns/${ids.event}/inspection`)
    expect(JSON.parse(fetch.mock.calls[0][1].body).returnedCard).toBe(false)
    expect(JSON.parse(fetch.mock.calls[0][1].body).unitVacated).toBe(true)
  })
  it('uploads return evidence and sends the stored asset ID to the inspection endpoint', async () => {
    state.actor = operationsActor('staff'); state.actor.permissions.push('returns:process', 'returns:read')
    const assetId = ids.file
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: assetId, originalName: 'return.jpg', contentType: 'image/jpeg', sizeBytes: 4 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...record, status: 'awaiting_customer_confirmation', evidencePhotos: [assetId] } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetch)

    const uploaded = await uploadReturnEvidence(ids.event, new File(['test'], 'return.jpg', { type: 'image/jpeg' }))
    expect(uploaded.id).toBe(assetId)
    const options = fetch.mock.calls[0][1] as RequestInit
    expect(options.body).toBeInstanceOf(FormData)
    expect((options.body as FormData).get('entityType')).toBe('RETURN_CASE')
    expect((options.body as FormData).get('entityId')).toBe(ids.event)

    await inspectReturn(ids.event, { damageFee: 5000, cleaningFee: 0, lostItemFee: 0, overdueFee: 0, outstandingFee: 0,
      inventoryMatch: 'match', damageClassification: 'minor_damage', staffNotes: 'TEST inspection', evidencePhotos: [uploaded.id],
      returnedKey: true, returnedCard: true, returnedLock: true, proposedUnitStatus: 'available' })
    expect(JSON.parse(fetch.mock.calls[1][1].body).evidencePhotos).toEqual([assetId])
  })
  it('records the refund transaction reference through the Business endpoint for authorized Business Operations', async () => {
    state.actor = {
      ...operationsActor('manager'),
      roles: ['BUSINESS'],
      permissions: ['returns:read', 'refunds:execute'],
      facilityScopes: { [ids.facility]: 'MANAGE' },
    }
    const fetch = respond({ data: { ...record, status: 'completed' } })
    const proof = { transactionReference: 'REFUND-TEST-001', notes: 'Đã chuyển khoản.', paymentMethod: 'BANK_TRANSFER' as const, receiptFileId: ids.file, confirmed: true, amount: 5700000 }
    const result = await completeRefund(ids.event, proof)
    expect(result.status).toBe('completed')
    expect(fetch.mock.calls[0][0]).toContain(`/api/business/returns/${ids.event}/complete-refund`)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(proof)
  })
  it('sends the server statement amount and saved proof when recording a Staff payout', async () => {
    state.actor = operationsActor('staff')
    state.actor.permissions.push('returns:process', 'returns:read', 'refunds:execute')
    const fetch = respond({ data: { ...record, status: 'completed', settlementBlocker: null } })
    const proof = { amount: 5700000, paymentMethod: 'CASH' as const, transactionReference: 'CASH-REFUND', receiptFileId: ids.file, confirmed: true }
    await recordReturnSettlement(ids.event, proof, 'same-refund-command')
    expect(fetch.mock.calls[0][0]).toContain(`/api/staff/returns/${ids.event}/settlement-receipts`)
    expect(new Headers(fetch.mock.calls[0][1].headers).get('Idempotency-Key')).toBe('same-refund-command')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(proof)
  })
  it('does not send a payout with missing confirmation or invalid saved evidence', async () => {
    state.actor = operationsActor('staff')
    state.actor.permissions.push('returns:process', 'returns:read', 'refunds:execute')
    const fetch = respond({ data: record })
    const proof = { amount: 5700000, paymentMethod: 'CASH' as const, transactionReference: 'CASH-REFUND', receiptFileId: ids.file, confirmed: false }
    await expect(recordReturnSettlement(ids.event, proof, 'not-confirmed')).rejects.toThrow('xác nhận')
    await expect(recordReturnSettlement(ids.event, { ...proof, confirmed: true, receiptFileId: 'LOCAL-PHOTO' }, 'not-stored')).rejects.toThrow('biên lai')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('preserves the setup statement from backend without adding the reservation prepayment', () => {
    const setup = { ...record, setupExitRequested: true, setupEarlyExit: true, rentalRefundCredit: 6000000,
      earlyTerminationFee: 2000000, totalDeductions: 2300000, netRefundAmount: 5700000, amountDueFromCustomer: 0, settlementBlocker: null }
    expect(isApiReturn(setup)).toBe(true)
    const html = renderToStaticMarkup(<ReturnSummary record={setup} />)
    expect(html).toContain('5.700.000')
    expect(html).toContain('Phí chấm dứt sớm một lần')
    expect(html).toContain('6.000.000')
    expect(isApiReturn({ ...setup, rentalRefundCredit: -1 })).toBe(false)
    expect(isApiReturn({ ...setup, earlyTerminationFee: '2000000' })).toBe(false)
  })
  it('manager review records deductions without calling payout or local store', async () => {
    state.actor = operationsActor('manager'); state.actor.permissions.push('returns:read', 'rentals:update')
    const fetch = respond({ data: { ...record, status: 'disputed' } })
    expect((await reviewDispute(ids.event, { damageFee: 10, cleaningFee: 0, lostItemFee: 0, overdueFee: 0, outstandingFee: 0,
      resolutionNote: 'TEST decision', proposedUnitStatus: 'available' })).status).toBe('disputed')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toContain('/review-dispute')
  })
  it('validates permissions, negative/fractional amounts and date before any request', async () => {
    const fetch = respond({ data: record })
    await expect(requestReturn('RNT-DEMO', '2026-10-25', '')).rejects.toThrow()
    await expect(requestReturn(ids.rental, '2026-02-30', '')).rejects.toThrow()
    expect(() => confirmReturn(ids.event, 'disputed', '')).toThrow()
    expect(() => reviewDispute(ids.event, { damageFee: 0.001, cleaningFee: 0, lostItemFee: 0, overdueFee: 0, outstandingFee: 0, resolutionNote: 'TEST', proposedUnitStatus: 'available' })).toThrow()
    state.actor = operationsActor('staff'); state.actor.permissions = []
    await expect(listReturns('staff')).rejects.toThrow('quyền')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('requires a facility scope for Business return reads and accepts a scoped Business actor', async () => {
    state.actor = {
      ...operationsActor('manager'),
      roles: ['BUSINESS'],
      permissions: ['returns:read'],
      facilityScopes: { '00000000-0000-0000-0000-000000000000': 'MANAGE' },
    }
    respond({ data: [record], pagination: { page: 0, pageSize: 20, totalItems: 1, totalPages: 1, sort: 'createdAt: DESC' }, correlationId: 'test-bo' })
    await expect(listReturns('business')).rejects.toThrow('contract')

    state.actor = { ...state.actor, facilityScopes: { [ids.facility]: 'MANAGE' } }
    respond({ data: [record], pagination: { page: 0, pageSize: 20, totalItems: 1, totalPages: 1, sort: 'createdAt: DESC' }, correlationId: 'test-bo' })
    const page = await listReturns('business')
    expect(page.data).toHaveLength(1)
    expect(page.data[0].id).toBe(record.id)

    respond({ data: record })
    const detail = await getReturn('business', ids.event)
    expect(detail.id).toBe(record.id)
  })
})
