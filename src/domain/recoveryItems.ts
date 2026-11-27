export type RecoveryItem = {
  code: string; name: string; condition: string; location: string | null; evidenceId?: string | null
  disposition: string; releasedAt: string | null; releaseEvidenceId?: string | null
  liquidation?: { recordedAt: string; recordedBy: string | null; note: string | null; evidenceId: string | null } | null
}
export type RecoveryVariant = {
  key: string; condition: string; location: string | null; disposition: string; items: RecoveryItem[]
}
export type RecoveryItemGroup = { key: string; name: string; items: RecoveryItem[]; variants: RecoveryVariant[] }
const labelKey = (value: string | null | undefined) => (value || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN')
export const isPendingRecoveryItem = (item: RecoveryItem) => item.disposition === 'STORED' && !item.releasedAt && !item.liquidation
export function groupRecoveryItems(items: readonly RecoveryItem[]): RecoveryItemGroup[] {
  const groups = new Map<string, RecoveryItemGroup>()
  for (const item of items) {
    const key = labelKey(item.name)
    let group = groups.get(key)
    if (!group) { group = { key, name: item.name.trim(), items: [], variants: [] }; groups.set(key, group) }
    group.items.push(item)
    const variantKey = JSON.stringify([labelKey(item.condition), labelKey(item.location), item.disposition])
    let variant = group.variants.find(value => value.key === variantKey)
    if (!variant) { variant = { key: variantKey, condition: item.condition, location: item.location, disposition: item.disposition, items: [] }; group.variants.push(variant) }
    variant.items.push(item)
  }
  return [...groups.values()]
}
export function recoveryItemCounts(items: readonly RecoveryItem[]) {
  return { total: items.length, stored: items.filter(isPendingRecoveryItem).length,
    released: items.filter(item => !item.liquidation && !!item.releasedAt).length,
    liquidated: items.filter(item => !!item.liquidation).length }
}
export function pendingRecoveryChoices(items: readonly RecoveryItem[]) {
  return groupRecoveryItems(items).flatMap(group => group.variants.map(variant => ({
    key: variant.items[0].code, name: group.name, condition: variant.condition, location: variant.location,
    items: variant.items.filter(isPendingRecoveryItem),
  })).filter(variant => variant.items.length > 0))
}

export function groupQuantityLines<T extends { quantity: number }>(lines: readonly T[], key: (line: T) => unknown): T[] {
  const grouped = new Map<string, T>()
  for (const line of lines) {
    const id = JSON.stringify(key(line))
    const current = grouped.get(id)
    grouped.set(id, current ? { ...current, quantity: current.quantity + line.quantity } : { ...line })
  }
  return [...grouped.values()]
}
