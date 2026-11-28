import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { rental } from '../../../tests/rentalApiFixtures'
import { ApiClientError } from '../../services/apiClient'
import { isRentalRecord } from '../../services/rentalApi'
import RentalDetail from './RentalDetail'
import { getRentalRenewalEligibility } from './RentalDeadlineNotice'
import { RentalRecordRow } from './RentalRecordList'
import { rentalError, rentalStatusLabel } from './presentation'
import { incompleteIntakeRenewalReason } from './rentalIntake'

describe('rental intake and renewal', () => {
  const pending = { ...rental, contractEndDate: '2027-10-31', intakeCompleted: false,
    moveInCompletedAt: '2026-11-25T10:00:00Z' }

  it('shows inventory progress even when the paid rental status is active', () => {
    expect(rentalStatusLabel(pending)).toBe('Chờ kiểm kê và tiếp nhận hàng')
    expect(rentalStatusLabel({ ...pending, moveInCompletedAt: null })).toBe('Đang chuẩn bị hàng')
    expect(rentalStatusLabel({ ...pending, inventoryVerifiedAt: '2026-11-26T10:00:00Z' })).toBe('Chờ hoàn tất tiếp nhận hàng')
    expect(rentalStatusLabel({ ...pending, status: 'completed' })).toBe('Hoàn tất')
    expect(rentalStatusLabel({ ...pending, status: 'closing' })).toBe('Đang quyết toán')
  })

  it('blocks renewal before physical intake completes and enables it afterwards', () => {
    expect(getRentalRenewalEligibility(pending)).toMatchObject({ canRenew: false, canOpenRequest: true, reason: incompleteIntakeRenewalReason })
    expect(getRentalRenewalEligibility({ ...pending, intakeCompleted: true })).toMatchObject({ canRenew: true, reason: undefined })
    expect(getRentalRenewalEligibility({ ...pending, intakeCompleted: true }, [{ rentalId: pending.id, status: 'pending' }]).canRenew).toBe(false)
  })

  it('keeps the older API blocked when it explicitly reports unfinished inventory', () => {
    expect(getRentalRenewalEligibility({ ...pending, intakeCompleted: undefined, inventoryPending: true }).canRenew).toBe(false)
    expect(getRentalRenewalEligibility({ ...pending, intakeCompleted: undefined }).canRenew).toBe(false)
  })

  it('keeps the reason inside the renewal dialog and allows opening it', () => {
    const row = renderToStaticMarkup(<RentalRecordRow rental={pending} role="customer" actions={null} unitTypeName="Kho" />)
    expect(row).not.toContain(incompleteIntakeRenewalReason)
    expect(row).toContain('Chờ kiểm kê và tiếp nhận hàng')
    const detail = renderToStaticMarkup(<RentalDetail rental={pending} onRequest={() => {}} />)
    const action = detail.match(/<button[^>]*>Yêu cầu gia hạn<\/button>/)?.[0]
    expect(action).toBeDefined()
    expect(action).not.toContain('disabled=""')
    expect(detail).not.toContain(incompleteIntakeRenewalReason)
  })

  it('retains the mismatch return reason instead of inviting another inventory', () => {
    expect(rentalStatusLabel({ ...pending, inventoryMismatchReturn: true })).toBe('Chờ trả kho do kiểm kê sai lệch')
    expect(getRentalRenewalEligibility({ ...pending, inventoryMismatchReturn: true }).canRenew).toBe(false)
    expect(getRentalRenewalEligibility({ ...pending, inventoryMismatchReturn: true }).canOpenRequest).toBe(true)
    expect(getRentalRenewalEligibility({ ...pending, status: 'completed', inventoryMismatchReturn: true }).canOpenRequest).toBe(false)
  })

  it('translates server refusals and validates the additive API progress field', () => {
    expect(rentalError(new ApiClientError('Rental inventory and intake are not completed', { status: 409 }))).toBe(incompleteIntakeRenewalReason)
    expect(isRentalRecord(pending)).toBe(true)
    expect(isRentalRecord({ ...pending, intakeCompleted: 'false' })).toBe(false)
  })
})
