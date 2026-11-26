export type RecoveryVerification = {
  used: number; limit: number; remaining: number; matched: boolean; canReceiveItems: boolean; message: string
}

export function canHandOverRecovery(entry: {
  arrivedAt?: string | null; verifiedAt?: string | null; verification?: RecoveryVerification | null
}, now = Date.now()): boolean {
  if (!entry.verification?.canReceiveItems || !entry.verifiedAt || !entry.arrivedAt) return false
  const arrived = Date.parse(entry.arrivedAt)
  return Number.isFinite(arrived) && now >= arrived && now < arrived + 30 * 60 * 1000
}
