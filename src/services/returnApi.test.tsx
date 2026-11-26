import { CustomerClearance } from '../views/return-api/ReturnClearance'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { setAccessToken, clearAuthTokens } from './apiClient'
import { setCustomerClearance, completeRefund, recordReturnSettlement, isApiReturn, requestReturn, listReturns, getReturn, inspectReturn, reviewDispute, confirmReturn, paySettlement, reopenReturnVerification, verifyReturnIdentity, returnError, uploadReturnEvidence, type ApiReturn } from './returnApi'
import ReturnApiPanel, { ReturnSummary } from '../views/return-api/ReturnApiPanel'
import ReturnAttendance, { requiresReturnAttendance } from '../views/return-api/ReturnAttendance'
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
  it('explains when an approved handover returns to manager review', () => {
    const overdue = new Date(Date.now() - 60_000).toISOString()
    const item: ApiReturn = {
      ...record, status: 'scheduled', returnType: 'INVENTORY_MISMATCH',
      attendance: {
        arrivedAt: overdue, evidenceId: ids.file, expiresAt: overdue, attempts: 1,
        verifiedAt: overdue, reviewStartsAt: overdue, reviewAccepted: true, handoverDueAt: overdue,
      },
    }
    const html = renderToStaticMarkup(<ReturnAttendance record={item} role="staff" editable onChanged={() => {}} />)
    expect(html).toContain('Đã quá hạn bàn giao sau đối soát')
    expect(html).toContain('quay lại chờ Quản lý rà soát')
    expect(html).not.toContain('Quản lý đã cho phép tiếp tục bàn giao.')
  })
  it('shows the arrival photo and CCCD in one verification form', () => {
    const attendance: NonNullable<ApiReturn['attendance']> = {
      arrivedAt: null, evidenceId: null, expiresAt: null, attempts: 0,
      verifiedAt: null, reviewStartsAt: null, reviewAccepted: null,
    }
    const pending = { ...record, status: 'scheduled' as const, returnType: 'INVENTORY_MISMATCH' as const, attendance }
    const render = (item: ApiReturn) => renderToStaticMarkup(<ReturnAttendance record={item} role="staff" editable onChanged={() => {}} />)
    expect(requiresReturnAttendance(pending)).toBe(true)
    expect(render(pending)).not.toContain('Ghi nhận khách đã đến')
    expect(render(pending)).toContain('Số CCCD trên giấy tờ gốc')
    expect(render(pending)).toContain('Ảnh hiện trường chứng minh khách đã đến')
    expect(render(pending)).toMatch(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>Xác minh danh tính<\/button>/)

    const arrivedAt = new Date().toISOString()
    const arrived = { ...pending, attendance: { ...attendance, arrivedAt, evidenceId: ids.file } }
    expect(render(arrived)).toContain('Số CCCD trên giấy tờ gốc')
    expect(render(arrived)).not.toContain('Ảnh hiện trường chứng minh khách đã đến')
    expect(render({ ...arrived, attendance: { ...arrived.attendance, verifiedAt: arrivedAt } })).toContain('Đã xác minh danh tính')
    expect(requiresReturnAttendance({ ...pending, status: 'recovery_required' })).toBe(false)
  })

  it('sends initial arrival evidence directly to the identity endpoint', async () => {
    const staff = operationsActor('staff')
    state.actor = { ...staff, permissions: [...staff.permissions, 'returns:read', 'returns:process'] }
    const fetch = respond({ data: record })
    await verifyReturnIdentity(record.id, ids.event, 'TEST99999', undefined, ids.file)
    expect(fetch.mock.calls[0][0]).toContain(`/api/staff/returns/${record.id}/identity`)
    expect(JSON.parse(fetch.mock.calls[0][1].body).evidenceId).toBe(ids.file)
  })

  it('allows the manager to reopen a failed verification once and lets staff submit against that session', async () => {
    const attendance: NonNullable<ApiReturn['attendance']> = {
      arrivedAt: '2026-10-20T01:00:00Z', expiresAt: '2026-10-20T01:30:00Z', evidenceId: ids.event,
      attempts: 2, verifiedAt: null, reviewStartsAt: new Date(Date.now() - 60_000).toISOString(), reviewAccepted: null,
    }
    const waiting = { ...record, status: 'scheduled' as const, attendance }
    const manager = operationsActor('manager')
    state.actor = { ...manager, permissions: [...manager.permissions, 'returns:read'] }
    const managerHtml = renderToStaticMarkup(<ReturnAttendance record={waiting} role="manager" editable onChanged={() => {}} />)
    expect(managerHtml).toContain('Mở lại phiên xác minh')
    const session = '2026-10-20T02:00:00.123456Z'
    const updated = { ...waiting, attendance: { ...attendance, reverificationStartedAt: session } }
    const managerFetch = respond({ data: updated })
    await reopenReturnVerification(record.id, ids.staff, 'Khách có giấy tờ gốc')
    expect(managerFetch.mock.calls[0][0]).toContain(`/api/manager/returns/${record.id}/identity-reopen`)
    expect(renderToStaticMarkup(<ReturnAttendance record={updated} role="manager" editable onChanged={() => {}} />))
      .not.toContain('Mở lại phiên xác minh')

    const staff = operationsActor('staff')
    state.actor = { ...staff, permissions: [...staff.permissions, 'returns:read', 'returns:process'] }
    const staffFetch = respond({ data: updated })
    await verifyReturnIdentity(record.id, ids.event, 'TEST99999', session)
    expect(JSON.parse(staffFetch.mock.calls[0][1].body).reverificationStartedAt).toBe(session)
  })

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
  it('restores the clearance time and revoke action from the owner detail response', async () => {
    const cleared: ApiReturn = { ...record, status: 'scheduled', customerClearedAt: '2026-11-25T01:00:00Z', clearanceRevision: 2,
      recoveryEligibleAt: '2026-11-27T17:00:00Z' }
    const fetch = respond({ data: cleared })
    await setCustomerClearance({ ...cleared, customerClearedAt: null }, true)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ cleared: true, clearanceRevision: 2 })
    respond({ data: cleared })
    const loaded = await getReturn('customer', cleared.id)
    const html = renderToStaticMarkup(<CustomerClearance record={loaded} busy={false} run={vi.fn()} ownerId={ids.customer} />)
    expect(html).toContain('Thu hồi xác nhận dọn kho')
    expect(html).toContain('2026-11-25T01:00:00Z')
    expect(html).toContain('Hạn cuối dọn kho')
    expect(html).toContain('28/11/2026 00:00:00')
    const mismatch = renderToStaticMarkup(<CustomerClearance record={{ ...loaded, returnType: 'INVENTORY_MISMATCH',
      inventoryRemovalDeadlineAt: '2026-11-30T17:00:00Z' }} busy={false} run={vi.fn()} ownerId={ids.customer} />)
    expect(mismatch).toContain('01/12/2026 00:00:00')
    expect(mismatch).not.toContain('28/11/2026 00:00:00')
    const inspected = renderToStaticMarkup(<CustomerClearance record={{ ...loaded, status: 'payment_due', customerClearedAt: null }} busy={false} run={vi.fn()} ownerId={ids.customer} />)
    expect(inspected).toContain('aria-current="step"')
    expect(inspected).not.toContain('Hạn cuối dọn kho')
    expect(inspected).not.toContain('<button')
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
    await expect(paySettlement(ids.event, 'CASH', 'Khách tự khai đã thanh toán')).rejects.toMatchObject({
      diagnosticMessage: expect.stringContaining('thanh toán tại cơ sở'),
    })
    expect(fetch.mock.calls[0][0]).toContain(`/api/customer/returns/${ids.event}/pay-settlement`)
  })
  it('sends inspection with explicit deductions and returned-access items', async () => {
    state.actor = operationsActor('staff'); state.actor.permissions.push('returns:process', 'returns:read')
    const fetch = respond({ data: record })
    await inspectReturn(ids.event, { damageFee: 5000, cleaningFee: 0, lostItemFee: 0, overdueFee: 0, outstandingFee: 0,
      inventoryMatch: 'match', damageClassification: 'minor_damage', staffNotes: 'TEST inspection', evidencePhotos: [],
      unitVacated: true, returnedKey: true, returnedCard: false, returnedLock: true,
      lockInspectionResult: 'RETURNED_USABLE', proposedUnitStatus: 'maintenance' })
    expect(fetch.mock.calls[0][0]).toContain(`/api/staff/returns/${ids.event}/inspection`)
    expect(JSON.parse(fetch.mock.calls[0][1].body).returnedCard).toBe(false)
    expect(JSON.parse(fetch.mock.calls[0][1].body).unitVacated).toBe(true)
    expect(JSON.parse(fetch.mock.calls[0][1].body).lockInspectionResult).toBe('RETURNED_USABLE')
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
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ ...proof, transactionReference: '' })
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
  it('omits Thu gọn and Trải ra toggle buttons when role is customer', () => {
    state.actor = operationsActor('customer')
    respond({ data: [record], pagination: { page: 0, pageSize: 10, totalItems: 1, totalPages: 1 } })
    const html = renderToStaticMarkup(<ReturnApiPanel role="customer" rentalActive={true} rentalId={ids.rental} />)
    expect(html).not.toContain('Thu gọn')
    expect(html).not.toContain('Trải ra')
  })
})
