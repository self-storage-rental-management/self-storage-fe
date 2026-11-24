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
  expect(html).not.toContain('Tìm kho phù hợp với hàng thực tế')
  expect(html).not.toContain('Gợi ý chuyển sang kho phù hợp')
})

it('automatically checks alternatives after the result is published', () => {
  const html = renderToStaticMarkup(<InventoryResultNotice result="NOT_FIT" published checkInId="checkin" packages={12} weight={144} volume={0.5}>{null}</InventoryResultNotice>)
  expect(html).toContain('Kiểm tra tự động: đang tìm kho phù hợp để chuyển…')
  expect(html).not.toContain('Tìm kho phù hợp với hàng thực tế')
})
