import { describe, expect, it } from 'vitest'
import { dimensionalWeightKg, packageCapacityPerRack, packageVolumeM3, requiredRackCountForSamples } from './reservationCapacity'

describe('reservation capacity calculations', () => {
  it('sums volume per item line instead of reusing the largest dimensions', () => {
    const samples = [
      { quantity: 10, lengthCm: 40, widthCm: 50, heightCm: 50, weightKg: 24.1 },
      { quantity: 2, lengthCm: 100, widthCm: 100, heightCm: 100, weightKg: 10 },
    ]
    expect(samples.reduce((total, sample) => total + packageVolumeM3(sample), 0)).toBe(3)
    expect(dimensionalWeightKg(samples)).toBe(600)
  })

  it('uses the configured rack dimensions and keeps the 80 percent reserve', () => {
    const sample = { quantity: 10, lengthCm: 40, widthCm: 50, heightCm: 50, weightKg: 24.1 }
    expect(packageCapacityPerRack(sample, [4, 2, 4.5])).toBe(360)
    expect(requiredRackCountForSamples([sample], [4, 2, 4.5])).toBe(1)
  })
})
