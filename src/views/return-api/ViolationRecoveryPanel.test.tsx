import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import { RecoveryAction, RecoveryAttendance, RecoveryDetails, RecoveryGroupedItems, RecoveryPagination, RecoverySourceGoods } from './ViolationRecoveryPanel'

const entry: ComponentProps<typeof RecoveryDetails>['entry'] = {
  id: 'case-19', taskId: 'task-19', unitCode: 'TEST-M-19', staffName: 'Nhân viên',
  stage: 'AWAITING_ATTENDANCE', reason: 'INVENTORY_TIMEOUT', owner: 'STAFF', needsWitness: true,
  scheduledAt: null, deadlineAt: null, actionDueAt: null, overdueAt: null, responseDueAt: null,
  reply: null, pickupDueAt: null, financePending: false, reasonNote: null, customerNote: null, report: null,
  verificationAttempts: 2, pickupAttempts: 0, attendance: 'PRESENT', attendanceEvidenceId: 'attendance-photo',
  verification: { used: 2, limit: 2, remaining: 0, matched: false, canReceiveItems: false,
    message: 'Xác minh không thành công sau 2/2 lượt. Thu hồi vẫn tiếp tục theo lịch; hàng được lưu tạm với nhân chứng.' },
  items: [], actions: [],
}

describe('recovery evidence and verification feedback', () => {
  it('shows the correct range and total on the final customer page', () => {
    const html = renderToStaticMarkup(<RecoveryPagination pagination={{ page: 1, pageSize: 8, totalItems: 13, totalPages: 2 }} disabled={false} onChange={() => {}} />)
    expect(html).toContain('Hiển thị 9–13 trong 13 hồ sơ · Trang 2/2')
    expect(html).toContain('aria-current="page"')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Sau<\/button>/)
    expect(html).not.toContain('Trang 3')
  })
  it('keeps identical declared goods grouped while retaining their images and handling requirements', () => {
    const goods = { code: 'HH-1', name: 'Thùng tài liệu', category: 'DOCUMENTS', categoryName: null, material: 'Giấy', quantity: 50,
      lengthCm: 40, widthCm: 30, heightCm: 20, weightKg: 5, fragile: false, stackable: true, maxStackLayers: 3,
      allowHorizontalPlacement: false, description: 'Hồ sơ trong thùng carton', note: 'Giữ khô ráo',
      images: [{ id: 'photo-1', name: 'hang.jpg', contentType: 'image/jpeg' }] }
    const html = renderToStaticMarkup(<RecoverySourceGoods data={{ packaging: 'Thùng carton',
      declared: [goods, { ...goods, code: 'HH-2', images: [{ ...goods.images[0], id: 'photo-2' }] }],
      inventory: { available: false, recordedBy: null, publishedAt: null, packageCount: null, mismatchSummary: null,
        decisionNote: null, notes: null, goodsCondition: null, unitCondition: null, goods: [], evidence: [] } }} />)
    expect(html.match(/class="recovery-item-card"/g)).toHaveLength(1)
    expect(html).toContain('100 kiện')
    expect(html).toContain('500 kg')
    expect(html).toContain('2,4 m³')
    expect(html).toContain('Sách &amp; hồ sơ')
    expect(html).toContain('Phương thức đóng gói chung:')
    expect(html).toContain('Được phép xếp chồng')
    expect(html).toContain('Số lớp xếp tối đa')
    expect(html).toContain('Được phép đặt nằm ngang')
    expect(html).toContain('Giữ khô ráo')
    expect(html).toContain('HH-1, HH-2')
    expect(html).toContain('Xem ảnh')
    expect(html).toContain('(2)')
    expect(html).not.toContain('DOCUMENTS')
  })
  it('shows the exhausted recovery verification to the customer without relying on an evidence photo', () => {
    const html = renderToStaticMarkup(<RecoveryAttendance entry={{ ...entry, stage: 'COMPLETED', attendanceEvidenceId: null }} />)
    expect(html).toContain('không thành công sau 2/2 lượt khi thu hồi')
    expect(html).toContain('cần xác minh lại khi nhận hàng')
    expect(html).not.toContain('Ảnh')
  })
  it('explains an absent customer separately from identity verification', () => {
    const html = renderToStaticMarkup(<RecoveryAttendance entry={{ ...entry, stage: 'COMPLETED',
      attendance: 'ABSENT', verificationAttempts: 0, verification: null, attendanceEvidenceId: null }} />)
    expect(html).toContain('Khách vắng mặt khi thu hồi')
    expect(html).toContain('Cần xác minh danh tính khi đến nhận lại hàng')
  })
  it('makes the pickup deadline prominent and distinguishes it from an appointment', () => {
    const html = renderToStaticMarkup(<RecoveryDetails entry={{ ...entry, stage: 'COMPLETED',
      pickupDueAt: '2026-12-03T16:05:00Z', pickupAppointmentAt: '2026-12-01T03:00:00Z',
      items: [{ code: '19-A', name: 'Tài liệu', condition: 'Nguyên vẹn', location: null, disposition: 'STORED', releasedAt: null }] }} />)
    expect(html).toContain('Hạn cuối nhận hàng lưu tạm')
    expect(html).toContain('23:05 03/12/2026')
    expect(html).toContain('Lịch hẹn nhận hàng')
    expect(html).toContain('10:00 01/12/2026')
    expect(html).not.toContain('Hẹn nhận tài sản lưu tạm')
  })
  it('sets a latest date and time on the pickup scheduling input', () => {
    const html = renderToStaticMarkup(<RecoveryAction entry={{ ...entry, pickupDueAt: '2100-12-03T16:05:00Z',
      actions: ['SCHEDULE_PICKUP'] }} action="SCHEDULE_PICKUP" onBack={() => {}} onSaved={() => {}} />)
    expect(html).toContain('max="2100-12-03T23:05"')
    expect(html).toContain(' min="')
    expect(html).toContain('Hạn cuối nhận hàng lưu tạm')
    expect(html).toContain('Ngày giờ nhận hàng (giờ Việt Nam)')
  })
  it('defaults completed recovery to the delivery stage and labels only its verification', () => {
    const html = renderToStaticMarkup(<RecoveryDetails entry={{ ...entry, stage: 'COMPLETED',
      items: [{ code: '19-A', name: 'Tài liệu', condition: 'Nguyên vẹn', location: 'Khu A', disposition: 'STORED', releasedAt: null }],
      pickupVerification: { used: 1, limit: 2, remaining: 1, matched: true, canReceiveItems: true, message: 'Xác minh thành công cho phiên nhận hàng.' } }} />)
    expect(html).toContain('Chặng 2 · Giao hàng lưu tạm')
    expect(html).toContain('Xác minh danh tính người nhận hàng')
    expect(html).not.toContain('không thành công sau 2/2')
    expect(html).not.toContain('Lịch sử xử lý')
  })
  it('renders one goods card and a collapsed unique photo for a hundred identical parcels', () => {
    const items = Array.from({ length: 100 }, (_, index) => ({ code: `BOX-${index}`, name: 'Tài liệu', condition: 'Nguyên vẹn', location: 'Khu A', disposition: 'STORED', releasedAt: null, evidenceId: 'shared-photo' }))
    const html = renderToStaticMarkup(<RecoveryGroupedItems items={items} />)
    expect(html.match(/class="recovery-item-card"/g)).toHaveLength(1)
    expect(html).toContain('100 kiện')
    expect(html).toContain('1 loại hàng')
    expect(html).toContain('Xem ảnh')
    expect(html).not.toContain('<img')
  })
  it('separates arrival photos from recovery evidence and explains exhausted verification attempts', () => {
    const html = renderToStaticMarkup(<RecoveryDetails entry={entry} />)
    expect(html).toContain('Ảnh ghi nhận khách đến')
    expect(html).not.toContain('Bằng chứng thu hồi')
    expect(html).toContain('không thành công sau 2/2')
    expect(html).toContain('Còn 0 lượt')
    expect(html).toContain('Thu hồi vẫn tiếp tục')
  })
  it('shows genuine before and after evidence separately once recovery has taken place', () => {
    const html = renderToStaticMarkup(<RecoveryDetails entry={{ ...entry, beforeEvidenceId: 'before', afterEvidenceId: 'after' }} />)
    expect(html.indexOf('Ảnh ghi nhận khách đến')).toBeLessThan(html.indexOf('Bằng chứng thu hồi'))
    expect(html).toContain('Ảnh trước thu hồi')
    expect(html).toContain('Ảnh sau thu hồi')
  })
  it('labels evidence of an absent customer correctly', () => {
    const html = renderToStaticMarkup(<RecoveryDetails entry={{ ...entry, attendance: 'ABSENT' }} />)
    expect(html).toContain('Ảnh ghi nhận khách vắng mặt')
    expect(html).not.toContain('Ảnh ghi nhận khách đến')
  })
})
