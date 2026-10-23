export type ReservationPackageSample = {
  quantity: string | number
  lengthCm: string | number
  widthCm: string | number
  heightCm: string | number
  weightKg: string | number
}

export const RACK_UTILIZATION_RATE = 0.8

const positiveNumber = (value: string | number) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function isPackageSampleValid(sample: ReservationPackageSample) {
  const quantity = positiveNumber(sample.quantity)
  return quantity !== null
    && Number.isInteger(quantity)
    && positiveNumber(sample.lengthCm) !== null
    && positiveNumber(sample.widthCm) !== null
    && positiveNumber(sample.heightCm) !== null
    && positiveNumber(sample.weightKg) !== null
}

export function packageCapacityPerRack(
  sample: ReservationPackageSample,
  rackDimensionsM: readonly [number, number, number] = [4, 2, 4.5],
) {
  if (!isPackageSampleValid(sample)) return 0
  const dimensions = [
    Number(sample.lengthCm) / 100,
    Number(sample.widthCm) / 100,
    Number(sample.heightCm) / 100,
  ]
  const [a, b, c] = dimensions
  const orientations = [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]]
  return Math.max(...orientations.map(([x, y, z]) =>
    Math.floor(rackDimensionsM[0] / x)
    * Math.floor(rackDimensionsM[1] / y)
    * Math.floor(rackDimensionsM[2] / z),
  ))
}

export function packageVolumeM3(sample: ReservationPackageSample) {
  const quantity = positiveNumber(sample.quantity)
  const length = positiveNumber(sample.lengthCm)
  const width = positiveNumber(sample.widthCm)
  const height = positiveNumber(sample.heightCm)
  if (quantity === null || length === null || width === null || height === null) return 0
  return quantity * length * width * height / 1_000_000
}

export function usableRackVolumeM3(rackDimensionsM: readonly [number, number, number]) {
  return rackDimensionsM[0] * rackDimensionsM[1] * rackDimensionsM[2] * RACK_UTILIZATION_RATE
}

export function requiredRackCountForSamples(
  samples: ReservationPackageSample[],
  rackDimensionsM: readonly [number, number, number],
) {
  const usableVolume = usableRackVolumeM3(rackDimensionsM)
  if (usableVolume <= 0) return Number.POSITIVE_INFINITY
  return Math.ceil(samples.reduce((total, sample) => total + packageVolumeM3(sample), 0) / usableVolume)
}

export function dimensionalWeightKg(
  samples: ReservationPackageSample[],
  dimDivisor = 5000,
) {
  if (dimDivisor <= 0) return 0
  const totalVolumeCm3 = samples.reduce((total, sample) => total + packageVolumeM3(sample) * 1_000_000, 0)
  return Math.ceil(totalVolumeCm3 / dimDivisor)
}
