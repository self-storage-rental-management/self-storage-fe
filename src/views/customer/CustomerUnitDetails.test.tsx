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
    'Báo giá theo kỳ thuê', 'An ninh và tiện ích vận hành',
    'Quy trình đặt kho và thanh toán', 'cọc 40%', '5.500.000', 'Tiền cọc đảm bảo',
    'Chiều rộng lối đi', '1,8 m', 'Thiết bị xe đẩy', 'Xe đẩy tay thông thường (0,8 × 0,5 m)',
    'Kiểm tra theo khung kệ', 'Đối chiếu kích thước từng kiện với 4 khung kệ',
    'Kiểm tra cân nặng', 'Tổng trọng lượng hàng không vượt quá 1.000 kg',
    'Xác nhận hồ sơ', 'Thanh toán cọc', 'Nhận kho']) expect(html).toContain(text)
  for (const text of ['Số kho trống theo kỳ thuê', 'Theo báo giá kỳ thuê', 'Chiều rộng làn xe đẩy',
    '(hồ sơ bố trí)', '– phù hợp thùng carton và đồ gia dụng nhẹ', 'Kiểm tra hàng hóa',
    'Kích thước từng kiện, tổng thể tích và tổng trọng lượng']) expect(html).not.toContain(text)
  for (const text of ['StorageHub Quan 1', 'Thời gian ân hạn', 'Thời hạn báo trước khi trả kho', 'cọc 20%']) expect(html).not.toContain(text)
  for (const text of ['Giảm 3%', 'Giảm 5%', 'Giảm 8%', 'Quy định trả kho và gia hạn muộn', 'giao diện cũ']) expect(html).not.toContain(text)
  for (const text of ['Dữ liệu hiện chưa có', 'Bố trí và sức chứa kho', 'Ảnh minh họa giao diện;', '/images/customer-units/kho-s.jpg']) expect(html).not.toContain(text)
  expect(html).not.toContain('sticky')
})
