import { describe, expect, it } from 'vitest'
import { referenceBoxCapacity } from './referenceBoxCapacity'

describe('reference carton estimates', () => {
  it('checks the original S small carton count with 20% reserve', () => {
    expect(referenceBoxCapacity([4, 2, 4.5], [80, 60, 60], 4)).toMatchObject({ fits: true, perRack: 105, geometricTotal: 420, estimatedTotal: 336 })
  })
  it('distinguishes rotated large carton packing from the reserved estimate', () => {
    expect(referenceBoxCapacity([4, 2, 4.5], [100, 80, 80], 4)).toMatchObject({ perRack: 50, geometricTotal: 200, estimatedTotal: 160 })
  })
  it('allows rotation and rejects oversized cartons', () => {
    expect(referenceBoxCapacity([0.6, 0.8, 0.6], [80, 60, 60], 1)?.fits).toBe(true)
    expect(referenceBoxCapacity([0.5, 0.5, 0.5], [80, 60, 60], 1)?.fits).toBe(false)
  })
  it('does not invent estimates when rack data is missing', () => {
    expect(referenceBoxCapacity([4, 0, 4.5], [80, 60, 60], 4)).toBeNull()
  })
})
