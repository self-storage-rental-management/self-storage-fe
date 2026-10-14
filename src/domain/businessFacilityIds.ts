type FacilityIdentity = { id: string; code?: string }

export function resolveBusinessFacilityIds(scope: 'all' | 'specific', selected: string[],
  local: FacilityIdentity[], persisted: FacilityIdentity[]) {
  if (scope === 'all') return persisted.map(f => f.id)
  return [...new Set(selected.map(id => {
    const source = local.find(f => f.id === id || f.code === id)
    const target = persisted.find(f => f.id === id || f.code === id ||
      (source?.code && f.code?.toUpperCase() === source.code.toUpperCase()))
    if (!target) throw new Error('Không tìm thấy cơ sở đã chọn trên hệ thống. Vui lòng tải lại trang.')
    return target.id
  }))]
}
