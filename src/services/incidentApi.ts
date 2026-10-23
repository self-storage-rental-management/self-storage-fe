import { apiRequest } from './apiClient'

export type DamageCause = 'NATURE' | 'HUMAN' | 'WEAR_AND_TEAR' | 'UNKNOWN'
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type IncidentStatus = 'REPORTED' | 'INVESTIGATING' | 'CONFIRMED' | 'RESOLVED' | 'CLOSED'

export interface DamageIncidentApi {
  id: string
  incidentCode: string
  facilityId: string
  facilityName: string
  storageUnitId?: string | null
  storageUnitCode?: string | null
  cause: DamageCause
  severity: IncidentSeverity
  description: string
  occurredAt: string
  reportedAt: string
  reportedById: string
  reportedByName: string
  status: IncidentStatus
  resolutionNotes?: string | null
  evidencePhotosJson?: string | null
  createdAt: string
  updatedAt: string
}

export interface DamageIncidentInput {
  facilityId: string
  storageUnitId?: string | null
  cause: DamageCause
  severity: IncidentSeverity
  description: string
  occurredAt: string
  evidencePhotosJson?: string | null
}

export interface IncidentStatusUpdateInput {
  status: IncidentStatus
  resolutionNotes?: string | null
}

type Envelope<T> = { data: T; correlationId: string }

export async function listDamageIncidents(params?: {
  facilityId?: string
  status?: IncidentStatus
  severity?: IncidentSeverity
}) {
  const query = new URLSearchParams()
  if (params?.facilityId) query.set('facilityId', params.facilityId)
  if (params?.status) query.set('status', params.status)
  if (params?.severity) query.set('severity', params.severity)
  const suffix = query.size ? `?${query}` : ''
  const response = await apiRequest<Envelope<DamageIncidentApi[]>>(`/api/business/incidents${suffix}`)
  return response.data
}

export async function getDamageIncident(id: string) {
  const response = await apiRequest<Envelope<DamageIncidentApi>>(`/api/business/incidents/${encodeURIComponent(id)}`)
  return response.data
}

export async function createDamageIncident(input: DamageIncidentInput) {
  const response = await apiRequest<Envelope<DamageIncidentApi>>('/api/business/incidents', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return response.data
}

export async function updateDamageIncidentStatus(id: string, input: IncidentStatusUpdateInput) {
  const response = await apiRequest<Envelope<DamageIncidentApi>>(`/api/business/incidents/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  return response.data
}
