import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { rental } from '../../../tests/rentalApiFixtures'
import { RentalRecordRow } from './RentalRecordList'

it.each([
  ['setup', true, true],
  ['return_inspection', true, true],
  ['return_inspection', false, false],
  ['active', undefined, false],
] as const)('shows the inventory return reason for status %s and flag %s', (status, inventoryMismatchReturn, visible) => {
  const html = renderToStaticMarkup(<RentalRecordRow
    rental={{ ...rental, status, inventoryMismatchReturn }}
    role="customer" actions={null} unitTypeName={rental.unitType.name}
  />)
  expect(html.includes('Trả kho do kiểm kê sai lệch')).toBe(visible)
})
