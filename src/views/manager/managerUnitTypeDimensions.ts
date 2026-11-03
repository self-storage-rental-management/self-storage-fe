export interface UnitTypeDimensions {
  lengthM: string
  widthM: string
  heightM: string
  maxLoadKg: string
  aisleWidthM: string
  rackLengthM: string
  rackWidthM: string
  rackHeightM: string
  rackCount: string
  physicalUnitCount: string
}

export function validateUnitTypeDimensions(form: UnitTypeDimensions, creating: boolean): string | undefined {
  const positiveFields: [keyof UnitTypeDimensions, string][] = [
    ['lengthM', 'Chiều dài gian kho'], ['widthM', 'Chiều rộng gian kho'],
    ['heightM', 'Chiều cao gian kho'], ['maxLoadKg', 'Tải trọng tối đa'],
    ['aisleWidthM', 'Chiều rộng lối đi'], ['rackLengthM', 'Chiều dài khung kệ'],
    ['rackWidthM', 'Chiều rộng khung kệ'], ['rackHeightM', 'Chiều cao khung kệ'],
  ]
  for (const [key, label] of positiveFields) {
    if (!form[key].trim() || !Number.isFinite(Number(form[key])) || Number(form[key]) <= 0) {
      return `${label} phải lớn hơn 0.`
    }
  }
  if (Number(form.rackLengthM) > Number(form.lengthM)
    || Number(form.rackWidthM) > Number(form.widthM)
    || Number(form.rackHeightM) > Number(form.heightM)) {
    return 'Kích thước khung kệ không được lớn hơn kích thước gian kho.'
  }
  if (Number(form.aisleWidthM) >= Number(form.widthM)) {
    return 'Chiều rộng lối đi phải nhỏ hơn chiều rộng gian kho.'
  }
  for (const [key, label] of [['rackCount', 'Số khung kệ'], ['physicalUnitCount', 'Số gian kho']] as const) {
    if (!form[key].trim() || !Number.isInteger(Number(form[key])) || Number(form[key]) < (key === 'physicalUnitCount' && creating ? 1 : 0)) {
      return `${label} phải là số nguyên ${key === 'physicalUnitCount' && creating ? 'từ 1 trở lên' : 'không âm'}.`
    }
  }
  return undefined
}
