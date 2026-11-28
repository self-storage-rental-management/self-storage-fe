import { describe, expect, it } from 'vitest'
import type { RentalApiRecord } from '../../types/rentalApi'
import { filterCustomerRentals } from './customerRentalFilters'

const row = (id: string, overrides: Partial<RentalApiRecord> = {}) => ({ id, status: 'active', intakeCompleted: true, ...overrides }) as RentalApiRecord

describe('customer rental status filters', () => {
  const preparing = row('preparing', { intakeCompleted: false })
  const active = row('active')
  const returning = row('returning', { inventoryMismatchReturn: true })
  const completed = row('completed', { status: 'completed', inventoryMismatchReturn: true })
  const rows = [preparing, active, returning, completed]
  it('matches preparation and active filters to displayed progress', () => {
    expect(filterCustomerRentals(rows, 'setup')).toEqual([preparing])
    expect(filterCustomerRentals(rows, 'active')).toEqual([active])
  })
  it('includes mismatch returns while preserving completed history', () => {
    expect(filterCustomerRentals(rows, 'return_requested')).toEqual([returning])
    expect(filterCustomerRentals(rows, 'completed')).toEqual([completed])
  })
  it('keeps the API sort order and leaves the source untouched', () => {
    expect(filterCustomerRentals(rows)).toBe(rows)
    expect(filterCustomerRentals([active, preparing, row('second')], 'active').map(item => item.id)).toEqual(['active', 'second'])
    expect(rows).toHaveLength(4)
  })
})
