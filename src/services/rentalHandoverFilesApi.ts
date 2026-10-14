import { apiRequest } from './apiClient'
import { readRentalEnvelope } from './rentalApi'
import { isInstant, isUuid } from './renewalOperationsApi'

export interface RentalHandoverFile {
  id: string; name: string; contentType: string; sizeBytes: number; uploadedAt: string
  kind: 'SIGNED_CONTRACT' | 'HANDOVER_EVIDENCE'
}
export async function listRentalHandoverFiles(role: 'customer' | 'manager', rentalId: string) {
  if (!isUuid(rentalId) || !['customer','manager'].includes(role)) throw new Error('Hồ sơ không hợp lệ.')
  return readRentalEnvelope<RentalHandoverFile[]>(await apiRequest(`/api/${role}/rentals/${rentalId}/handover-files`),value =>
    Array.isArray(value) && value.every(file => file && isUuid(file.id) && typeof file.name === 'string'
      && typeof file.contentType === 'string' && Number.isSafeInteger(file.sizeBytes) && file.sizeBytes >= 0
      && isInstant(file.uploadedAt) && ['SIGNED_CONTRACT','HANDOVER_EVIDENCE'].includes(file.kind)))
}
