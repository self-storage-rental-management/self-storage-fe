import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import InventoryReviewDetails, { type InventoryReviewLine } from './InventoryReviewDetails'

const line: InventoryReviewLine = {
  id: 'goods', name: 'Đàn guitar', category: 'Hàng hóa khác', material: 'Gỗ', description: 'Đàn kèm hộp bảo vệ',
  quantity: 2, dimensions: [100, 40, 20], weightPerPackage: 5, fragile: true, stackable: false,
  horizontal: true, condition: 'Có hư hỏng', damage: 'Hộp bị trầy bên trái',
}

it('lists the entered custom goods, measurements, condition, packaging and evidence separately', () => {
  const html = renderToStaticMarkup(<InventoryReviewDetails lines={[line]} packaging="Thùng carton"
    packagingCondition="Hư hỏng nhẹ" packagingNote="Thùng bị móp góc" reason="Khách mang thêm một đàn"
    evidence={<span>kiem-ke.pdf</span>} />)
  for (const value of ['Đàn guitar', 'Hàng hóa khác', 'Gỗ', 'Đàn kèm hộp bảo vệ', '2 kiện', '100 × 40 × 20 cm', '5 kg',
    'Hộp bị trầy bên trái', 'Thùng carton', 'Thùng bị móp góc', 'Khách mang thêm một đàn', 'kiem-ke.pdf']) expect(html).toContain(value)
  expect(html).not.toContain('Số lớp')
})

it('does not display a damage description for an intact item', () => {
  const html = renderToStaticMarkup(<InventoryReviewDetails lines={[{ ...line, condition: 'Nguyên vẹn', damage: '' }]}
    packaging="Thùng carton" packagingCondition="Nguyên vẹn" packagingNote="" reason="" evidence={null} />)
  expect(html).not.toContain('Mô tả hư hỏng')
})
