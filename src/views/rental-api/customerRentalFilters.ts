import type { RentalApiRecord, RentalApiStatus } from '../../types/rentalApi'
import { isRentalIntakePending } from './rentalIntake'

export function customerRentalFilterStatus(row: RentalApiRecord): RentalApiStatus {
  if (row.status === 'completed') return 'completed'
  if (row.inventoryMismatchReturn && ['setup', 'active'].includes(row.status)) return 'return_requested'
  if (['setup', 'active'].includes(row.status) && (row.canConfirmRentalStart || isRentalIntakePending(row))) return 'setup'
  return row.status
}

export function filterCustomerRentals(rows: RentalApiRecord[], status?: string) {
  return status ? rows.filter(row => customerRentalFilterStatus(row) === status) : rows
}
