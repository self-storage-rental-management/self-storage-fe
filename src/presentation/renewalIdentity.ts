export interface RenewalDisplayIdentity {
  rentalDisplayCode?: string | null
  renewalSequence?: number | null
}

export function renewalDisplayLabel(identity: RenewalDisplayIdentity) {
  const sequence = identity.renewalSequence
  if (identity.rentalDisplayCode && sequence) {
    return `${identity.rentalDisplayCode} · Gia hạn lần ${sequence}`
  }
  if (identity.rentalDisplayCode) return `${identity.rentalDisplayCode} · Gia hạn`
  if (sequence) return `Hồ sơ thuê · Gia hạn lần ${sequence}`
  return "Yêu cầu gia hạn"
}
