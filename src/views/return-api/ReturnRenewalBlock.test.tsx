import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import ReturnRenewalBlock from './ReturnRenewalBlock'
import type { ReturnRenewalEligibility } from '../../services/returnRenewalEligibility'

it.each([
  ['UNPAID', 'Hồ sơ đang có yêu cầu gia hạn chưa thanh toán. Vui lòng vào Gia hạn để hủy yêu cầu trước khi trả kho.'],
  ['DEPOSIT_PAID', 'Bạn đã thanh toán cọc gia hạn. Tiền cọc gia hạn không được hoàn lại khi bạn tự hủy.'],
  ['FULLY_PAID', 'Bạn đã thanh toán đủ tiền gia hạn. Vui lòng vào Gia hạn để hủy và xác nhận toàn bộ tiền gia hạn đã thanh toán không được hoàn lại trước khi trả kho.'],
  ['RECONCILIATION_REQUIRED', 'Khoản thanh toán gia hạn cần được cơ sở đối soát trước khi hủy gia hạn và trả kho.'],
] as const)('shows the %s explanation and disables return operations', (state, message) => {
  const gate: ReturnRenewalEligibility = { rentalId: 'r1', renewalId: 'n1', allowed: false, state, message, paidAmount: 20, depositAmount: 20 }
  const html = renderToStaticMarkup(<ReturnRenewalBlock gate={gate} loading={false} onRetry={vi.fn()} onOpenRenewal={vi.fn()} />)
  expect(html).toContain(message)
  expect(html).toMatch(/<fieldset[^>]*disabled=""/)
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Gửi yêu cầu trả kho<\/button>/)
  const navigation = html.match(/<button[^>]*>Đến yêu cầu gia hạn<\/button>/)?.[0]
  expect(navigation).toBeDefined()
  expect(navigation).not.toContain('disabled=""')
})

it('keeps return disabled while eligibility is loading or cannot be verified', () => {
  const loading = renderToStaticMarkup(<ReturnRenewalBlock loading onRetry={vi.fn()} />)
  expect(loading).toContain('Đang kiểm tra yêu cầu gia hạn')
  expect(loading).toMatch(/<fieldset[^>]*disabled=""/)
  const error = renderToStaticMarkup(<ReturnRenewalBlock loading={false} error="Chưa tải được điều kiện trả kho" onRetry={vi.fn()} />)
  expect(error).toContain('Chưa tải được điều kiện trả kho')
  expect(error).toMatch(/<fieldset[^>]*disabled=""/)
})
