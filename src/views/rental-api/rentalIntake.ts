import type { RentalApiRecord } from '../../types/rentalApi'

export type RentalIntakeProgress = Pick<RentalApiRecord,
  'intakeCompleted' | 'inventoryPending' | 'inventoryVerifiedAt' | 'setupStartedAt'
  | 'moveInCompletedAt' | 'inventoryDueAt' | 'inventoryFinalDeadlineAt'>

export const incompleteIntakeRenewalReason = 'Chưa hoàn tất kiểm kê và tiếp nhận hàng nên chưa thể gia hạn.'

export function isRentalIntakePending(rental: RentalIntakeProgress) {
  if (rental.intakeCompleted != null) return !rental.intakeCompleted
  return rental.inventoryPending === true || (!rental.inventoryVerifiedAt && Boolean(
    rental.setupStartedAt || rental.moveInCompletedAt || rental.inventoryDueAt || rental.inventoryFinalDeadlineAt,
  ))
}
