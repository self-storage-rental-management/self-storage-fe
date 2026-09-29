import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Modal, Select } from '../../components/ui'
import { USD_TO_VND_RATE } from '../../i18n/currency'
import type { User } from '../../types'
import type { StorageUnit, UnitType } from '../../types/storageHub'

type Mode = 'create' | 'edit'

interface Props {
  open: boolean
  mode: Mode
  unit: StorageUnit | null
  unitTypes: UnitType[]
  facilityUnits: StorageUnit[]
  policyUnits: StorageUnit[]
  allUnitCodes: string[]
  facilityId: string
  facilityName: string
  user: User
  canDelete: boolean
  deleteBlockedReason?: string
  createUnit: (data: Partial<StorageUnit>, actor: User) => StorageUnit
  updateUnit: (unitId: string, updates: Partial<StorageUnit>, actor: User) => void
  deleteUnit: (unitId: string, actor: User) => { success: boolean; reason?: string }
  onClose: () => void
  onSaved: (unitId: string) => void
  showToast: (message: string) => void
}

interface FormState {
  code: string
  type: StorageUnit['type']
  floor: string
  zone: string
  lengthM: string
  widthM: string
  heightM: string
  doorWidthM: string
  doorHeightM: string
  maxLoadKg: string
  priceVnd: string
  depositVnd: string
  climate: boolean
  allowedGoods: string
  prohibitedGoods: string
  conditionNotes: string
}

const storageTypeFromDefinition = (definition: UnitType): StorageUnit['type'] => {
  if (definition.id === 'xlarge' || definition.name.toLowerCase().includes('extra')) return 'Extra Large'
  if (definition.id === 'large') return 'Large'
  if (definition.id === 'medium') return 'Medium'
  return 'Small'
}

const toLines = (items?: string[]) => (items || []).join('\n')
const fromLines = (value: string) => value.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean)
const toNumber = (value: string) => Number(value.replace(/\s/g, '').replace(/,/g, ''))

const emptyForm: FormState = {
  code: '',
  type: 'Small',
  floor: '1',
  zone: '',
  lengthM: '',
  widthM: '',
  heightM: '',
  doorWidthM: '',
  doorHeightM: '',
  maxLoadKg: '',
  priceVnd: '',
  depositVnd: '',
  climate: false,
  allowedGoods: '',
  prohibitedGoods: '',
  conditionNotes: ''
}

export default function ManagerUnitEditor({
  open,
  mode,
  unit,
  unitTypes,
  facilityUnits,
  policyUnits,
  allUnitCodes,
  facilityId,
  facilityName,
  user,
  canDelete,
  deleteBlockedReason,
  createUnit,
  updateUnit,
  deleteUnit,
  onClose,
  onSaved,
  showToast
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const definitions = useMemo(
    () => unitTypes.map(definition => ({ definition, type: storageTypeFromDefinition(definition) })),
    [unitTypes]
  )

  const applyTypeDefinition = (type: StorageUnit['type'], current: FormState): FormState => {
    const definition = definitions.find(item => item.type === type)?.definition
    const template = facilityUnits.find(item => item.type === type) || policyUnits.find(item => item.type === type) || facilityUnits[0]
    return {
      ...current,
      type,
      lengthM: definition ? String(definition.lengthM) : template ? String(template.dimensions.lengthM) : '',
      widthM: definition ? String(definition.widthM) : template ? String(template.dimensions.widthM) : '',
      heightM: definition ? String(definition.heightM) : template ? String(template.dimensions.heightM) : '',
      maxLoadKg: definition ? String(definition.maxLoadKg) : template ? String(template.maxLoadKg) : '',
      priceVnd: definition ? String(Math.round(definition.monthlyPrice * USD_TO_VND_RATE)) : template ? String(Math.round(template.price * USD_TO_VND_RATE)) : '',
      depositVnd: template ? String(Math.round(template.deposit * USD_TO_VND_RATE)) : '',
      doorWidthM: template ? String(template.doorDimensions.widthM) : '',
      doorHeightM: template ? String(template.doorDimensions.heightM) : '',
      climate: template?.climate ?? current.climate,
      allowedGoods: toLines(template?.allowedGoods),
      prohibitedGoods: toLines(template?.prohibitedGoods)
    }
  }

  useEffect(() => {
    if (!open) return
    setConfirmDelete(false)
    if (mode === 'edit' && unit) {
      setForm({
        code: unit.code,
        type: unit.type,
        floor: String(unit.floor),
        zone: unit.zone,
        lengthM: String(unit.dimensions.lengthM),
        widthM: String(unit.dimensions.widthM),
        heightM: String(unit.dimensions.heightM),
        doorWidthM: String(unit.doorDimensions.widthM),
        doorHeightM: String(unit.doorDimensions.heightM),
        maxLoadKg: String(unit.maxLoadKg),
        priceVnd: String(Math.round(unit.price * USD_TO_VND_RATE)),
        depositVnd: String(Math.round(unit.deposit * USD_TO_VND_RATE)),
        climate: unit.climate,
        allowedGoods: toLines(unit.allowedGoods),
        prohibitedGoods: toLines(unit.prohibitedGoods),
        conditionNotes: unit.conditionNotes || ''
      })
      return
    }
    const firstType = definitions[0]?.type || 'Small'
    setForm(applyTypeDefinition(firstType, { ...emptyForm, type: firstType }))
  }, [open, mode, unit, definitions, facilityUnits, policyUnits])

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm(current => ({ ...current, [field]: value }))

  const save = () => {
    const code = form.code.trim().toUpperCase()
    const allowedGoods = fromLines(form.allowedGoods)
    const prohibitedGoods = fromLines(form.prohibitedGoods)
    const numeric = {
      floor: toNumber(form.floor),
      lengthM: toNumber(form.lengthM),
      widthM: toNumber(form.widthM),
      heightM: toNumber(form.heightM),
      doorWidthM: toNumber(form.doorWidthM),
      doorHeightM: toNumber(form.doorHeightM),
      maxLoadKg: toNumber(form.maxLoadKg),
      priceVnd: toNumber(form.priceVnd),
      depositVnd: toNumber(form.depositVnd)
    }
    if (!facilityId || !facilityName) return showToast('Không xác định được cơ sở của Manager.')
    if (!code || !form.zone.trim()) return showToast('Vui lòng nhập mã gian kho và khu vực.')
    if (mode === 'create' && allUnitCodes.some(item => item.toUpperCase() === code)) return showToast('Mã gian kho đã tồn tại trong hệ thống.')
    if (!Number.isInteger(numeric.floor) || numeric.floor < 0) return showToast('Tầng phải là số nguyên không âm.')
    if ([numeric.lengthM, numeric.widthM, numeric.heightM, numeric.doorWidthM, numeric.doorHeightM, numeric.maxLoadKg, numeric.priceVnd, numeric.depositVnd].some(value => !Number.isFinite(value) || value <= 0) || numeric.priceVnd < 10_000 || numeric.depositVnd < 10_000) {
      return showToast('Kích thước và tải trọng phải lớn hơn 0; giá thuê và tiền đảm bảo phải từ 10.000 VND.')
    }
    if (!allowedGoods.length || !prohibitedGoods.length) return showToast('Cần khai báo ít nhất một nhóm hàng được phép và một nhóm hàng bị cấm.')

    const payload: Partial<StorageUnit> = {
      code,
      facilityId,
      facilityName,
      floor: numeric.floor,
      zone: form.zone.trim(),
      type: form.type,
      dimensions: { lengthM: numeric.lengthM, widthM: numeric.widthM, heightM: numeric.heightM },
      areaM2: Math.round(numeric.lengthM * numeric.widthM * 100) / 100,
      volumeM3: Math.round(numeric.lengthM * numeric.widthM * numeric.heightM * 100) / 100,
      doorDimensions: { widthM: numeric.doorWidthM, heightM: numeric.doorHeightM },
      maxLoadKg: numeric.maxLoadKg,
      climate: form.climate,
      conditionNotes: form.conditionNotes.trim() || undefined
    }

    try {
      if (mode === 'create') {
        const created = createUnit({ ...payload, status: 'available', version: 1 }, user)
        showToast(`Đã thêm gian kho ${created.code} vào dữ liệu dùng chung.`)
        onSaved(created.id)
      } else if (unit) {
        updateUnit(unit.id, { ...payload, version: unit.version + 1 }, user)
        showToast(`Đã cập nhật thông tin gian kho ${unit.code}.`)
        onSaved(unit.id)
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể lưu gian kho.')
    }
  }

  const remove = () => {
    if (!unit || !canDelete) return
    try {
      const result = deleteUnit(unit.id, user)
      if (!result.success) return showToast(result.reason || 'Không thể xóa gian kho.')
      showToast(`Đã xóa gian kho ${unit.code} chưa phát sinh nghiệp vụ.`)
      onClose()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể xóa gian kho.')
    }
  }

  return <Modal open={open} onClose={onClose} title={mode === 'create' ? 'Thêm gian kho vật lý' : `Chỉnh sửa ${unit?.code || ''}`} size="xl">
    <div className="space-y-5">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Cơ sở được cố định theo tài khoản Manager: <b>{facilityName || 'Chưa xác định'}</b>. Loại kho áp dụng thông số chuẩn từ dữ liệu dùng chung; các trường còn lại lấy từ gian cùng loại nếu cơ sở đã có.
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Input label="Mã gian kho" value={form.code} disabled={mode === 'edit'} onChange={event => setField('code', event.target.value.toUpperCase())} />
        <Select label="Loại gian kho" value={form.type} onChange={event => {
          const type = event.target.value as StorageUnit['type']
          setForm(current => applyTypeDefinition(type, current))
        }}>
          {definitions.map(item => <option key={item.definition.id} value={item.type}>{item.definition.name}</option>)}
        </Select>
        <Input label="Khu vực" value={form.zone} onChange={event => setField('zone', event.target.value)} />
        <Input label="Tầng" type="number" min="0" step="1" value={form.floor} onChange={event => setField('floor', event.target.value)} />
        <Input label="Chiều dài (m)" type="number" min="0" step="0.01" value={form.lengthM} onChange={event => setField('lengthM', event.target.value)} />
        <Input label="Chiều rộng (m)" type="number" min="0" step="0.01" value={form.widthM} onChange={event => setField('widthM', event.target.value)} />
        <Input label="Chiều cao (m)" type="number" min="0" step="0.01" value={form.heightM} onChange={event => setField('heightM', event.target.value)} />
        <Input label="Chiều rộng cửa (m)" type="number" min="0" step="0.01" value={form.doorWidthM} onChange={event => setField('doorWidthM', event.target.value)} />
        <Input label="Chiều cao cửa (m)" type="number" min="0" step="0.01" value={form.doorHeightM} onChange={event => setField('doorHeightM', event.target.value)} />
        <Input label="Tải trọng tối đa (kg)" type="number" min="0" value={form.maxLoadKg} onChange={event => setField('maxLoadKg', event.target.value)} />
        <Input label="Giá thuê tháng (VND) — theo cấu hình" type="number" value={form.priceVnd} disabled />
        <Input label="Tiền đảm bảo (VND) — theo cấu hình" type="number" value={form.depositVnd} disabled />
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-stone-700"><input type="checkbox" checked={form.climate} onChange={event => setField('climate', event.target.checked)} /> Có kiểm soát nhiệt độ</label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-stone-700">Hàng hóa được phép — theo chính sách hiện có<textarea disabled className="min-h-28 w-full rounded-lg border border-stone-300 bg-stone-100 px-3 py-2 text-sm font-normal text-stone-600" value={form.allowedGoods} /></label>
        <label className="space-y-1 text-sm font-medium text-stone-700">Hàng hóa bị cấm — theo chính sách hiện có<textarea disabled className="min-h-28 w-full rounded-lg border border-stone-300 bg-stone-100 px-3 py-2 text-sm font-normal text-stone-600" value={form.prohibitedGoods} /></label>
      </div>
      <label className="space-y-1 text-sm font-medium text-stone-700">Ghi chú tình trạng<textarea className="min-h-20 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-normal" value={form.conditionNotes} onChange={event => setField('conditionNotes', event.target.value)} /></label>

      {mode === 'edit' && unit && <div className="rounded-lg border border-red-200 p-4">
        <p className="font-semibold text-red-800">Xóa gian kho</p>
        <p className="mt-1 text-xs text-stone-600">Chỉ cho phép xóa gian còn trống và chưa từng phát sinh đặt chỗ, hợp đồng, nhận/trả kho hoặc bảo trì.</p>
        {!canDelete && <p className="mt-2 text-xs font-medium text-red-700">{deleteBlockedReason}</p>}
        {confirmDelete ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-red-700">Xác nhận xóa vĩnh viễn {unit.code}?</span><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Không xóa</Button><Button variant="danger" size="sm" onClick={remove}>Xóa gian kho</Button></div></div> : <Button className="mt-3" variant="danger" size="sm" disabled={!canDelete} onClick={() => setConfirmDelete(true)}>Yêu cầu xóa</Button>}
      </div>}

      <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Hủy</Button><Button onClick={save}>{mode === 'create' ? 'Thêm gian kho' : 'Lưu thay đổi'}</Button></div>
    </div>
  </Modal>
}
