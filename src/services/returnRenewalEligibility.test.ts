import { afterEach, expect, it, vi } from 'vitest'
import { getReturnRenewalEligibility, getRenewalCancellationPolicy } from './returnRenewalEligibility'

afterEach(() => vi.unstubAllGlobals())
const base = { rentalId: 'r1', allowed: false, renewalId: 'n1', state: 'DEPOSIT_PAID', message: 'Cọc gia hạn không hoàn lại khi tự hủy.', paidAmount: 20, depositAmount: 20 }
function respond(data: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data }), { headers: { 'Content-Type': 'application/json' } })))
}
it('reads the server decision and exact renewal cancellation policy', async () => {
  respond(base)
  expect(await getReturnRenewalEligibility('r1')).toEqual(base)
  respond(base)
  expect(await getRenewalCancellationPolicy('n1')).toEqual(base)
})
it.each([
  { rentalId: 'another-rental' }, { allowed: true }, { state: 'UNKNOWN' }, { message: null }, { paidAmount: -1 },
])('rejects inconsistent eligibility instead of unlocking return: %j', async patch => {
  respond({ ...base, ...patch })
  await expect(getReturnRenewalEligibility('r1')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
})
it('rejects a cancellation policy belonging to another renewal', async () => {
  respond({ ...base, renewalId: 'another-renewal' })
  await expect(getRenewalCancellationPolicy('n1')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
})
it('accepts returning under the updated contract once renewal has completed', async () => {
  const allowed = { ...base, allowed: true, renewalId: null, state: 'ALLOWED', message: null, paidAmount: 0, depositAmount: 0 }
  respond(allowed)
  expect((await getReturnRenewalEligibility('r1')).allowed).toBe(true)
})
it('reads the fully paid warning without unlocking return prematurely', async () => {
  respond({ ...base, state: 'FULLY_PAID', paidAmount: 100 })
  expect(await getReturnRenewalEligibility('r1')).toMatchObject({ state: 'FULLY_PAID', allowed: false, paidAmount: 100 })
})
