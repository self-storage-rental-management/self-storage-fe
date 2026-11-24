import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PackagingInspectionResult } from './CustomerReservationCard'
import type { CustomerReservationDetail } from '../../services/customerReservationApi'

it('keeps packaging method and condition separate after the customer has resolved inventory', () => {
  const detail = { goodsCondition: 'Thùng carton', inventoryResolutionStatus: 'ACCEPTED', inventoryActualJson: JSON.stringify({ packagingMethod: 'Thùng nhựa', packagingCondition: 'MINOR_DAMAGE' }) } as CustomerReservationDetail
  const html = renderToStaticMarkup(<PackagingInspectionResult detail={detail} />)
  for (const text of ['Thùng carton', 'Thùng nhựa', 'Hư hỏng nhẹ', 'Không khớp phương thức đã khai báo']) expect(html).toContain(text)
})
it('shows a matching intact result and does not invent results for old records', () => {
  const detail = { goodsCondition: 'Thùng carton', inventoryActualJson: JSON.stringify({ packagingMethod: 'Thùng carton', packagingCondition: 'INTACT' }) } as CustomerReservationDetail
  expect(renderToStaticMarkup(<PackagingInspectionResult detail={detail} />)).toContain('Khớp phương thức đã khai báo')
  expect(renderToStaticMarkup(<PackagingInspectionResult detail={{ ...detail, inventoryActualJson: '{}' }} />)).toBe('')
})
