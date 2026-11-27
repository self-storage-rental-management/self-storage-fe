import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CheckInCase, InventoryVisit } from '../../services/checkInApi'
import StaffInventoryVisitPanel from './StaffInventoryVisitPanel'

const appointmentAt = '2026-11-03T03:00:00Z'
const arrivedAt = '2026-11-03T02:45:00Z'
const deadline = '2026-11-08T08:00:00Z'
const visit: InventoryVisit = { appointmentAt, arrivedAt: null, identityVerifiedAt: null, verifiedByName: null, photoId: null }

function render(inventoryVisit: InventoryVisit | null, now = Date.parse('2026-11-03T02:45:00Z')) {
  const item = { checkInId: 'checkin-1', checkInStatus: 'setup_completed', inventoryResolutionStatus: 'NOT_STARTED',
    inventoryFinalDeadlineAt: deadline, inventoryVisit } as CheckInCase
  return renderToStaticMarkup(<StaffInventoryVisitPanel item={item} now={now} busy={false}
    onBusyChange={vi.fn()} onSaved={vi.fn()} onPreview={vi.fn()} />)
}

describe('staff inventory visit', () => {
  it('shows the identity document declared on the reservation for comparison', () => {
    const item = { checkInId: 'checkin-1', checkInStatus: 'setup_completed', inventoryResolutionStatus: 'NOT_STARTED',
      inventoryFinalDeadlineAt: deadline, identityDocumentNumber: '079203009988', inventoryVisit: { ...visit, arrivedAt } } as CheckInCase
    const html = renderToStaticMarkup(<StaffInventoryVisitPanel item={item} now={Date.parse('2026-11-03T02:45:00Z')} busy={false}
      onBusyChange={vi.fn()} onSaved={vi.fn()} onPreview={vi.fn()} />)
    expect(html).toContain('CCCD hoặc hộ chiếu khách đã khai báo')
    expect(html).toContain('079203009988')
  })

  it('asks to confirm the customer arrival before showing any identity form', () => {
    const html = render(visit)
    // Arrival confirmation is its own step and starts the 72h clock.
    expect(html).toContain('Xác nhận khách đến kiểm kê')
    expect(html).toContain('thời hạn 72 giờ hoàn tất kiểm kê bắt đầu tính')
    // The identity confirmation form only appears after arrival is confirmed.
    expect(html).not.toContain('Số CCCD hoặc hộ chiếu trên giấy tờ gốc')
    expect(html).not.toContain('Ảnh đối chiếu khách lúc kiểm kê')
    expect(html).not.toContain('Xác minh người đặt kho')
  })

  it('opens the identity confirmation form once arrival is recorded', () => {
    const html = render({ ...visit, arrivedAt })
    expect(html).toContain('Đã xác nhận khách đến lúc')
    expect(html).toContain('Số CCCD hoặc hộ chiếu trên giấy tờ gốc')
    expect(html).toContain('Ảnh đối chiếu khách lúc kiểm kê')
    expect(html).toContain('người đặt kho trực tiếp có mặt')
    expect(html).not.toContain('Xác nhận khách đến kiểm kê')
  })

  it('offers the arrival action only with an appointment inside the deadline', () => {
    expect(render(null)).not.toContain('Xác nhận khách đến kiểm kê')
    expect(render(visit, Date.parse(deadline))).toContain('Đã quá hạn kiểm kê')
    expect(render(visit, Date.parse(deadline))).not.toContain('Xác nhận khách đến kiểm kê')
  })

  it('requires the booking customer and a photo before enabling identity verification', () => {
    const html = render({ ...visit, arrivedAt })
    expect(html).not.toContain('Giờ khách đến thực tế')
    for (const label of ['Khách báo chuẩn bị xong', 'Giờ hẹn', 'Mốc nhắc', 'Hạn kiểm kê']) expect(html).not.toContain(label)
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Xác minh người đặt kho<\/button>/)
  })

  it('shows the recorded verifier and opens the restricted evidence only by action', () => {
    const html = render({ ...visit, arrivedAt, identityVerifiedAt: '2026-11-03T02:50:00Z',
      verifiedByName: 'Nhân viên A', photoId: 'private-identity-file' })
    expect(html).toContain('Đã xác minh lúc 03/11/2026 09:50:00 bởi Nhân viên A.')
    expect(html).toContain('Xem ảnh xác minh')
    expect(html).not.toContain('private-identity-file')
  })
})
