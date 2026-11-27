import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { returnFeeRows } from '../../services/returnApi'
import CustomerReturnFeeSchedule, { ReturnFeeScheduleTable } from './CustomerReturnFeeSchedule'

describe('customer return fee schedule', () => {
  it('renders published descriptions and prices with units, without default prices for missing entries', () => {
    const html = renderToStaticMarkup(<ReturnFeeScheduleTable schedule={{
      revision: 2,
      prices: { minor_wall_scratch: 345678, clean: 0 },
      details: { minor_wall_scratch: { label: 'Phí đã công bố', trigger: 'Điều kiện mới', applies: 'Đối tượng mới' } },
    }} />)
    expect(html).toContain('Phí đã công bố')
    expect(html).toContain('Điều kiện mới')
    expect(html).toContain('Đối tượng mới')
    expect(html).toContain('345.678 ₫ / điểm/vết')
    expect(html).toContain('0 ₫')
    expect(html).toContain('Chưa có dữ liệu')
    expect(html).not.toContain('115.000 ₫')
    expect((html.match(/<tr/g) ?? []).length).toBe(returnFeeRows.length + 1)
  })

  it('shows only the items in a newly published catalog', () => {
    const code = 'custom_minor_' + '1'.repeat(32)
    const html = renderToStaticMarkup(<ReturnFeeScheduleTable schedule={{
      revision: 3, editableCatalog: true, prices: { [code]: 60000 },
      details: { [code]: { label: 'Sửa bản lề', trigger: 'Bản lề hỏng', applies: 'Kho trả' } },
    }} />)
    expect(html).toContain('Sửa bản lề')
    expect(html).toContain('60.000 ₫ / lần')
    expect(html).not.toContain('Trầy xước tường')
    expect((html.match(/<tr/g) ?? []).length).toBe(2)
  })

  it('initially shows a loading state and explains the schedule scope', () => {
    const html = renderToStaticMarkup(<CustomerReturnFeeSchedule />)
    expect(html).toContain('Đang tải biểu phí trả kho')
    expect(html).toContain('áp dụng cho các đặt kho mới')
    expect(html).toContain('hợp đồng hiện có có thể khác')
    expect(html).not.toContain('<table')
  })
})
