export type GoodsDimensions = { quantity: number | string; lengthCm: number | string; widthCm: number | string; heightCm: number | string }

export function goodsVolumeM3(item: GoodsDimensions): number {
  const values = [item.quantity, item.lengthCm, item.widthCm, item.heightCm].map(value => Number(String(value).replace(',', '.')))
  if (values.some(value => !Number.isFinite(value) || value <= 0)) return 0
  return values.reduce((product, value) => product * value, 1) / 1_000_000
}

export const totalGoodsVolumeM3 = (items: GoodsDimensions[]) =>
  items.reduce((total, item) => total + goodsVolumeM3(item), 0)

export const formatGoodsVolume = (value: number) =>
  value > 0 && value < 0.0000005 ? '< 0,000001' : value.toLocaleString('vi-VN', { maximumFractionDigits: value > 0 && value < 0.001 ? 6 : 3 })
