import { apiRequest, ApiClientError } from './apiClient'
import { getAuthenticatedActor } from './authApi'
import { isUuid } from './renewalOperationsApi'

export async function requestVnpayRefund(paymentId: string, amount: number, reason: string) {
  const actor = getAuthenticatedActor()
  if (!actor || actor.status !== 'ACTIVE' || (!actor.roles.includes('MANAGER') && !actor.roles.includes('BUSINESS') && !actor.roles.includes('ADMIN'))) {
    throw new ApiClientError('Bạn không có quyền hoàn tiền VNPay.', { status: 403 })
  }
  if (!actor.permissions.includes('refunds:approve')) {
    throw new ApiClientError('Bạn chưa có quyền duyệt hoàn tiền.', { status: 403 })
  }
  if (!isUuid(paymentId) || !Number.isFinite(amount) || amount <= 0 || amount > 999999999999.99 || !reason.trim() || reason.length > 1000) {
    throw new Error('Nhập khoản hoàn và lý do hợp lệ.')
  }
  const base = actor.roles.includes('MANAGER') && !actor.roles.includes('BUSINESS') && !actor.roles.includes('ADMIN')
    ? '/api/manager/payments'
    : '/api/business/payments'
  return apiRequest(`${base}/${paymentId}/vnpay/refund`, {
    method: 'POST',
    body: JSON.stringify({ amount: Math.round(amount * 100) / 100, reason: reason.trim() }),
  })
}
