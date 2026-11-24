export type InventoryResult = 'MATCHED' | 'VARIANCE_FITS' | 'NOT_FIT' | 'UNKNOWN'

export function inventoryResult(fullFit: boolean | null | undefined, hasVariance: boolean): InventoryResult {
  if (fullFit == null) return 'UNKNOWN'
  if (!fullFit) return 'NOT_FIT'
  return hasVariance ? 'VARIANCE_FITS' : 'MATCHED'
}
