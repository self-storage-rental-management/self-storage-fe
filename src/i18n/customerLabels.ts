export function customerFacilityName(code: string, fallback: string): string {
  const key = customerFacilityKey(code, fallback)
  return key === 'HCM' ? 'Kho Việt – Cơ sở Quận 1' : key === 'BD' ? 'Kho Việt – Cơ sở Bình Dương' : fallback
}

function customerFacilityKey(code: string, name: string): 'HCM' | 'BD' | undefined {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (code.trim().toUpperCase() === 'HCM-Q1-F01' || normalized === 'storagehub quan 1' || normalized === 'kho viet – co so quan 1') return 'HCM'
  if (code.trim().toUpperCase() === 'BD-F01' || normalized === 'storagehub binh duong' || normalized === 'kho viet – co so binh duong') return 'BD'
}

export function customerFacilityAddress(code: string, name: string, fallback: string): string {
  const key = customerFacilityKey(code, name)
  return key === 'HCM' ? '125 Nguyễn Bỉnh Khiêm, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'
    : key === 'BD' ? '468 Đại lộ Bình Dương, Phường Lái Thiêu, TP. Thuận An, Bình Dương' : fallback
}

export function isCustomerVisiblePolicy(policy: { name: string }): boolean {
  return !['Grace Period', 'Notice to Vacate', 'Thời gian ân hạn', 'Thời hạn báo trước khi trả kho'].includes(policy.name)
}

export function vietnamesePolicy<T extends { name: string; value: string; scope: string }>(policy: T): T {
  const names: Record<string, string> = {
    'Grace Period': 'Thời gian ân hạn', 'Late Fee': 'Phí thanh toán trễ',
    'Security Deposit': 'Tiền cọc đảm bảo', 'Notice to Vacate': 'Thời hạn báo trước khi trả kho',
    'Minimum Lease': 'Kỳ thuê tối thiểu',
  }
  return { ...policy, name: names[policy.name] || policy.name,
    value: policy.value.replace(/\bdays?\b/gi, 'ngày').replace(/\bmonths?\b/gi, 'tháng'),
    scope: policy.scope === 'All Facilities' ? 'Toàn bộ cơ sở' : policy.scope }
}
