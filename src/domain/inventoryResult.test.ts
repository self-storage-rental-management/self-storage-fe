import { describe, expect, it } from 'vitest'
import { inventoryResult } from './inventoryResult'

describe('inventory result confirmation', () => {
  it('distinguishes matching cargo and changed cargo that still fits', () => {
    expect(inventoryResult(true, false)).toBe('MATCHED')
    expect(inventoryResult(true, true)).toBe('VARIANCE_FITS')
  })
  it('requires a resolution when cargo does not fit even if declaration matches', () => {
    expect(inventoryResult(false, false)).toBe('NOT_FIT')
    expect(inventoryResult(false, true)).toBe('NOT_FIT')
  })
  it('does not claim a fit when capacity is unavailable', () => {
    expect(inventoryResult(undefined, false)).toBe('UNKNOWN')
    expect(inventoryResult(null, true)).toBe('UNKNOWN')
  })
})
