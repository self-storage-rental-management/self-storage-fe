import ReturnAttendance from './ReturnAttendance'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CustomerClearance } from './ReturnClearance'
import { ReturnSummary } from './ReturnApiPanel'
import type { ApiReturn } from '../../services/returnApi'

const record = {
 id: 'return-1', customerId: 'customer-1', status: 'requested', returnType: 'INVENTORY_MISMATCH',
 unitNumber: 'CUSTOM-001', facilityName: 'Cơ sở riêng',
 inventoryRemovalDeadlineAt: '2099-11-30T17:00:00Z', returnWindowDays: 7,
 returnExtensionCount: 0, maxReturnExtensions: 2, canExtendReturnWindow: true,
} as ApiReturn

describe('configured mismatch return deadlines', () => {
 it.each([2, 3, 4, 5, 8])('shows %i days consistently in the customer action, preview and staff/manager summary', days => {
  const value = { ...record, returnExtensionDays: days }
  const html = renderToStaticMarkup(<CustomerClearance record={value} ownerId="customer-1" busy={false} run={async () => {}} />)
  expect(html).toContain(`Gia hạn dọn hàng thêm ${days} ngày`)
  expect(html).toContain(`${days} ngày/lần`)
  expect(html).toContain(`Gia hạn thêm ${days} ngày`)
  const summary = renderToStaticMarkup(<ReturnSummary record={value} />)
  expect(summary).toContain(`Gia hạn mỗi lần tối đa: ${days} ngày`)
  expect(summary).toContain('Thời hạn trả kho đã chốt: 7 ngày')
 })
 it('does not invent two days or allow a preview when the snapshot is missing', () => {
  const html = renderToStaticMarkup(<CustomerClearance record={record} ownerId="customer-1" busy={false} run={async () => {}} />)
  expect(html).not.toContain('thêm 2 ngày')
  expect(html).not.toContain('Hạn cuối dọn kho sẽ dời đến')
  expect(html).toContain('Chưa có thông tin số ngày gia hạn')
 })
 it('uses the loaded snapshot as a fallback instead of a fixed number', () => {
  const html = renderToStaticMarkup(<CustomerClearance record={record} ownerId="customer-1" busy={false} run={async () => {}} extension={{ count: 0, days: 6, onExtend: () => {} }} />)
  expect(html).toContain('Gia hạn dọn hàng thêm 6 ngày')
 })
})

it.each(['staff', 'manager'] as const)('shows the configured return extension in the %s arrival screen', role => {
 const html = renderToStaticMarkup(<ReturnAttendance record={{...record, returnExtensionDays: 4, attendance: {attempts: 0} as ApiReturn['attendance']}} role={role} editable={false} onChanged={() => {}} />)
 expect(html).toContain('Thời hạn trả kho đã chốt: 7 ngày')
 expect(html).toContain('Gia hạn mỗi lần tối đa: 4 ngày')
})
