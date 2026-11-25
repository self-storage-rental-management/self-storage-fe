import { apiRequest } from './apiClient'

export interface CashflowReport {
  facilityId: string; from: string; to: string; snapshotAt: string; completeness: 'RECORDED' | 'PARTIAL'; firstPaymentDate?: string | null
  collected: number; refunded: number; netRetained: number; pendingRefund: number; pendingApprovalRefund: number; securityDepositHeld: number | null
  daily: { day: string; collected: number; refunded: number; net: number }[]
  monthly: { month: string; collected: number; refunded: number; net: number }[]
  settlements: { id: string; reservationCode: string; customerName: string; status: string; reason: string; deposit: number | null; rentalCredit: number | null; deductions: number | null; refund: number; paidAt: string | null; reference: string | null; receiptCode?: string | null; payoutRecorded: boolean }[]
  warnings: string[]
}

export async function getManagerCashflow(facilityId: string, from?: string, to?: string): Promise<CashflowReport> {
  const query = new URLSearchParams({ facilityId })
  if (from) query.set('from', from)
  if (to) query.set('to', to)
  const response = await apiRequest<{ data: CashflowReport }>(`/api/manager/reports/cashflow?${query}`)
  const r = response.data
  const money = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
  const pendingApprovalRefund = r?.pendingApprovalRefund ?? 0
  const daily = Array.isArray(r?.daily) ? r.daily : []
  if (!r || r.facilityId !== facilityId || !['RECORDED', 'PARTIAL'].includes(r.completeness)
    || !(r.firstPaymentDate === undefined || r.firstPaymentDate === null || (typeof r.firstPaymentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.firstPaymentDate)))
    || ![r.collected, r.refunded, r.netRetained, r.pendingRefund, pendingApprovalRefund].every(money)
    || !(r.securityDepositHeld === null || money(r.securityDepositHeld))
    || Math.abs(r.collected - r.refunded - r.netRetained) > 0.01
    || !daily.every(d => typeof d.day === 'string' && [d.collected, d.refunded, d.net].every(money) && Math.abs(d.collected - d.refunded - d.net) < 0.01)
    || !Array.isArray(r.monthly) || !r.monthly.every(m => typeof m.month === 'string' && [m.collected, m.refunded, m.net].every(money) && Math.abs(m.collected - m.refunded - m.net) < 0.01)
    || !Array.isArray(r.settlements) || !r.settlements.every(s => typeof s.id === 'string' && typeof s.payoutRecorded === 'boolean' && [s.deposit, s.rentalCredit, s.deductions].every(v => v === null || money(v)) && money(s.refund))
    || !Array.isArray(r.warnings)) throw new Error('Không xác minh được báo cáo dòng tiền từ máy chủ.')
  return { ...r, pendingApprovalRefund, daily }
}
