import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import InventoryResultNotice from './InventoryResultNotice'

it.each([
  ['MATCHED', 'Hàng hóa khớp với khai báo'],
  ['VARIANCE_FITS', 'Hàng hóa không khớp nhưng vẫn vừa kho'],
  ['NOT_FIT', 'Hàng hóa không thể chứa vừa trong kho'],
  ['UNKNOWN', 'Chờ đối chiếu phương án xếp hàng'],
] as const)('shows the %s result screen with actual inventory totals', (result, title) => {
  const html = renderToStaticMarkup(<InventoryResultNotice result={result} published={false} checkInId="checkin" packages={12} weight={144} volume={0.5}><p>Phương án xác nhận của khách</p></InventoryResultNotice>)
  expect(html).toContain(title)
  expect(html).toContain('144 kg')
  expect(html).toContain('Phương án xác nhận của khách')
  if (result !== 'MATCHED') {
    expect(html).toContain('disabled=""')
    expect(html).toContain('Công bố kết quả kiểm kê trước khi tìm kho thay thế.')
  }
})
