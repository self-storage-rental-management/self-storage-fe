import { ApiClientError } from '../../services/apiClient'

const fields: Record<string, string> = { fullName: 'name', name: 'name', email: 'email', phone: 'phone', phoneValid: 'phone', password: 'password' }

export function adminUserFieldErrors(reason: unknown): Record<string, string> {
  if (!(reason instanceof ApiClientError) || !reason.details || typeof reason.details !== 'object') return {}
  const result: Record<string, string> = {}
  for (const [field, message] of Object.entries(reason.details)) {
    const target = fields[field]
    if (target && typeof message === 'string') result[target] = message
  }
  return result
}
