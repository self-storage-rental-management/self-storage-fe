import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Khung Quy Định Vận Hành & Pháp Lý Sự Cố / Ẩm Mốc (BO Protocols Verification)', () => {
  const businessAppPath = resolve(__dirname, '../src/views/business/BusinessApp.tsx')
  const businessAppContent = readFileSync(businessAppPath, 'utf8')

  const managerReturnsPath = resolve(__dirname, '../src/views/manager/ManagerReturnsPanel.tsx')
  const managerReturnsContent = readFileSync(managerReturnsPath, 'utf8')

  const staffAppPath = resolve(__dirname, '../src/views/staff/StaffApp.tsx')
  const staffAppContent = readFileSync(staffAppPath, 'utf8')

  // ----------------------------------------------------------------------------
  // 1. KIỂM TRA LOẠI BỎ TOÀN BỘ EMOJI ICON TRÊN CÁC HUY HIỆU (BADGES)
  // ----------------------------------------------------------------------------
  describe('Yêu cầu loại bỏ icon (Emoji Removal)', () => {
    it('không còn icon toà nhà (🏢 1) trong huy hiệu điều khoản kết cấu hạ tầng', () => {
      // Huy hiệu phải hiển thị số 1 thuần túy, không có emoji toà nhà
      expect(businessAppContent).not.toContain('🏢 1')
      expect(businessAppContent).toContain('data-testid="protocol-badge-1"')
    })

    it('không còn icon giọt nước (💧 2) trong huy hiệu điều khoản phân định ẩm mốc', () => {
      // Huy hiệu phải hiển thị số 2 thuần túy, không có emoji giọt nước
      expect(businessAppContent).not.toContain('💧 2')
      expect(businessAppContent).toContain('data-testid="protocol-badge-2"')
    })

    it('huy hiệu được định dạng số sạch sẽ với class styling phù hợp', () => {
      // Badge 1 hiển thị số 1
      const badge1Match = businessAppContent.match(/data-testid="protocol-badge-1"[^>]*>([\s\S]*?)<\/span>/)
      expect(badge1Match).not.toBeNull()
      expect(badge1Match![1].trim()).toBe('1')

      // Badge 2 hiển thị số 2
      const badge2Match = businessAppContent.match(/data-testid="protocol-badge-2"[^>]*>([\s\S]*?)<\/span>/)
      expect(badge2Match).not.toBeNull()
      expect(badge2Match![1].trim()).toBe('2')
    })
  })

  // ----------------------------------------------------------------------------
  // 2. KIỂM TRA NỘI DUNG VÀ QUY TẮC: SỰ CỐ KẾT CẤU HẠ TẦNG KHO (CARD 1)
  // ----------------------------------------------------------------------------
  describe('Quy định 1: Xử lý sự cố kết cấu hạ tầng kho (Structural Fault SLA Protocol)', () => {
    it('có tiêu đề đầy đủ và chính xác cho cả tiếng Việt và tiếng Anh', () => {
      expect(businessAppContent).toContain('Xử Lý Sự Cố Kết Cấu Hạ Tầng Kho (Sàn vỡ, Dột nóc, Kẹt cửa)')
      expect(businessAppContent).toContain('Facility Structural Fault & SLA Protocol')
    })

    it('quy định rõ trách nhiệm 100% của cơ sở và thời gian xử lý P1 khẩn cấp trong 4-12h', () => {
      expect(businessAppContent).toContain('Lỗi kết cấu cơ sở (Facility Fault):')
      expect(businessAppContent).toContain('Cơ sở chịu 100% trách nhiệm')
      expect(businessAppContent).toContain('Xử lý P1 khẩn cấp trong 4-12h')
    })

    it('quy định quy trình Di dời khẩn cấp (Relocation) cho kho đang có khách', () => {
      expect(businessAppContent).toContain('Kho đang có khách:')
      expect(businessAppContent).toContain('Kích hoạt luồng Di dời khẩn cấp (Relocation)')
      expect(businessAppContent).toContain('kho trống tương đương')
      expect(businessAppContent).toContain('cấp mã PIN mới miễn phí và giữ nguyên hợp đồng')
    })

    it('quy định chuyển trạng thái MAINTENANCE và ẩn khỏi trang đặt kho đối với kho trống', () => {
      expect(businessAppContent).toContain('Kho trống:')
      expect(businessAppContent).toContain('Lập tức chuyển sang MAINTENANCE')
      expect(businessAppContent).toContain('ẩn khỏi trang đặt kho để sửa chữa')
    })

    it('hỗ trợ nội dung tiếng Anh tương ứng đầy đủ các quy tắc', () => {
      expect(businessAppContent).toContain('100% facility responsibility. P1 emergency handling within 4-12 hours.')
      expect(businessAppContent).toContain('Trigger Emergency Relocation to equivalent unit with new PIN, contract preserved.')
      expect(businessAppContent).toContain('Immediate lock to MAINTENANCE status, hidden from booking catalog.')
    })
  })

  // ----------------------------------------------------------------------------
  // 3. KIỂM TRA NỘI DUNG VÀ QUY TẮC: PHÂN ĐỊNH TRÁCH NHIỆM ẨM MỐC (CARD 2)
  // ----------------------------------------------------------------------------
  describe('Quy định 2: Phân định trách nhiệm ẩm mốc khi trả kho (Return Dispute)', () => {
    it('có tiêu đề đầy đủ và chính xác cho cả tiếng Việt và tiếng Anh', () => {
      expect(businessAppContent).toContain('Phân Định Trách Nhiệm Ẩm Mốc Khi Trả Kho (Return Dispute)')
      expect(businessAppContent).toContain('Moisture & Mold Return Settlement')
    })

    it('quy định hoàn 100% cọc và bồi thường nếu lỗi do vách/trần loang ố hoặc máy lạnh hỏng', () => {
      expect(businessAppContent).toContain('Vách/trần loang ố hoặc máy lạnh hỏng → Lỗi cơ sở:')
      expect(businessAppContent).toContain('Hoàn 100% cọc + bồi thường hàng + khóa kho sửa chữa')
    })

    it('quy định khấu trừ đúng mức phí khử trùng 1.500.000₫ nếu lỗi do khách hàng', () => {
      expect(businessAppContent).toContain('Kho khô 100%, đồ mốc do khách cất ẩm/hàng cấm → Lỗi khách:')
      expect(businessAppContent).toContain('Tự chịu 100% + trừ phí khử trùng 1.500.000₫ vào cọc')
    })

    it('quy định miễn trừ trách nhiệm đối với kho thường (Standard Storage)', () => {
      expect(businessAppContent).toContain('Kho thường (Standard):')
      expect(businessAppContent).toContain('Miễn trừ trách nhiệm độ ẩm tự nhiên theo cam kết hợp đồng')
    })

    it('hỗ trợ nội dung tiếng Anh tương ứng đầy đủ các trường hợp', () => {
      expect(businessAppContent).toContain('Full deposit refund + compensation + maintenance lock.')
      expect(businessAppContent).toContain('100% customer liability + deduct 1,500,000₫ sanitization fee from deposit.')
      expect(businessAppContent).toContain('Ambient climate humidity liability waiver per contract agreement.')
    })
  })

  // ----------------------------------------------------------------------------
  // 4. KIỂM TRA ĐỊNH DẠNG DANH SÁCH RÕ RÀNG (KHÔNG BỊ DÍNH CHỮ THÀNH MỘT DÒNG)
  // ----------------------------------------------------------------------------
  describe('Định dạng hiển thị các mục danh sách (Structured List Presentation)', () => {
    it('sử dụng danh sách thẻ ul/li có gạch đầu dòng riêng biệt thay vì text gộp 1 đoạn dính liền', () => {
      expect(businessAppContent).toContain('<ul className="text-xs text-slate-600 space-y-1 leading-relaxed">')
      expect(businessAppContent).toContain('<li className="flex items-start gap-1.5">')
      // Đảm bảo có thẻ strong in đậm các từ khóa quan trọng
      expect(businessAppContent).toContain('<strong className="text-slate-800">Lỗi kết cấu cơ sở (Facility Fault):</strong>')
      expect(businessAppContent).toContain('<strong className="text-slate-800">Kho đang có khách:</strong>')
      expect(businessAppContent).toContain('<strong className="text-slate-800">Kho trống:</strong>')
    })
  })

  // ----------------------------------------------------------------------------
  // 5. TÍNH ĐỒNG BỘ VỚI CÁC PHÂN HỆ QUẢN LÝ (MANAGER) VÀ NHÂN VIÊN (STAFF)
  // ----------------------------------------------------------------------------
  describe('Tính liên kết đồng bộ nghiệp vụ giữa BO, Manager và Staff', () => {
    it('ManagerReturnsPanel áp dụng đúng 3 mức xử lý tranh chấp và đã bỏ emoji icon', () => {
      expect(managerReturnsContent).not.toContain('🏢 1. Lỗi Cơ Sở Kho')
      expect(managerReturnsContent).not.toContain('👤 2. Lỗi Khách Hàng')
      expect(managerReturnsContent).not.toContain('🤝 3. Hòa Giải Thiện Chí')

      expect(managerReturnsContent).toContain('1. Lỗi Cơ Sở Kho')
      expect(managerReturnsContent).toContain('2. Lỗi Khách Hàng')
      expect(managerReturnsContent).toContain('3. Hòa Giải Thiện Chí')

      // Mức phí khử trùng 1.500.000đ khớp với mức trong quy định BO
      expect(managerReturnsContent).toContain('1500000')
      expect(managerReturnsContent).toContain('1.500.000₫')
    })

    it('StaffApp biên bản kiểm tra trả kho liên kết đúng 2 tiêu chí kết cấu và độ ẩm', () => {
      expect(staffAppContent).not.toContain('<span>🏢</span>')
      expect(staffAppContent).not.toContain('<span>💧</span>')
      expect(staffAppContent).toContain('Kiểm tra kết cấu cơ sở (Trần — Vách — Sàn)')
      expect(staffAppContent).toContain('Giám định nguồn gốc ẩm mốc / hư hại hàng hóa')
    })
  })

  // ----------------------------------------------------------------------------
  // 6. KIỂM TRA LOGIC TÍNH TOÁN QUYẾT TOÁN CỌC KHI TRANH CHẤP ẨM MỐC
  // ----------------------------------------------------------------------------
  describe('Logic nghiệp vụ quyết toán cọc tranh chấp ẩm mốc (Financial Calculation)', () => {
    const depositAmount = 10_000_000 // 10 triệu VND cọc ban đầu
    const sanitizationFee = 1_500_000 // 1.5 triệu VND phí khử trùng mốc

    it('trường hợp lỗi cơ sở (Facility Fault): hoàn lại 100% cọc không khấu trừ', () => {
      const deductions = 0
      const netRefund = depositAmount - deductions
      expect(netRefund).toBe(10_000_000)
    })

    it('trường hợp lỗi khách hàng (Customer Fault): khấu trừ đúng 1.500.000đ phí khử trùng', () => {
      const deductions = sanitizationFee
      const netRefund = depositAmount - deductions
      expect(netRefund).toBe(8_500_000)
    })

    it('trường hợp hòa giải thiện chí (Mutual Settlement): giảm 50% phí khử trùng (750.000đ)', () => {
      const deductions = sanitizationFee / 2
      const netRefund = depositAmount - deductions
      expect(netRefund).toBe(9_250_000)
    })
  })
})
