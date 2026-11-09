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
  const arrangements = orientations.map(dimensions => {
    const counts = dimensions.map((side, i) => Math.floor((rackM[i] + 1e-9) / side))
    return { dimensions, counts, total: counts.reduce((count, value) => count * value, 1) }
  })
  const best = arrangements.reduce((current, candidate) => candidate.total > current.total ? candidate : current)
  const perRack = best.total
  const estimatedPerRack = Math.floor(perRack * 0.8)
  return { fits: perRack > 0, perRack, geometricTotal: perRack * rackCount, estimatedPerRack, estimatedTotal: estimatedPerRack * rackCount,
    boxesAlongLength: best.counts[0], boxesAlongWidth: best.counts[1], layers: best.counts[2],
    orientedDimensionsCm: best.dimensions.map(side => Math.round(side * 100)) }
}
