export type GoodsDimensions = { quantity: number | string; lengthCm: number | string; widthCm: number | string; heightCm: number | string }

export function goodsVolumeM3(item: GoodsDimensions): number {
  const values = [item.quantity, item.lengthCm, item.widthCm, item.heightCm].map(Number)
  if (values.some(value => !Number.isFinite(value) || value <= 0)) return 0
  return values.reduce((product, value) => product * value, 1) / 1_000_000
}

export const totalGoodsVolumeM3 = (items: GoodsDimensions[]) =>
  items.reduce((total, item) => total + goodsVolumeM3(item), 0)

export const formatGoodsVolume = (value: number) =>
  value.toLocaleString('vi-VN', { maximumFractionDigits: 6 })
