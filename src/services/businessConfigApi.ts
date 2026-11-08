import { apiRequest } from './apiClient'

export interface BusinessConfigApi {
  gracePeriodDays: number
  lateFeeAmount: number
  defaultDepositRatio: number
  holdExpiryHours: number
  dimDivisor: number
  maintenanceMode: boolean
  bannerNotice: string
  autoInvoiceDays: number
  autoProrate: boolean
  managerRefundApprovalLimit: number
}

export interface UpdateBusinessConfigInput {
  gracePeriodDays?: number
  lateFeeAmount?: number
  defaultDepositRatio?: number
  holdExpiryHours?: number
  dimDivisor?: number
  maintenanceMode?: boolean
  bannerNotice?: string
  autoInvoiceDays?: number
  autoProrate?: boolean
  managerRefundApprovalLimit?: number
}

type Envelope<T> = { data: T; correlationId: string }

export async function getBusinessConfigApi(): Promise<BusinessConfigApi> {
  const response = await apiRequest<Envelope<BusinessConfigApi>>('/api/business/config')
  return response.data
}

export async function updateBusinessConfigApi(input: UpdateBusinessConfigInput): Promise<BusinessConfigApi> {
  const response = await apiRequest<Envelope<BusinessConfigApi>>('/api/business/config', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  return response.data
}
