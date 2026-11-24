import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import InventoryFieldDifference from './InventoryFieldDifference'

it('shows the declared quantity beside a changed field', () => {
  const html = renderToStaticMarkup(<InventoryFieldDifference actual="12" declared={10} unit="kiện" />)
  expect(html).toContain('Chênh lệch so với khai báo: 10 kiện.')
})

it('does not flag an unchanged per-package weight when quantity changes', () => {
  expect(renderToStaticMarkup(<InventoryFieldDifference actual={60 / 12} declared={5} unit="kg/kiện" tolerance={0.1} />)).toBe('')
})

it('uses readable catalog labels instead of internal identifiers', () => {
  const html = renderToStaticMarkup(<InventoryFieldDifference actual="new-id" declared="old-id" declaredLabel="Đồ gia dụng" />)
  expect(html).toContain('Đồ gia dụng')
  expect(html).not.toContain('old-id')
})

it.each(['', ' ', null, undefined])('does not label an unfilled field as a discrepancy: %s', actual => {
  expect(renderToStaticMarkup(<InventoryFieldDifference actual={actual} declared={10} />)).toBe('')
})

it('does not warn for a measurement within tolerance or an absent item', () => {
  expect(renderToStaticMarkup(<InventoryFieldDifference actual={10.005} declared={10} tolerance={0.01} />)).toBe('')
  expect(renderToStaticMarkup(<InventoryFieldDifference actual={12} declared={10} disabled />)).toBe('')
})
