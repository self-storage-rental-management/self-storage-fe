import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CustomerUnitDetails from './CustomerUnitDetails'
import type { CustomerUnitType } from '../../services/customerReservationApi'

it('khôi phục hồ sơ kho, địa chỉ cũ, các khối quy định và bỏ hai chính sách', () => {
  const unit: CustomerUnitType = {
    id: 'type', facilityId: 'facility', code: 'S', name: 'Small', lengthM: 8, widthM: 10,
    heightM: 5, areaM2: 80, volumeM3: 400, monthlyPrice: 5500000,
    securityDepositAmount: 5500000, imageUrl: null, maxLoadKg: 1000, rackCount: 4,
    rackLengthM: 2, rackWidthM: 4, rackHeightM: 4.5, status: 'active', availableCount: 2,
    createdAt: '', updatedAt: '',
  }
  const html = renderToStaticMarkup(<CustomerUnitDetails unitType={unit} facilityName="StorageHub Quan 1"
    address="Quan 1" availableCount={2} onReserve={() => {}} onClose={() => {}} />)
  for (const text of ['Kho Việt – Cơ sở Quận 1', '125 Nguyễn Bỉnh Khiêm', 'kho-s-chi-tiet.png',
    'Ưu đãi và báo giá theo kỳ thuê', 'An ninh và tiện ích vận hành', 'Quy định trả kho và gia hạn',
    'Giảm 3% tiền thuê', 'Giảm 5% tiền thuê', 'Giảm 8% tiền thuê',
    'Chính sách và quy định áp dụng', 'Phí quá hạn', 'Tiền đảm bảo kho', 'Thời hạn thuê tối thiểu',
    'Trả kho sau ngày hết hạn', 'Gia hạn kỳ thuê',
    'Quy trình đặt kho và thanh toán', 'cọc 40%', '5.500.000', 'Tiền cọc đảm bảo',
    'Chiều rộng lối đi', '1,8 m', 'Thiết bị xe đẩy', 'Xe đẩy tay thông thường (0,8 × 0,5 m)',
    'Kiểm tra theo khung kệ', 'Đối chiếu kích thước từng kiện với 4 khung kệ',
    'Kiểm tra cân nặng', 'Tổng trọng lượng hàng không vượt quá 1.000 kg',
    'Bố trí và sức chứa kho', 'Kích thước hàng hóa tối đa', '160 × 80 × 150 cm',
    'Mẫu thùng nhỏ 50 × 40 × 40 cm', '336', 'Mẫu thùng lớn 70 × 50 × 50 cm', '200',
    'Xác nhận hồ sơ', 'Thanh toán cọc', 'Nhận kho']) expect(html).toContain(text)
  for (const text of ['Số kho trống theo kỳ thuê', 'Theo báo giá kỳ thuê', 'Chiều rộng làn xe đẩy',
    '(hồ sơ bố trí)', '– phù hợp thùng carton và đồ gia dụng nhẹ', 'Kiểm tra hàng hóa',
    'Kích thước từng kiện, tổng thể tích và tổng trọng lượng']) expect(html).not.toContain(text)
  for (const text of ['StorageHub Quan 1', 'Thời gian ân hạn', 'Thời hạn báo trước khi trả kho', 'cọc 20%']) expect(html).not.toContain(text)
  for (const text of ['Quy định trả kho và gia hạn muộn', 'giao diện cũ', 'Lối đi và thiết bị hỗ trợ',
    'Thời hạn thanh toán hiển thị trên đơn; tiền cọc được trừ vào tiền thuê.']) expect(html).not.toContain(text)
  expect(html.match(/Chiều rộng lối đi/g)).toHaveLength(1)
  expect(html.match(/Thiết bị xe đẩy/g)).toHaveLength(1)
  for (const text of ['Dữ liệu hiện chưa có', 'Ảnh minh họa giao diện;', '/images/customer-units/kho-s.jpg']) expect(html).not.toContain(text)
  expect(html).not.toContain('sticky')
})
