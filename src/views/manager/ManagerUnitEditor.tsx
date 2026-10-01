import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Modal, Select } from '../../components/ui'
import type { User } from '../../types'
import type { StorageUnit, UnitType } from '../../types/storageHub'
import { formatManagerMoney } from './managerList'

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
  doorWidthM: string
  doorHeightM: string
  climate: boolean
  conditionNotes: string
}

const storageTypeFromDefinition = (definition: UnitType): StorageUnit['type'] => {
  if (definition.id === 'xlarge' || definition.name.toLowerCase().includes('extra')) return 'Extra Large'
  if (definition.id === 'large') return 'Large'
  if (definition.id === 'medium') return 'Medium'
  return 'Small'
}

const toNumber = (value: string) => Number(value.replace(/\s/g, '').replace(/,/g, ''))

const emptyForm: FormState = {
  code: '',
  type: 'Small',
  floor: '1',
  zone: '',
  doorWidthM: '',
  doorHeightM: '',
  climate: false,
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

  const selectedDefinition = definitions.find(item => item.type === form.type)?.definition
  const selectedTemplate = facilityUnits.find(item => item.type === form.type) || policyUnits.find(item => item.type === form.type)

  const applyTypeDefinition = (type: StorageUnit['type'], current: FormState): FormState => {
    const template = facilityUnits.find(item => item.type === type) || policyUnits.find(item => item.type === type) || facilityUnits[0]
    return {
      ...current,
      type,
      doorWidthM: mode === 'create' && template ? String(template.doorDimensions.widthM) : current.doorWidthM,
      doorHeightM: mode === 'create' && template ? String(template.doorDimensions.heightM) : current.doorHeightM,
      climate: mode === 'create' ? template?.climate ?? current.climate : current.climate
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
        doorWidthM: String(unit.doorDimensions.widthM),
        doorHeightM: String(unit.doorDimensions.heightM),
        climate: unit.climate,
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
    const numeric = {
      floor: toNumber(form.floor),
      doorWidthM: toNumber(form.doorWidthM),
      doorHeightM: toNumber(form.doorHeightM)
    }
    if (!facilityId || !facilityName) return showToast('Không xác định được cơ sở của Manager.')
    if (!code || !form.zone.trim()) return showToast('Vui lòng nhập mã gian kho và khu vực.')
    if (mode === 'create' && allUnitCodes.some(item => item.toUpperCase() === code)) return showToast('Mã gian kho đã tồn tại trong hệ thống.')
    if (!Number.isInteger(numeric.floor) || numeric.floor < 0) return showToast('Tầng phải là số nguyên không âm.')
    if ([numeric.doorWidthM, numeric.doorHeightM].some(value => !Number.isFinite(value) || value <= 0)) {
      return showToast('Kích thước cửa phải lớn hơn 0.')
    }
    if (!selectedDefinition) return showToast('Không tìm thấy định nghĩa loại gian kho trong dữ liệu dùng chung.')
    if (!selectedTemplate) return showToast('Chưa có dữ liệu chính sách áp dụng cho loại gian kho đã chọn.')

    const payload: Partial<StorageUnit> = {
      code,
      facilityId,
      facilityName,
      floor: numeric.floor,
      zone: form.zone.trim(),
      type: form.type,
      doorDimensions: { widthM: numeric.doorWidthM, heightM: numeric.doorHeightM },
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
        Cơ sở được cố định theo tài khoản Manager: <b>{facilityName || 'Chưa xác định'}</b>. Thông số loại gian, giá và chính sách bên dưới chỉ được đọc từ dữ liệu dùng chung.
      </div>

      <section className="space-y-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Thông tin gian</p><p className="mt-1 text-xs text-stone-500">Các trường xác định gian kho vật lý tại cơ sở.</p></div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Mã gian kho *" value={form.code} disabled={mode === 'edit'} onChange={event => setField('code', event.target.value.toUpperCase())} />
          <Select label="Loại gian kho *" value={form.type} onChange={event => {
            const type = event.target.value as StorageUnit['type']
            setForm(current => applyTypeDefinition(type, current))
          }}>
            {definitions.map(item => <option key={item.definition.id} value={item.type}>{item.definition.name}</option>)}
          </Select>
          <Input label="Khu vực *" value={form.zone} onChange={event => setField('zone', event.target.value)} />
          <Input label="Tầng *" type="number" min="0" step="1" value={form.floor} onChange={event => setField('floor', event.target.value)} />
        </div>
      </section>

      <section className="space-y-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Thông số loại gian</p><p className="mt-1 text-xs text-stone-500">Kế thừa từ UnitType đang chọn; Manager không nhập lại trên từng gian vật lý.</p></div>
        {selectedDefinition ? <div className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <p><span className="text-xs text-stone-500">Kích thước chuẩn</span><br /><b>{selectedDefinition.lengthM} × {selectedDefinition.widthM} × {selectedDefinition.heightM} m</b></p>
          <p><span className="text-xs text-stone-500">Diện tích</span><br /><b>{selectedDefinition.areaM2.toLocaleString('vi-VN')} m²</b></p>
          <p><span className="text-xs text-stone-500">Thể tích</span><br /><b>{selectedDefinition.volumeM3.toLocaleString('vi-VN')} m³</b></p>
          <p><span className="text-xs text-stone-500">Tải trọng tối đa</span><br /><b>{selectedDefinition.maxLoadKg.toLocaleString('vi-VN')} kg</b></p>
        </div> : <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Chưa có dữ liệu UnitType tương ứng.</div>}
      </section>

      <section className="space-y-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Giá và chính sách đang áp dụng</p><p className="mt-1 text-xs text-stone-500">Chỉ đọc tại màn hình quản lý gian kho; không phải cấu hình giá hoặc chính sách toàn hệ thống.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-stone-200 p-3"><span className="text-xs text-stone-500">Giá chuẩn hiện hành</span><b className="mt-1 block">{selectedDefinition ? `${formatManagerMoney(selectedDefinition.monthlyPrice)}/tháng` : 'Chưa có dữ liệu'}</b></div>
          <div className="rounded-lg border border-stone-200 p-3"><span className="text-xs text-stone-500">Tiền đảm bảo theo chính sách hiện hành</span><b className="mt-1 block">{selectedTemplate ? formatManagerMoney(selectedTemplate.deposit) : 'Chưa có dữ liệu chính sách'}</b></div>
        </div>
        {selectedTemplate ? <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-sm font-semibold text-emerald-900">Hàng hóa được phép</p><ul className="mt-2 space-y-1 text-sm text-emerald-800">{selectedTemplate.allowedGoods.map(item => <li key={item}>✓ {item}</li>)}</ul></div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3"><p className="text-sm font-semibold text-red-900">Hàng hóa bị cấm</p><ul className="mt-2 space-y-1 text-sm text-red-800">{selectedTemplate.prohibitedGoods.map(item => <li key={item}>× {item}</li>)}</ul></div>
        </div> : <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Chưa có dữ liệu chính sách lưu trữ cho loại gian này.</div>}
      </section>

      <section className="space-y-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Tình trạng gian vật lý</p><p className="mt-1 text-xs text-stone-500">Kích thước cửa và điều kiện nhiệt độ hiện là thuộc tính của từng StorageUnit trong data model hiện tại.</p></div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Chiều rộng cửa (m) *" type="number" min="0" step="0.01" value={form.doorWidthM} onChange={event => setField('doorWidthM', event.target.value)} />
          <Input label="Chiều cao cửa (m) *" type="number" min="0" step="0.01" value={form.doorHeightM} onChange={event => setField('doorHeightM', event.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-stone-700"><input type="checkbox" checked={form.climate} onChange={event => setField('climate', event.target.checked)} /> Có kiểm soát nhiệt độ tại gian này</label>
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm"><span className="text-stone-500">Trạng thái ban đầu</span><b className="ml-2 text-emerald-700">Còn trống</b><p className="mt-1 text-xs text-stone-500">Hệ thống luôn tạo gian mới ở trạng thái còn trống; trạng thái đang sử dụng chỉ phát sinh từ luồng thuê/bàn giao.</p></div>
        <label className="space-y-1 text-sm font-medium text-stone-700">Ghi chú tình trạng<textarea className="min-h-20 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-normal" value={form.conditionNotes} onChange={event => setField('conditionNotes', event.target.value)} /></label>
      </section>

      {mode === 'edit' && unit && <div className="rounded-lg border border-red-200 p-4">
        <p className="font-semibold text-red-800">Xóa gian kho</p>
        <p className="mt-1 text-xs text-stone-600">Chỉ cho phép xóa gian còn trống và chưa từng phát sinh đặt chỗ, hồ sơ thuê, nhận/trả kho hoặc bảo trì.</p>
        {!canDelete && <p className="mt-2 text-xs font-medium text-red-700">{deleteBlockedReason}</p>}
        {confirmDelete ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-red-700">Xác nhận xóa vĩnh viễn {unit.code}?</span><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Không xóa</Button><Button variant="danger" size="sm" onClick={remove}>Xóa gian kho</Button></div></div> : <Button className="mt-3" variant="danger" size="sm" disabled={!canDelete} onClick={() => setConfirmDelete(true)}>Yêu cầu xóa</Button>}
      </div>}

      <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Hủy</Button><Button onClick={save}>{mode === 'create' ? 'Thêm gian kho' : 'Lưu thay đổi'}</Button></div>
    </div>
  </Modal>
}
