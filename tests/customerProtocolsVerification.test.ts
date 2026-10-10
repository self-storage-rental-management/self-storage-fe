import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Khung Quy Định Vận Hành & Pháp Lý Sự Cố / Ẩm Mốc Trên Giao Diện Khách Hàng (Customer Protocols Verification)', () => {
  const customerAppPath = resolve(__dirname, '../src/views/customer/CustomerApp.tsx')
  const customerAppContent = readFileSync(customerAppPath, 'utf8')

  // ----------------------------------------------------------------------------
  // 1. KIỂM TRA LOẠI BỎ TOÀN BỘ EMOJI ICON TRÊN CÁC HUY HIỆU & TIÊU ĐỀ
  // ----------------------------------------------------------------------------
  describe('Yêu cầu loại bỏ emoji icon ("bỏ icon đi nhá")', () => {
    it('không còn icon toà nhà (🏢 1) trong huy hiệu điều khoản kết cấu hạ tầng của khách hàng', () => {
      expect(customerAppContent).not.toContain('🏢 1')
      expect(customerAppContent).toContain('data-testid="customer-protocol-badge-1"')
    })

    it('không còn icon giọt nước (💧 2) trong huy hiệu điều khoản phân định ẩm mốc của khách hàng', () => {
      expect(customerAppContent).not.toContain('💧 2')
      expect(customerAppContent).toContain('data-testid="customer-protocol-badge-2"')
    })

    it('huy hiệu được định dạng số sạch sẽ với class styling phù hợp (số 1 và 2 thuần túy)', () => {
      const badge1Match = customerAppContent.match(/data-testid="customer-protocol-badge-1"[^>]*>([\s\S]*?)<\/span>/)
      expect(badge1Match).not.toBeNull()
      expect(badge1Match![1].trim()).toBe('1')

      const badge2Match = customerAppContent.match(/data-testid="customer-protocol-badge-2"[^>]*>([\s\S]*?)<\/span>/)
      expect(badge2Match).not.toBeNull()
      expect(badge2Match![1].trim()).toBe('2')
    })

    it('không còn ký hiệu cảnh báo emoji ⚠️ trong phần hiển thị nghiệm thu kết cấu kho khi trả kho', () => {
      expect(customerAppContent).not.toContain('⚠️ Dột nước')
      expect(customerAppContent).not.toContain('⚠️ Loang ố')
      expect(customerAppContent).not.toContain('⚠️ Thấm ẩm')
      expect(customerAppContent).not.toContain('⚠️ Nứt vỡ sàn')
      expect(customerAppContent).not.toContain('⚠️ Đọng nước')
    })
  })

  // ----------------------------------------------------------------------------
  // 2. KIỂM TRA HIỂN THỊ ĐẦY ĐỦ 2 CHÍNH SÁCH BO TRÊN TRANG QUY ĐỊNH (POLICIES PAGE)
  // ----------------------------------------------------------------------------
  describe('Hiển thị 2 chính sách BO trên trang Quy Định & Chính Sách Thuê Kho', () => {
    it('hiển thị tiêu đề chính xác của Card 1: Xử Lý Sự Cố Kết Cấu Hạ Tầng Kho', () => {
      expect(customerAppContent).toContain('Xử Lý Sự Cố Kết Cấu Hạ Tầng Kho (Sàn vỡ, Dột nóc, Kẹt cửa)')
    })

    it('hiển thị đầy đủ 3 quy tắc SLA của Card 1 cho khách hàng', () => {
      expect(customerAppContent).toContain('Lỗi kết cấu cơ sở (Facility Fault):')
      expect(customerAppContent).toContain('Cơ sở chịu 100% trách nhiệm. Xử lý P1 khẩn cấp trong 4-12h.')
      expect(customerAppContent).toContain('Kho đang có khách:')
      expect(customerAppContent).toContain('Kích hoạt luồng Di dời khẩn cấp (Relocation) sang kho trống tương đương, cấp mã PIN mới miễn phí và giữ nguyên hợp đồng.')
      expect(customerAppContent).toContain('Kho trống:')
      expect(customerAppContent).toContain('Lập tức chuyển sang MAINTENANCE, ẩn khỏi trang đặt kho để sửa chữa.')
    })

    it('hiển thị tiêu đề chính xác của Card 2: Phân Định Trách Nhiệm Ẩm Mốc Khi Trả Kho', () => {
      expect(customerAppContent).toContain('Phân Định Trách Nhiệm Ẩm Mốc Khi Trả Kho (Return Dispute)')
    })

    it('hiển thị đầy đủ 3 quy tắc phân định trách nhiệm của Card 2 cho khách hàng', () => {
      expect(customerAppContent).toContain('Vách/trần loang ố hoặc máy lạnh hỏng → Lỗi cơ sở:')
      expect(customerAppContent).toContain('Hoàn 100% cọc + bồi thường hàng + khóa kho sửa chữa.')
      expect(customerAppContent).toContain('Kho khô 100%, đồ mốc do khách cất ẩm/hàng cấm → Lỗi khách:')
      expect(customerAppContent).toContain('Tự chịu 100% + trừ phí khử trùng 1.500.000₫ vào cọc.')
      expect(customerAppContent).toContain('Kho thường (Standard):')
      expect(customerAppContent).toContain('Miễn trừ trách nhiệm độ ẩm tự nhiên theo cam kết hợp đồng.')
    })
  })

  // ----------------------------------------------------------------------------
  // 3. KIỂM TRA DANH SÁCH CHÍNH SÁCH VẬN HÀNH DO BO THIẾT LẬP (BO POLICIES SYNC)
  // ----------------------------------------------------------------------------
  describe('Đồng bộ danh sách chính sách vận hành từ BO (getStoredPolicies)', () => {
    it('sử dụng getStoredPolicies để lấy danh sách chính sách do BO cấu hình', () => {
      expect(customerAppContent).toContain('const storedPoliciesList = useMemo(() => getStoredPolicies(), [])')
    })

    it('hiển thị khối Danh Sách Tiêu Chuẩn & Quy Định Vận Hành Đang Áp Dụng trên trang Quy định', () => {
      expect(customerAppContent).toContain('Danh Sách Tiêu Chuẩn & Quy Định Vận Hành Đang Áp Dụng')
      expect(customerAppContent).toContain('Các quy định về độ ẩm kho mát, hàng cấm, phí khử trùng và SLA hỗ trợ được đồng bộ từ Ban Điều Hành (BO)')
    })
  })

  // ----------------------------------------------------------------------------
  // 4. KIỂM TRA CĂN CỨ PHÁP LÝ TRONG MODAL TRANH CHẤP TRẢ KHO (RETURN DISPUTE MODAL)
  // ----------------------------------------------------------------------------
  describe('Hiển thị căn cứ chính sách trong Modal Yêu Cầu Xem Xét Lại Quyết Toán (Dispute Modal)', () => {
    it('chứa khung căn cứ chính sách phân định trách nhiệm ẩm mốc khi khách hàng khiếu nại quyết toán', () => {
      expect(customerAppContent).toContain('Căn cứ: Phân Định Trách Nhiệm Ẩm Mốc Khi Trả Kho (Return Dispute)')
      expect(customerAppContent).toContain('Lỗi cơ sở (vách/trần loang ố, dột hoặc máy lạnh hỏng):')
      expect(customerAppContent).toContain('Lỗi khách hàng (kho khô 100%, đồ mốc do khách cất ẩm/hàng cấm):')
    })
  })

  // ----------------------------------------------------------------------------
  // 5. KIỂM TRA ĐIỀU KHOẢN HỢP ĐỒNG ĐIỆN TỬ (DIGITAL LEASE AGREEMENT)
  // ----------------------------------------------------------------------------
  describe('Điều khoản hợp đồng điện tử của khách hàng', () => {
    it('hợp đồng thuê có điều khoản cam kết sự cố kết cấu hạ tầng (Facility Fault)', () => {
      expect(customerAppContent).toContain('Sự cố kết cấu hạ tầng (Facility Fault): Cơ sở chịu 100% trách nhiệm, xử lý P1 trong 4-12h; kích hoạt di dời khẩn cấp 0đ sang kho tương đương và giữ nguyên hợp đồng.')
    })

    it('hợp đồng thuê có điều khoản phân định trách nhiệm ẩm mốc khi trả kho', () => {
      expect(customerAppContent).toContain('Phân định trách nhiệm ẩm mốc khi trả kho: Hoàn 100% cọc và đền bù nếu do thấm dột hoặc hỏng máy lạnh cơ sở; khách hàng tự chịu và khấu trừ phí khử trùng 1.500.000₫ nếu do đóng gói ẩm hoặc vi phạm hàng cấm.')
    })
  })
})
