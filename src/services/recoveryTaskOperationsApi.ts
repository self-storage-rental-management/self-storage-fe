import { apiRequest, ApiClientError } from './apiClient'
import { readRentalEnvelope } from './rentalApi'
import { isInstant, isUuid } from './renewalOperationsApi'
import { feeKeys, returnStatuses, type InspectionInput, type ApiReturn } from './returnApi'
import type { RecoveryAudience, RecoveryTask } from './recoveryTasksApi'

export interface RecoveryOperations {
  taskId: string
  status: RecoveryTask['status']
  expectedVersion: number
  startedBy: string | null
  startedAt: string | null
  returnCaseId: string | null
  settlementStatus: ApiReturn['status'] | null
  evidenceFileIds: string[]
  receiptFileId: string | null
  assetsCleared: boolean
  completionFileId: string | null
  completedAt: string | null
}
export type RecoveryCommand =
  | { action: 'start'; body: { expectedVersion: number; note: string } }
  | { action: 'inspection'; body: { expectedVersion: number; inspection: Omit<InspectionInput, 'evidencePhotos'>; evidenceFileIds: string[] } }
  | { action: 'settlement-receipts'; body: { expectedVersion: number; paymentMethod: 'CASH' | 'BANK_TRANSFER'; transactionReference: string; receiptFileId: string; confirmed: boolean } }
  | { action: 'completion'; body: { expectedVersion: number; assetsCleared: boolean; unitInspected: boolean; reportFileId: string; note: string } }

export function isRecoveryOperations(value: unknown): value is RecoveryOperations {
  const v = value as RecoveryOperations | null
  return !!v && isUuid(v.taskId) && ['OPEN', 'IN_PROGRESS', 'CLOSED'].includes(v.status)
    && Number.isSafeInteger(v.expectedVersion) && v.expectedVersion >= 0
    && [v.startedBy, v.returnCaseId, v.receiptFileId, v.completionFileId].every(id => id === null || isUuid(id))
    && [v.startedAt, v.completedAt].every(at => at === null || isInstant(at))
    && (v.settlementStatus === null || returnStatuses.includes(v.settlementStatus))
    && Array.isArray(v.evidenceFileIds) && v.evidenceFileIds.every(isUuid)
    && typeof v.assetsCleared === 'boolean'
}
function path(role: RecoveryAudience, id: string) {
  if (!['staff', 'manager'].includes(role) || !isUuid(id)) throw new Error('Mã nhiệm vụ hoặc vai trò không hợp lệ.')
  return `/api/${role}/recovery-tasks/${id}`
}
export async function getRecoveryOperations(role: RecoveryAudience, id: string) {
  return readRentalEnvelope<RecoveryOperations>(await apiRequest(`${path(role, id)}/operations`),
    v => isRecoveryOperations(v) && v.taskId === id)
}
export function validateRecoveryCommand(command: RecoveryCommand) {
  const b = command.body
  if (!Number.isSafeInteger(b.expectedVersion) || b.expectedVersion < 0) throw new Error('Phiên bản nhiệm vụ không hợp lệ.')
  if (command.action === 'start' || command.action === 'completion') {
    if (!command.body.note.trim() || command.body.note.length > 2000) throw new Error('Nhập ghi chú từ 1 đến 2.000 ký tự.')
  }
  if (command.action === 'inspection') {
    const { inspection: i, evidenceFileIds: files } = command.body
    if (!['match', 'missing', 'excess'].includes(i.inventoryMatch) ||
        !['no_damage', 'minor_damage', 'major_damage', 'abandoned_goods'].includes(i.damageClassification) ||
        !['available', 'maintenance'].includes(i.proposedUnitStatus) || i.staffNotes.length > 4000 ||
        ![i.returnedKey, i.returnedCard, i.returnedLock].every(v => typeof v === 'boolean')) throw new Error('Kiểm tra thông tin kiểm kê.')
    if (!feeKeys.every(k => Number.isSafeInteger(i[k]) && i[k] >= 0) || feeKeys.reduce((sum, k) => sum + i[k], 0) > 999999999999)
      throw new Error('Phí phải là số VND nguyên không âm; tổng phí tối đa 999.999.999.999 đ.')
    if (!files.length || files.length > 10 || !files.every(isUuid) || new Set(files).size !== files.length) throw new Error('Đính kèm từ 1 đến 10 chứng từ kiểm kê đã lưu.')
  }
  if (command.action === 'settlement-receipts') {
    const b = command.body
    if (!['CASH', 'BANK_TRANSFER'].includes(b.paymentMethod) || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,63}$/.test(b.transactionReference) || !isUuid(b.receiptFileId) || b.confirmed !== true)
      throw new Error('Chọn phương thức, nhập mã giao dịch hợp lệ, đính kèm biên lai và xác nhận đã thu hoặc hoàn tiền.')
  }
  if (command.action === 'completion' && (!command.body.assetsCleared || !command.body.unitInspected || !isUuid(command.body.reportFileId)))
    throw new Error('Đính kèm biên bản và xác nhận đã xử lý tài sản, kiểm tra kho.')
}
export async function sendRecoveryCommand(role: RecoveryAudience, id: string, command: RecoveryCommand, key: string) {
  validateRecoveryCommand(command)
  if (!key.trim() || key.length > 100) throw new Error('Mã gửi yêu cầu không hợp lệ.')
  return readRentalEnvelope<RecoveryOperations>(await apiRequest(`${path(role, id)}/${command.action}`, {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(command.body),
  }), v => isRecoveryOperations(v) && v.taskId === id)
}
export function recoveryOperationError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 403) return 'Bạn không có quyền thực hiện thao tác này tại cơ sở.'
    if (error.status === 404) return 'Không tìm thấy nhiệm vụ hoặc hồ sơ quyết toán.'
    if (error.status === 409) {
      const known: Record<string, string> = {
        'Recovery version changed; reload before submitting': 'Nhiệm vụ đã được cập nhật. Tải lại trước khi lưu.',
        'Recovery task has already started or closed': 'Nhiệm vụ đã được tiếp nhận hoặc đóng.',
        'Recovery inventory has already been recorded': 'Kiểm kê đã được lưu.',
        'Settlement must first be confirmed or the dispute resolved': 'Cần khách hàng xác nhận quyết toán hoặc giải quyết khiếu nại trước khi ghi nhận tiền.',
        'Recovery settlement has not been completed': 'Cần hoàn tất quyết toán trước khi hoàn tất thu hồi.',
        'Recovery settlement or transaction evidence was already recorded': 'Quyết toán hoặc chứng từ giao dịch đã được ghi nhận.',
        'Recovery inventory evidence is invalid': 'Chứng từ kiểm kê không hợp lệ. Tải lại và kiểm tra chứng từ.',
      }
      return known[error.message] ?? 'Máy chủ từ chối thao tác (409). Tải lại nhiệm vụ trước khi tiếp tục.'
    }
    if (error.status === null || (error.status ?? 0) >= 500) return 'Chưa nhận được xác nhận từ máy chủ. Gửi lại cùng yêu cầu để lấy kết quả.'
    return 'Máy chủ từ chối yêu cầu. Kiểm tra các trường nhập và chứng từ.'
  }
  return error instanceof Error ? error.message : 'Không tải được nhiệm vụ. Hãy thử tải lại.'
}
