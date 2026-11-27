export function canOpenInventory(status: string | null | undefined, _appointmentAt?: string | null) {
  return status === 'setup_in_progress' || status === 'setup_completed' || status === 'completed'
}

type InventoryCase = {
  checkInStatus?: string | null
  inventoryResolutionStatus?: string | null
  inventoryFinalDeadlineAt?: string | null
  inventoryVisit?: { arrivedAt?: string | null; identityVerifiedAt?: string | null
    access?: { completionDeadlineAt: string | null; writable: boolean; blockedReason: string | null; recoveryTransferred?: boolean } | null } | null
}

export function isCheckInRecoveryTransferred(item: InventoryCase | null | undefined): boolean {
  return item?.inventoryVisit?.access?.recoveryTransferred === true
}

export function inventoryInspectionBlockReason(item: InventoryCase | null | undefined, now = Date.now()): string | null {
  if (!item) return null
  if (isCheckInRecoveryTransferred(item)) return 'Hồ sơ đã chuyển sang thu hồi. Không thể tiếp tục kiểm kê.'
  const access = item.inventoryVisit?.access
  const legacyStart = item.inventoryVisit?.arrivedAt || item.inventoryVisit?.identityVerifiedAt
  const deadline = access?.completionDeadlineAt ? Date.parse(access.completionDeadlineAt)
    : legacyStart ? Date.parse(legacyStart) + 72 * 3600_000 : null
  if (deadline != null && Number.isFinite(deadline) && now > deadline)
    return 'Đã hết hạn hoàn tất kiểm kê 72 giờ. Không thể tiếp tục kiểm kê. Vui lòng liên hệ Quản lý để xử lý.'
  if (access && !access.writable) return access.blockedReason || 'Hồ sơ không còn cho phép kiểm kê.'
  if (!access && !legacyStart && item.inventoryFinalDeadlineAt && now >= Date.parse(item.inventoryFinalDeadlineAt))
    return 'Đã quá hạn kiểm kê. Vui lòng liên hệ Quản lý để xử lý.'
  return null
}

export function canAccessInventory(item: InventoryCase, now = Date.now()): boolean {
  if (isCheckInRecoveryTransferred(item)) return false
  if (!canOpenInventory(item.checkInStatus)) return false
  const published = item.checkInStatus === 'completed'
    || !!item.inventoryResolutionStatus && item.inventoryResolutionStatus !== 'NOT_STARTED'
  return published || !inventoryInspectionBlockReason(item, now)
}
