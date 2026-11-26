type DatedNotification = { id: string; date?: string }

/** Server copies supersede cached copies, and all sources share one timeline. */
export function mergeNotificationFeed<T extends DatedNotification>(
  cached: readonly T[], supplied: readonly T[] = [], additional: readonly T[] = [],
): T[] {
  const items = new Map<string, T>(cached.map(item => [item.id, item]))
  for (const item of supplied) items.set(item.id, item)
  for (const item of additional) if (!items.has(item.id)) items.set(item.id, item)
  const timestamp = (date?: string) => {
    const value = date ? Date.parse(date) : NaN
    return Number.isFinite(value) ? value : 0
  }
  return [...items.values()].sort((left, right) =>
    timestamp(right.date) - timestamp(left.date) || left.id.localeCompare(right.id))
}
