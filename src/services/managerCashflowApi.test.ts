import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from './apiClient'
import { getManagerCashflow } from './managerCashflowApi'
vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))
const report = { facilityId: 'f1', from: '2026-11-01', to: '2026-11-24', snapshotAt: '2026-11-24T00:00:00Z', completeness: 'RECORDED', firstPaymentDate: '2026-11-01', collected: 1000, refunded: 300, netRetained: 700, pendingRefund: 200, pendingApprovalRefund: 400, securityDepositHeld: 100, daily: [{ day: '2026-11-24', collected: 1000, refunded: 300, net: 700 }], monthly: [{ month: '2026-11', collected: 1000, refunded: 300, net: 700 }], settlements: [], warnings: [] }
beforeEach(() => vi.mocked(apiRequest).mockReset())
it('uses facility and date filters and preserves pending refunds separately from actual net', async () => {
  vi.mocked(apiRequest).mockResolvedValue({ data: report })
  const result = await getManagerCashflow('f1', '2026-11-01', '2026-11-24')
  expect(apiRequest).toHaveBeenCalledWith('/api/manager/reports/cashflow?facilityId=f1&from=2026-11-01&to=2026-11-24')
  expect(result.netRetained).toBe(700)
  expect(result.pendingRefund).toBe(200)
  expect(result.pendingApprovalRefund).toBe(400)
})
it('keeps a legacy report visible while the backend is restarted', async () => {
  const { firstPaymentDate: _firstPaymentDate, daily: _daily, pendingApprovalRefund: _pendingApprovalRefund, ...legacyReport } = report
  vi.mocked(apiRequest).mockResolvedValue({ data: legacyReport })
  const result = await getManagerCashflow('f1')
  expect(result.collected).toBe(1000)
  expect(result.firstPaymentDate).toBeUndefined()
  expect(result.pendingApprovalRefund).toBe(0)
  expect(result.daily).toEqual([])
})
it.each([{ facilityId: 'other' }, { netRetained: 500 }, { collected: null }, { monthly: [{ month: '2026-11', collected: 1000, refunded: 300, net: 500 }] }])('rejects inconsistent or wrong-scope financial data %j', async patch => {
  vi.mocked(apiRequest).mockResolvedValue({ data: { ...report, ...patch } })
  await expect(getManagerCashflow('f1')).rejects.toThrow()
})
