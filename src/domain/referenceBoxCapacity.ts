/** Reference cartons from the original customer catalog, not customer goods declarations. */
export const REFERENCE_BOXES = [
  { label: 'Thùng nhỏ', dimensionsCm: [80, 60, 60] as const, capacityField: 'smallBoxCapacity' as const },
  { label: 'Thùng lớn', dimensionsCm: [100, 80, 80] as const, capacityField: 'largeBoxCapacity' as const },
]

export function referenceBoxCapacity(rackM: readonly number[], boxCm: readonly number[], rackCount: number) {
  if (rackM.length !== 3 || boxCm.length !== 3 || [...rackM, ...boxCm].some(n => !Number.isFinite(n) || n <= 0)
    || !Number.isInteger(rackCount) || rackCount <= 0) return null
  const [a, b, c] = boxCm.map(n => n / 100)
  const orientations = [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]]
  const perRack = Math.max(...orientations.map(d => d.reduce((count, side, i) => count * Math.floor((rackM[i] + 1e-9) / side), 1)))
  const estimatedPerRack = Math.floor(perRack * 0.8)
  return { fits: perRack > 0, perRack, geometricTotal: perRack * rackCount, estimatedPerRack, estimatedTotal: estimatedPerRack * rackCount }
}
