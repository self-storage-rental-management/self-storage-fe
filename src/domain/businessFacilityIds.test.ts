import { describe, expect, it } from 'vitest'
import { resolveBusinessFacilityIds } from './businessFacilityIds'

describe('business package facility identity', () => {
  const persisted = [{ id: 'dn-backend-uuid', code: 'DN' }, { id: 'q1-backend-uuid', code: 'HCM-Q1-F01' }]
  const local = [{ id: 'DN', code: 'DN' }, { id: 'fac-001', code: 'HCM-Q1-F01' }]
  it('resolves Da Nang local IDs to the backend record and keeps UUIDs', () => {
    expect(resolveBusinessFacilityIds('specific', ['DN', 'dn-backend-uuid'], local, persisted)).toEqual(['dn-backend-uuid'])
  })
  it('uses persisted IDs for all facilities and rejects an unknown target', () => {
    expect(resolveBusinessFacilityIds('all', [], local, persisted)).toEqual(persisted.map(f => f.id))
    expect(() => resolveBusinessFacilityIds('specific', ['missing'], local, persisted)).toThrow('Không tìm thấy')
  })
})
