import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CustomerUnitDetails from './CustomerUnitDetails'
import type { CustomerUnitType } from '../../services/customerReservationApi'

it('hiển thị thông số và gói thuê từ backend, không chèn tiện ích hard-code', () => {
  const unit: CustomerUnitType = {
    id: 'type', facilityId: 'facility', code: 'S', name: 'Small', lengthM: 8, widthM: 10,
    heightM: 5, areaM2: 80, volumeM3: 400, monthlyPrice: 5500000,
    securityDepositAmount: 5500000, imageUrl: null, maxLoadKg: 1000, rackCount: 4,
    rackLengthM: 2, rackWidthM: 4, rackHeightM: 4.5, status: 'active', availableCount: 2,
    createdAt: '', updatedAt: '',
  }
  const html = renderToStaticMarkup(<CustomerUnitDetails unitType={unit} facilityName="StorageHub Quan 1"
    address="Quan 1" availableCount={2} rentalPackages={[
      { code: 'FAC-6M', name: 'Gói 6 tháng cơ sở', rentalMonths: 6, discountRate: 0.10, policyVersion: 'v1' },
    ]} onReserve={() => {}} onClose={() => {}} />)
  for (const text of ['Kho Việt - Cơ sở Quận 1', '125 Nguyễn Bỉnh Khiêm', 'kho-s-chi-tiet.png',
    'Ưu đãi và báo giá theo kỳ thuê',
    'Gói 6 tháng cơ sở', 'Giảm 10% tiền thuê',
    '3. Quy trình đặt kho và thanh toán', '5.500.000', 'Tiền cọc đảm bảo kho',
    'Xác nhận hồ sơ', 'Thanh toán cọc', 'Nhận kho']) expect(html).toContain(text)
  for (const text of ['Số kho trống theo kỳ thuê', 'Theo báo giá kỳ thuê', 'Chiều rộng làn xe đẩy',
    '(hồ sơ bố trí)', '- phù hợp thùng carton và đồ gia dụng nhẹ', 'Kiểm tra hàng hóa',
    'Kích thước từng kiện, tổng thể tích và tổng trọng lượng',
    'Kiểm tra theo khung kệ', 'Đối chiếu kích thước từng kiện với 4 khung kệ',
    'Kiểm tra cân nặng', 'Tổng trọng lượng hàng không vượt quá 1.000 kg',
    'An ninh và tiện ích vận hành', 'An ninh và kiểm soát ra vào', 'Hệ thống phòng cháy chữa cháy',
    'Cơ sở chưa công bố chính sách nội dung', 'QUY ĐỊNH CHO THUÊ KHO STORAGEHUB',
    'Quy định trả kho và gia hạn', 'Chính sách và quy định áp dụng', 'Trả kho sau ngày hết hạn',
    'Gia hạn kỳ thuê']) expect(html).not.toContain(text)
  for (const text of ['StorageHub Quan 1', 'Thời gian ân hạn', 'Thời hạn báo trước khi trả kho', 'cọc 40%',
    'Kích thước hàng hóa tối đa', '160 × 80 × 150 cm']) expect(html).not.toContain(text)
  for (const text of ['Quy định trả kho và gia hạn muộn', 'giao diện cũ', 'Lối đi và thiết bị hỗ trợ',
    'Thời hạn thanh toán hiển thị trên đơn; tiền cọc được trừ vào tiền thuê.']) expect(html).not.toContain(text)
  for (const text of ['Giảm 3% tiền thuê', 'Giảm 5% tiền thuê', 'Giảm 8% tiền thuê']) expect(html).not.toContain(text)
  for (const text of ['Dữ liệu hiện chưa có', 'Ảnh minh họa giao diện;', '/images/customer-units/kho-s.jpg']) expect(html).not.toContain(text)
  expect(html).not.toContain('sticky')
})
