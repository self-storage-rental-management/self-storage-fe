import { expect, it } from 'vitest'
import { goodsVolumeM3, totalGoodsVolumeM3, formatGoodsVolume } from './goodsMeasurements'

it('converts centimeters to cubic meters and includes every package and goods type', () => {
  const moving = { quantity: '54', lengthCm: '120', widthCm: '122', heightCm: '120' }
  expect(goodsVolumeM3(moving)).toBeCloseTo(94.8672, 6)
  expect(totalGoodsVolumeM3([moving, { quantity: 2, lengthCm: 100, widthCm: 50, heightCm: 20 }])).toBeCloseTo(95.0672, 6)
})

it('retains small package volumes instead of displaying zero', () => {
  expect(formatGoodsVolume(goodsVolumeM3({ quantity: 3, lengthCm: 1.1, widthCm: 1.1, heightCm: 1.1 }))).toBe('0,000004')
})

it('calculates the customer example of ten 40 × 50 × 50 cm packages as one cubic meter', () => {
  expect(goodsVolumeM3({ quantity: 10, lengthCm: 40, widthCm: 50, heightCm: 50 })).toBe(1)
})
