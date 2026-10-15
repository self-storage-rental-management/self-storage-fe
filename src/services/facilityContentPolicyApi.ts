import { apiRequest } from './apiClient'
export interface FacilityContentPolicy {
  id: string; name: string; value: string; scope: string; editable: boolean
  description?: string; lastUpdated?: string; scopeType: 'all' | 'specific'
  facilityIds: string[]; category: 'billing' | 'climate' | 'prohibited' | 'maintenance'
}
export interface FacilityPolicyCatalog { version: number; policies: FacilityContentPolicy[] }
export async function listFacilityContentPolicies() {
  return (await apiRequest<{ data: FacilityPolicyCatalog }>('/api/business/policies/content')).data
}
export async function saveFacilityContentPolicies(version: number, policies: FacilityContentPolicy[]) {
  return (await apiRequest<{ data: FacilityPolicyCatalog }>('/api/business/policies/content', {
    method: 'PUT', body: JSON.stringify({ version, policies }),
  })).data
}
export async function customerFacilityPolicies(facilityId: string) {
  return (await apiRequest<{ data: FacilityContentPolicy[] }>(`/api/customer/facilities/${encodeURIComponent(facilityId)}/content-policies`)).data
}
