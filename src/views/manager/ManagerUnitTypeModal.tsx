import { useEffect, useState } from 'react'
import { Button, Modal } from '../../components/ui'
import ManagerWarehouseImageField from './ManagerWarehouseImageField'
import ManagerFormProgress from './ManagerFormProgress'
import { managerDisplayError } from './managerPresentation'
import { ApiClientError } from '../../services/apiClient'
import { createManagerUnitType, updateManagerUnitType, type ManagerUnitTypeInput } from '../../services/managerUnitTypeApi'
import { getManagerGoodsCatalog } from '../../services/managerGoodsCatalogApi'
import { subscribeGoodsCatalog } from '../../services/goodsCatalogEvents'
import type { CustomerUnitType, GoodsCatalog } from '../../services/customerReservationApi'
import {
  getManagerRackLayout, previewRackLayout, previewRackLayoutDraft,
  type RackConfiguration, type RackLayoutDraft, type RackPreview, type RackResult,
  type RackSpecification,
} from '../../services/rackLayoutApi'

const steps = ['Thông tin chung', 'Thông số gian kho', 'Cấu hình khung kệ', 'Thiết lập tấm kê', 'Loại hàng và xác nhận'] as const
const inputClass = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-stone-100'

type UnitTypeEditorTarget = CustomerUnitType & { zone?: string }

type UnitTypeForm = {
  code: string
  name: string
  description: string
  lengthM: string
  widthM: string
  heightM: string
  maxLoadKg: string
  aisleWidthM: string
  storageAisleWidthM: string
  gateWidthM: string
  gateHeightM: string
  lowestObstructionHeightM: string
  overheadClearanceM: string
  trolleyType: string
  physicalUnitCount: string
  zone: string
  imageUrl: string
  detailImageUrl: string
}

const text = (value: unknown, fallback = '') => value == null ? fallback : String(value)

function initialForm(initial?: UnitTypeEditorTarget): UnitTypeForm {
  return {
    code: text(initial?.code), name: text(initial?.name), description: text(initial?.description),
    lengthM: text(initial?.lengthM, '12'), widthM: text(initial?.widthM, '11.6'), heightM: text(initial?.heightM, '5'),
    maxLoadKg: text(initial?.maxLoadKg, '600'),
    aisleWidthM: text(initial?.aisleWidthM, '3.0'), storageAisleWidthM: text(initial?.storageAisleWidthM, '2.5'),
    gateWidthM: text(initial?.gateWidthM, '2.4'), gateHeightM: text(initial?.gateHeightM, '3.0'),
    lowestObstructionHeightM: text(initial?.lowestObstructionHeightM), overheadClearanceM: text(initial?.overheadClearanceM),
    trolleyType: text(initial?.trolleyType, 'Xe đẩy tay / xe sàn nhỏ'),
    physicalUnitCount: text(initial?.totalCount, '1'), zone: text(initial?.zone, 'Khu A'),
    imageUrl: text(initial?.imageUrl), detailImageUrl: text(initial?.detailImageUrl),
  }
}

type RackForm = RackSpecification & { requestedRackCount: number }

function initialRackForm(initial?: UnitTypeEditorTarget): RackForm {
  return {
    lengthCm: Math.max(1, Math.round(Number(initial?.rackLengthM ?? 4) * 100)),
    widthCm: Math.max(1, Math.round(Number(initial?.rackWidthM ?? 2) * 100)),
    heightCm: Math.max(1, Math.round(Number(initial?.rackHeightM ?? 4.5) * 100)),
    uprightFrameCount: 3,
    levelCount: 3,
    palletsPerCompartment: 1,
    maxRackLoadKg: 1200,
    maxBeamPairLoadKg: 100,
    requestedRackCount: Math.max(1, Math.floor(Number(initial?.rackCount ?? 4))),
  }
}

const format = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value)
  ? '-' : value.toLocaleString('vi-VN', { maximumFractionDigits: digits })
const cm = (value: number | null | undefined) => value == null ? '-' : `${format(value)} cm`
const kg = (value: number | null | undefined) => value == null ? '-' : `${format(value)} kg`

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-stone-50 p-3">
    <dt className="text-xs text-stone-500">{label}</dt>
    <dd className="mt-1 font-semibold text-stone-900">{value}</dd>
  </div>
}

export default function ManagerUnitTypeModal({ open, facilityId, onClose, onCreated, initial }: {
  open: boolean
  facilityId: string
  onClose: () => void
  onCreated: () => void
  initial?: UnitTypeEditorTarget
}) {
  const [form, setForm] = useState<UnitTypeForm>(() => initialForm(initial))
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [imageReading, setImageReading] = useState(false)
  const [error, setError] = useState<string>()
  const [stepError, setStepError] = useState<string>()
  const [metadataDirty, setMetadataDirty] = useState(false)
  const [rackDirty, setRackDirty] = useState(!initial)
  const [rackLoading, setRackLoading] = useState(false)
  const [savedRackConfiguration, setSavedRackConfiguration] = useState<RackConfiguration | null>(null)
  const [rackForm, setRackForm] = useState<RackForm>(() => initialRackForm(initial))
  const [rackResult, setRackResult] = useState<RackResult | null>(null)
  const [rackPreview, setRackPreview] = useState<RackPreview | null>(null)
  const [goodsCatalog, setGoodsCatalog] = useState<GoodsCatalog>()
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initial?.acceptedGoodsCategoryIds || [])
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(initial?.acceptedGoodsMaterialIds || [])
  const [safetyOpen, setSafetyOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousDocumentOverflow
    }
  }, [open])

  const physicalUnitCount = Number(form.physicalUnitCount)
  const validPhysicalUnitCount = form.physicalUnitCount.trim() !== '' && Number.isInteger(physicalUnitCount) && physicalUnitCount >= 0
  const confirmedResult = rackPreview?.result ?? rackResult
  const rackDraft: RackLayoutDraft = {
    lengthM: Number(form.lengthM), widthM: Number(form.widthM), heightM: Number(form.heightM), maxLoadKg: Number(form.maxLoadKg),
    rackCount: rackForm.requestedRackCount,
    aisleWidthM: form.aisleWidthM.trim() ? Number(form.aisleWidthM) : null,
    rackSpecification: {
      lengthCm: rackForm.lengthCm, widthCm: rackForm.widthCm, heightCm: rackForm.heightCm,
      uprightFrameCount: rackForm.uprightFrameCount, levelCount: rackForm.levelCount,
      palletsPerCompartment: rackForm.palletsPerCompartment, maxRackLoadKg: rackForm.maxRackLoadKg,
      maxBeamPairLoadKg: rackForm.maxBeamPairLoadKg,
    },
    storageAisleWidthM: form.storageAisleWidthM.trim() ? Number(form.storageAisleWidthM) : null,
    gateWidthM: form.gateWidthM.trim() ? Number(form.gateWidthM) : null,
    gateHeightM: form.gateHeightM.trim() ? Number(form.gateHeightM) : null,
    lowestObstructionHeightM: form.lowestObstructionHeightM.trim() ? Number(form.lowestObstructionHeightM) : null,
    overheadClearanceM: form.overheadClearanceM.trim() ? Number(form.overheadClearanceM) : null,
  }

  useEffect(() => {
    if (!open) return
    const next = initialForm(initial)
    setForm(next)
    setStep(0)
    setBusy(false)
    setError(undefined)
    setStepError(undefined)
    setMetadataDirty(false)
    setRackDirty(!initial)
    setRackPreview(null)
    setRackResult(null)
    setSavedRackConfiguration(null)
    setRackForm(initialRackForm(initial))
    setSelectedCategories(initial?.acceptedGoodsCategoryIds || [])
    setSelectedMaterials(initial?.acceptedGoodsMaterialIds || [])
    setSafetyOpen(false)

    let cancelled = false
    const loadCatalog = () => void getManagerGoodsCatalog().then(value => {
      if (!cancelled) setGoodsCatalog(value)
    }).catch(cause => { if (!cancelled) setError(managerDisplayError(cause)) })
    loadCatalog()
    const unsubscribe = subscribeGoodsCatalog(loadCatalog)
    if (initial) {
      setRackLoading(true)
      void getManagerRackLayout(initial.id).then(saved => {
        if (cancelled) return
        if (saved) {
          const savedRack = saved.result.configuration.racks[0]
          setSavedRackConfiguration(saved.result.configuration)
          if (savedRack) setRackForm(current => ({
            ...current,
            lengthCm: savedRack.lengthCm,
            widthCm: savedRack.widthCm,
            heightCm: savedRack.heightCm,
            uprightFrameCount: savedRack.uprightFrameCount,
            levelCount: savedRack.levelCount,
            palletsPerCompartment: savedRack.palletsPerCompartment,
            maxRackLoadKg: savedRack.maxRackLoadKg,
            maxBeamPairLoadKg: savedRack.maxBeamPairLoadKg ?? current.maxBeamPairLoadKg,
            requestedRackCount: saved.result.rackCount ?? saved.result.configuration.requestedRackCount ?? current.requestedRackCount,
          }))
          setRackResult(saved.result)
        } else {
          setRackDirty(true)
        }
      }).catch(cause => {
        if (!cancelled) {
          if (cause instanceof ApiClientError && cause.status === 404) setRackDirty(true)
          else setError(managerDisplayError(cause))
        }
      }).finally(() => { if (!cancelled) setRackLoading(false) })
    } else {
      setRackLoading(false)
    }
    return () => { cancelled = true; unsubscribe() }
  }, [open, initial?.id])

  useEffect(() => {
    if (!goodsCatalog || !open) return
    const activeCategories = goodsCatalog.categories.filter(category => category.status === 'ACTIVE')
    const categoryIds = new Set(activeCategories.map(category => category.id))
    const materialIds = new Set(activeCategories.flatMap(category => category.materials.filter(material => material.status === 'ACTIVE').map(material => material.id)))
    if (selectedCategories.some(id => !categoryIds.has(id)) || selectedMaterials.some(id => !materialIds.has(id))) {
      setSelectedCategories(current => current.filter(id => categoryIds.has(id)))
      setSelectedMaterials(current => current.filter(id => materialIds.has(id)))
      setMetadataDirty(true)
      setError('Một số loại hàng hoặc vật liệu đã ngừng áp dụng. Vui lòng kiểm tra lại danh mục trước khi lưu.')
    }
  }, [goodsCatalog, open, selectedCategories, selectedMaterials])

  function changeField(key: keyof UnitTypeForm, value: string) {
    setForm(current => ({ ...current, [key]: value }))
    setMetadataDirty(true)
    if (initial && ['lengthM', 'widthM', 'heightM', 'maxLoadKg', 'aisleWidthM', 'storageAisleWidthM', 'gateWidthM', 'gateHeightM', 'lowestObstructionHeightM', 'overheadClearanceM'].includes(key)) {
      setRackDirty(true)
    }
  }

  function changeRackField(key: keyof RackForm, value: number) {
    setRackForm(current => ({ ...current, [key]: value }))
    setRackDirty(true)
    setRackPreview(null)
    setRackResult(null)
    setStepError(undefined)
  }

  function numericIssue(value: number | undefined, label: string, integer = false, min = 0, max?: number) {
    if (value === undefined || !Number.isFinite(value) || value < min || (max !== undefined && value > max)
      || (integer && !Number.isInteger(value))) {
      const range = max === undefined ? (min === 0 ? 'không âm' : `từ ${min} trở lên`) : `từ ${min} đến ${max}`
      return `Vui lòng nhập “${label}” là số ${integer ? 'nguyên ' : ''}${range}.`
    }
    return undefined
  }

  function rackPreviewError(cause: unknown) {
    if (cause instanceof ApiClientError) {
      const details = Array.isArray(cause.details)
        ? cause.details.filter((value): value is string => typeof value === 'string').join(' ')
        : typeof cause.details === 'string'
          ? cause.details
          : cause.details && typeof cause.details === 'object'
            ? Object.values(cause.details as Record<string, unknown>)
              .filter((value): value is string => typeof value === 'string').join(' ')
            : ''
      const searchable = `${cause.message} ${details}`
      if (cause.status === 409) {
        if (/đã được lưu trữ|đã lưu trữ/i.test(searchable)) {
          return 'Loại kho đã được lưu trữ nên không thể thay đổi cấu hình.'
        }
        if (/còn gian|đang thuê|giữ chỗ|đã phân|đã thanh toán cọc/i.test(searchable)) {
          return 'Loại kho còn gian đang sử dụng hoặc đang giữ chỗ. Không thể thay đổi sức chứa và cấu hình kệ cho đến khi các gian này được giải phóng.'
        }
      }
      if (cause.status === 400 || cause.status === 422) {
        const friendlyDetails = details.replace(/R\d+:\s*/gi, '').trim()
        if (/cao độ vật cản|vật cản.*chiều cao kho|thấp nhất.*chiều cao kho/i.test(searchable)) {
          return 'Chiều cao đến vật cản thấp nhất không được lớn hơn chiều cao gian kho.'
        }
        if (/chiều cao sử dụng.*nhỏ hơn chiều cao khung|chiều cao khung.*vượt quá chiều cao sử dụng/i.test(searchable)) {
          return 'Chiều cao khung vượt quá chiều cao sử dụng của gian kho sau khi tính vật cản và khoảng hở an toàn.'
        }
        if (/khoảng hở.*chiều cao sử dụng|khoảng hở.*chiều cao kho|chiều cao sử dụng.*lớn hơn 0/i.test(searchable)) {
          return 'Khoảng hở an toàn phía trên kệ phải nhỏ hơn chiều cao sử dụng của gian kho.'
        }
        if (/chiều cao khung.*vượt chiều cao kho/i.test(searchable)) {
          return 'Chiều cao khung không được lớn hơn chiều cao gian kho.'
        }
        if (/chiều rộng thông thủy.*cổng.*chiều rộng gian kho/i.test(searchable)) {
          return 'Chiều rộng thông thủy cửa kho không được lớn hơn chiều rộng gian kho.'
        }
        if (/chiều cao thông thủy.*cổng.*chiều cao gian kho/i.test(searchable)) {
          return 'Chiều cao thông thủy cửa kho không được lớn hơn chiều cao gian kho.'
        }
        if (/chiều rộng lối đi chính/i.test(searchable)) return 'Chiều rộng lối đi chính không thể lớn hơn kích thước gian kho.'
        if (/chiều rộng lối đi giữa các kệ/i.test(searchable)) return 'Chiều rộng lối đi giữa các kệ không thể lớn hơn kích thước gian kho.'
        if (/tối đa\s+\d+\s+khung|kích thước tối đa theo hướng/i.test(searchable)) return friendlyDetails
        if (/giới hạn tải mỗi khoang|giới hạn tải mỗi khung|tải hiệu dụng của khung/i.test(searchable)) return friendlyDetails
        if (/số tấm kê mỗi khoang.*tối đa/i.test(searchable)) return friendlyDetails
        if (/chiều dài tấm kê|chiều rộng tấm kê|mép ngoài hai dầm/i.test(searchable)) return friendlyDetails
        const maxLevelMatch = searchable.match(/tối đa\s+(\d+)\s+tầng/i)
        if (maxLevelMatch || /số tầng/i.test(searchable)) {
          return maxLevelMatch
            ? `Số tầng vượt quá chiều cao khung. Với chiều cao hiện tại, hệ thống chỉ cho phép tối đa ${maxLevelMatch[1]} tầng.`
            : 'Số tầng vượt quá khả năng chiều cao khung. Hãy giảm số tầng hoặc tăng chiều cao khung.'
        }
        if (/chồng|tường|lối|bố trí|không đủ không gian/i.test(searchable)) return 'Không thể bố trí số khung đã nhập trong gian kho. Hãy giảm số khung hoặc điều chỉnh kích thước khung và lối đi.'
        if (/số tấm kê.*kích thước khoang/i.test(searchable)) return 'Số tấm kê chưa phù hợp với kích thước khoang. Hãy giảm số tấm kê mỗi khoang.'
        if (/tải trọng|giới hạn tải/i.test(searchable)) return 'Giới hạn tải của cấu hình chưa phù hợp. Hãy kiểm tra lại các mức tải đã nhập.'
        if (/tấm kê|khoang/i.test(searchable)) return friendlyDetails || 'Cấu hình tấm kê hoặc khoang chưa phù hợp. Hãy kiểm tra lại kích thước khung và khoang.'
      }
    }
    return managerDisplayError(cause)
  }

  function validateWarehouseRelationships(): string | undefined {
    const warehouseWidthM = Number(form.widthM)
    const warehouseHeightM = Number(form.heightM)
    const gateWidthM = form.gateWidthM.trim() ? Number(form.gateWidthM) : undefined
    const gateHeightM = form.gateHeightM.trim() ? Number(form.gateHeightM) : undefined
    const obstructionHeightM = form.lowestObstructionHeightM.trim()
      ? Number(form.lowestObstructionHeightM) : undefined
    const overheadClearanceM = form.overheadClearanceM.trim()
      ? Number(form.overheadClearanceM) : undefined

    if (obstructionHeightM !== undefined && obstructionHeightM > warehouseHeightM) {
      return 'Chiều cao đến vật cản thấp nhất không được lớn hơn chiều cao gian kho.'
    }
    if (overheadClearanceM !== undefined) {
      const limitingHeightM = Math.min(warehouseHeightM, obstructionHeightM ?? warehouseHeightM)
      if (overheadClearanceM >= limitingHeightM) {
        return 'Khoảng hở an toàn phía trên kệ phải nhỏ hơn chiều cao gian kho và cao độ vật cản (nếu có).'
      }
    }
    if (gateWidthM !== undefined && gateWidthM > warehouseWidthM) {
      return 'Chiều rộng thông thủy cửa kho không được lớn hơn chiều rộng gian kho.'
    }
    if (gateHeightM !== undefined && gateHeightM > warehouseHeightM) {
      return 'Chiều cao thông thủy cửa kho không được lớn hơn chiều cao gian kho.'
    }
    return undefined
  }

  function validateRackRelationships(): string | undefined {
    const warehouseLengthCm = Number(form.lengthM) * 100
    const warehouseWidthCm = Number(form.widthM) * 100
    const warehouseHeightCm = Number(form.heightM) * 100
    const rackLengthCm = rackForm.lengthCm
    const rackWidthCm = rackForm.widthCm
    const rackHeightCm = rackForm.heightCm

    if (rackHeightCm > warehouseHeightCm) {
      return 'Chiều cao khung không được lớn hơn chiều cao gian kho.'
    }
    const fitsNormal = rackLengthCm <= warehouseLengthCm && rackWidthCm <= warehouseWidthCm
    const fitsRotated = rackLengthCm <= warehouseWidthCm && rackWidthCm <= warehouseLengthCm
    if (!fitsNormal && !fitsRotated) {
      return 'Kích thước ngoài của khung không vừa với chiều dài và chiều rộng gian kho. Hãy giảm kích thước khung.'
    }

    const obstructionHeightM = form.lowestObstructionHeightM.trim()
      ? Number(form.lowestObstructionHeightM) : undefined
    const overheadClearanceM = form.overheadClearanceM.trim()
      ? Number(form.overheadClearanceM) : undefined
    if (obstructionHeightM !== undefined && overheadClearanceM !== undefined) {
      const usableHeightCm = Math.min(Number(form.heightM), obstructionHeightM) * 100 - overheadClearanceM * 100
      if (rackHeightCm > usableHeightCm) {
        return 'Chiều cao khung vượt quá chiều cao sử dụng của gian kho sau khi tính vật cản và khoảng hở an toàn.'
      }
    }
    return undefined
  }

  function validateStep(index: number): string | undefined {
    const validNumber = (key: keyof UnitTypeForm, min: number, integer = false) => {
      const value = Number(form[key])
      return form[key].trim() !== '' && Number.isFinite(value) && value >= min && (!integer || Number.isInteger(value))
    }
    if (index === 0) {
      if (!form.name.trim()) return 'Vui lòng nhập tên loại kho.'
      if (form.name.trim().length > 100 || form.description.trim().length > 500) return 'Tên loại kho tối đa 100 ký tự và mô tả tối đa 500 ký tự.'
      if (!validPhysicalUnitCount) return 'Số lượng gian kho phải là số nguyên không âm.'
      if (physicalUnitCount > 0 && !form.zone.trim()) return 'Khi tạo gian kho, cần nhập khu vực.'
      if (form.zone.trim().length > 32) return 'Khu vực tối đa 32 ký tự.'
      return undefined
    }
    if (index === 1) {
      if ((['lengthM', 'widthM', 'heightM', 'maxLoadKg'] as const).some(key => !validNumber(key, 0.01))) return 'Chiều dài, chiều rộng, chiều cao và giới hạn hàng phải từ 0,01 trở lên.'
      if (!validNumber('aisleWidthM', 0.01)) return 'Chiều rộng lối đi chính phải từ 0,01 m trở lên.'
      if ((['storageAisleWidthM', 'gateWidthM', 'gateHeightM', 'lowestObstructionHeightM'] as const).some(key => form[key].trim() && !validNumber(key, 0.01))) return 'Kích thước lối đi, cửa kho và cao độ vật cản phải lớn hơn 0.'
      if (form.overheadClearanceM.trim() && !validNumber('overheadClearanceM', 0)) return 'Khoảng hở an toàn phải là số không âm.'
      if (Boolean(form.gateWidthM.trim()) !== Boolean(form.gateHeightM.trim())) return 'Nếu nhập kích thước cửa kho, cần nhập cả chiều rộng và chiều cao.'
      if (Boolean(form.lowestObstructionHeightM.trim()) !== Boolean(form.overheadClearanceM.trim())) return 'Nếu nhập thông số an toàn, cần nhập cả cao độ vật cản và khoảng hở.'
      const warehouseIssue = validateWarehouseRelationships()
      if (warehouseIssue) return warehouseIssue
      const warehouseLengthM = Number(form.lengthM)
      const warehouseWidthM = Number(form.widthM)
      const mainAisleM = Number(form.aisleWidthM)
      const storageAisleM = form.storageAisleWidthM.trim() ? Number(form.storageAisleWidthM) : undefined
      if (mainAisleM > Math.max(warehouseLengthM, warehouseWidthM)) return 'Chiều rộng lối đi chính không thể lớn hơn kích thước gian kho.'
      if (storageAisleM !== undefined && storageAisleM > Math.max(warehouseLengthM, warehouseWidthM)) return 'Chiều rộng lối đi giữa các kệ không thể lớn hơn kích thước gian kho.'
      if (!form.trolleyType.trim() || form.trolleyType.trim().length > 160) return 'Vui lòng nhập thiết bị vận chuyển hàng, tối đa 160 ký tự.'
      return undefined
    }
    if (index === 2) {
      if (rackLoading) return 'Đang tải cấu hình khung kệ.'
      const fields: [number | undefined, string, boolean, number, number | undefined][] = [
        [rackForm.lengthCm, 'Chiều dài khung', false, 0.01, undefined], [rackForm.widthCm, 'Chiều rộng khung', false, 0.01, undefined],
        [rackForm.heightCm, 'Chiều cao khung', false, 0.01, undefined], [rackForm.uprightFrameCount, 'Số bộ trụ đứng', true, 2, 20],
        [rackForm.levelCount, 'Số cặp dằm ngang', true, 1, 100], [rackForm.requestedRackCount, 'Số khung mỗi gian', true, 1, 100],
        [rackForm.maxBeamPairLoadKg, 'Giới hạn chịu tải mỗi khoang', false, 0.01, undefined], [rackForm.maxRackLoadKg, 'Giới hạn chịu tải mỗi khung', false, 0.01, undefined],
      ]
      for (const [value, label, integer, min, max] of fields) {
        const issue = numericIssue(value, label, integer, min, max)
        if (issue) return issue
      }
      const rackIssue = validateRackRelationships()
      if (rackIssue) return rackIssue
      return undefined
    }
    if (index === 3) {
      const value = rackForm.palletsPerCompartment
      return numericIssue(value, 'Số tấm kê mỗi khoang', true, 1, 20)
    }
    if (!confirmedResult) return 'Cần kiểm tra cấu hình khung kệ và tấm kê trước khi lưu.'
    if (!selectedCategories.length) return 'Vui lòng chọn ít nhất một loại hàng được nhận.'
    return undefined
  }

  async function previewRack() {
    if (busy) return false
    setBusy(true)
    setStepError(undefined)
    try {
      const requestConfiguration = initial && savedRackConfiguration ? {
        ...savedRackConfiguration,
        racks: savedRackConfiguration.racks.map((rack, index) => index === 0 ? {
          ...rack,
          lengthCm: rackForm.lengthCm,
          widthCm: rackForm.widthCm,
          heightCm: rackForm.heightCm,
          uprightFrameCount: rackForm.uprightFrameCount,
          levelCount: rackForm.levelCount,
          palletsPerCompartment: rackForm.palletsPerCompartment,
          maxRackLoadKg: rackForm.maxRackLoadKg,
          maxBeamPairLoadKg: rackForm.maxBeamPairLoadKg,
        } : rack),
        requestedRackCount: rackForm.requestedRackCount,
      } satisfies RackConfiguration : undefined
      const result = initial
        ? requestConfiguration
          ? await previewRackLayout(initial.id, requestConfiguration)
          : await previewRackLayoutDraft(facilityId, rackDraft)
        : await previewRackLayoutDraft(facilityId, rackDraft)
      setSavedRackConfiguration(result.result.configuration)
      setRackPreview(result)
      setRackResult(result.result)
      return true
    } catch (cause) {
      setStepError(rackPreviewError(cause))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function next() {
    if (busy || imageReading) return
    const issue = validateStep(step)
    setStepError(issue)
    if (issue) return
    // An unchanged existing layout is already loaded from Backend. Do not
    // re-preview it: previewing an occupied or held type is intentionally
    // blocked, although reviewing or editing non-capacity metadata remains
    // allowed. A changed rack or warehouse field must be previewed.
    const needsRackPreview = step === 2 || step === 3
      ? !initial || rackDirty || !rackResult
      : false
    if (needsRackPreview) {
      const ok = await previewRack()
      if (!ok) return
    }
    setStep(Math.min(4, step + 1))
  }

  async function save() {
    if (busy || imageReading) return
    const issue = validateStep(4)
    setStepError(issue)
    if (issue) return
    const result = confirmedResult
    if (!result) return
    setBusy(true)
    setError(undefined)
    try {
      const derivedRack = result.configuration.racks[0]
      const input: ManagerUnitTypeInput = {
        code: initial ? form.code.trim().toUpperCase() : null,
        name: form.name.trim(), description: form.description.trim() || null,
        lengthM: Number(form.lengthM), widthM: Number(form.widthM), heightM: Number(form.heightM), maxLoadKg: Number(form.maxLoadKg),
        rackCount: result.rackCount ?? result.racks.length,
        rackLengthM: Number((derivedRack.lengthCm / 100).toFixed(2)), rackWidthM: Number((derivedRack.widthCm / 100).toFixed(2)),
        rackHeightM: Number((derivedRack.heightCm / 100).toFixed(2)), aisleWidthM: Number(form.aisleWidthM),
        storageAisleWidthM: form.storageAisleWidthM.trim() ? Number(form.storageAisleWidthM) : null,
        gateWidthM: form.gateWidthM.trim() ? Number(form.gateWidthM) : null, gateHeightM: form.gateHeightM.trim() ? Number(form.gateHeightM) : null,
        lowestObstructionHeightM: form.lowestObstructionHeightM.trim() ? Number(form.lowestObstructionHeightM) : null,
        overheadClearanceM: form.overheadClearanceM.trim() ? Number(form.overheadClearanceM) : null,
        trolleyType: form.trolleyType.trim(), smallBoxCapacity: result.smallBoxesPerUnit, largeBoxCapacity: result.largeBoxesPerUnit,
        physicalUnitCount, zone: form.zone.trim(), imageUrl: form.imageUrl.trim() || null, detailImageUrl: form.detailImageUrl.trim() || null,
        acceptedGoodsCategoryIds: selectedCategories, acceptedGoodsMaterialIds: selectedMaterials,
      }
      if (!initial) {
        if (!rackPreview) throw new Error('Cấu hình khung kệ chưa có bản xem trước hợp lệ.')
        await createManagerUnitType(facilityId, { ...input, rackLayout: { configuration: rackPreview.result.configuration, previewKey: rackPreview.previewKey } })
      } else {
        // The form is also used to review an existing configuration. If the
        // Manager opens it and confirms the already valid values without
        // editing anything, close it cleanly instead of sending a no-op PATCH
        // that the Backend correctly rejects as an unchanged request.
        if (!metadataDirty && !rackDirty) {
          onClose()
          return
        }
        if (rackDirty) {
          if (!rackPreview) throw new Error('Cấu hình khung kệ chưa có bản xem trước hợp lệ.')
        }
        await updateManagerUnitType(initial.id, {
          ...input,
          rackLayout: rackDirty && rackPreview
            ? { configuration: rackPreview.result.configuration, previewKey: rackPreview.previewKey }
            : undefined,
        })
      }
      onCreated()
    } catch (cause) {
      if (cause instanceof ApiClientError) setError(managerDisplayError(cause))
      else setError(cause instanceof Error ? cause.message : managerDisplayError(cause))
    } finally {
      setBusy(false)
    }
  }

  function field(key: keyof UnitTypeForm, label: string, type = 'text', extraClass = '') {
    return <label className={`block text-sm font-medium text-stone-700 ${extraClass}`}>{label}
      <input className={`${inputClass} mt-1`} disabled={busy || imageReading} type={type} value={form[key]} onChange={event => changeField(key, event.target.value)} />
    </label>
  }

  const activeCategories = goodsCatalog?.categories.filter(category => category.status === 'ACTIVE') ?? []

  return <Modal open={open} onClose={() => { if (!busy && !imageReading) onClose() }} size="xl" hideHeader
    className="flex max-h-[calc(100vh-32px)] flex-col overflow-hidden p-0" contentClassName="flex min-h-0 flex-col p-0">
    <header className="shrink-0 border-b border-stone-200 bg-white px-4 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div><h2 id="modal-title" className="text-lg font-bold text-stone-900">{initial ? 'Chỉnh sửa loại kho' : 'Thêm loại kho'}</h2><p className="mt-1 text-sm text-stone-500">Khai báo một cấu hình thống nhất cho loại kho.</p></div>
        <button type="button" aria-label="Đóng cửa sổ" disabled={busy} onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-xl leading-none text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:cursor-not-allowed">×</button>
      </div>
      <div className="mt-4"><ManagerFormProgress steps={steps} current={step} /></div>
    </header>
    <div className="min-h-0 max-h-[calc(100vh-220px)] overflow-y-auto p-4 sm:p-6">
      {step === 0 && <section className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {field('name', 'Tên loại kho *')}
          {initial && <div className="rounded-lg bg-stone-50 p-3 text-sm text-stone-600"><span className="block text-xs text-stone-500">Mã loại kho</span><span className="mt-1 block font-mono font-semibold text-stone-900">{form.code || '-'}</span></div>}
        </div>
        <label className="block text-sm font-medium text-stone-700">Mô tả
          <textarea className={`${inputClass} mt-1 min-h-24 resize-y`} disabled={busy || imageReading} value={form.description} onChange={event => changeField('description', event.target.value)} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('physicalUnitCount', 'Số lượng gian kho', 'number')}
          {field('zone', 'Khu vực')}
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <ManagerWarehouseImageField label="Ảnh tổng quan" value={form.imageUrl} disabled={busy || imageReading} onChange={value => { changeField('imageUrl', value) }} onReading={setImageReading} onError={setError} />
          <ManagerWarehouseImageField label="Ảnh chi tiết hoặc sơ đồ" value={form.detailImageUrl} disabled={busy || imageReading} onChange={value => { changeField('detailImageUrl', value) }} onReading={setImageReading} onError={setError} />
        </div>
      </section>}
      {step === 1 && <section className="space-y-5">
        <section className="space-y-4 rounded-xl border border-stone-200 p-4">
          <h3 className="font-semibold text-stone-900">Kích thước và tải trọng</h3>
          <div className="grid gap-4 sm:grid-cols-3">{field('lengthM', 'Chiều dài gian kho (m)', 'number')}{field('widthM', 'Chiều rộng gian kho (m)', 'number')}{field('heightM', 'Chiều cao gian kho (m)', 'number')}</div>
          {field('maxLoadKg', 'Giới hạn khối lượng hàng (kg)', 'number')}
        </section>
        <section className="space-y-4 rounded-xl border border-stone-200 p-4">
          <h3 className="font-semibold text-stone-900">Lối đi</h3>
          <div className="grid gap-4 sm:grid-cols-2">{field('aisleWidthM', 'Chiều rộng tối thiểu lối đi chính (m)', 'number')}{field('storageAisleWidthM', 'Chiều rộng tối thiểu lối đi giữa các kệ (m)', 'number')}{field('trolleyType', 'Thiết bị vận chuyển hàng', 'text', 'sm:col-span-2')}</div>
        </section>
        <section className="space-y-4 rounded-xl border border-stone-200 p-4">
          <h3 className="font-semibold text-stone-900">Kích thước thông thủy cửa kho</h3>
          <div className="grid gap-4 sm:grid-cols-2">{field('gateWidthM', 'Chiều rộng thông thủy cửa kho (m)', 'number')}{field('gateHeightM', 'Chiều cao thông thủy cửa kho (m)', 'number')}</div>
        </section>
        <details open={safetyOpen} onToggle={event => setSafetyOpen(event.currentTarget.open)} className="rounded-xl border border-stone-200">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-stone-900">Thông số an toàn bổ sung <span className="float-right text-xs font-normal text-stone-500">Không bắt buộc</span></summary>
          <div className="grid gap-4 border-t border-stone-200 p-4 sm:grid-cols-2">{field('lowestObstructionHeightM', 'Chiều cao đến vật cản thấp nhất (m)', 'number')}{field('overheadClearanceM', 'Khoảng hở an toàn phía trên kệ (m)', 'number')}</div>
        </details>
      </section>}
      {step === 2 && <section className="space-y-5">
        <section className="space-y-4 rounded-xl border border-stone-200 p-4">
          <h3 className="font-semibold text-stone-900">Kích thước khung kệ</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-medium text-stone-700">Chiều dài khung (cm)<input className={`${inputClass} mt-1`} type="number" value={rackForm.lengthCm} onChange={event => changeRackField('lengthCm', event.target.valueAsNumber)} /></label>
            <label className="text-sm font-medium text-stone-700">Chiều rộng khung (cm)<input className={`${inputClass} mt-1`} type="number" value={rackForm.widthCm} onChange={event => changeRackField('widthCm', event.target.valueAsNumber)} /></label>
            <label className="text-sm font-medium text-stone-700">Chiều cao khung (cm)<input className={`${inputClass} mt-1`} type="number" value={rackForm.heightCm} onChange={event => changeRackField('heightCm', event.target.valueAsNumber)} /></label>
          </div>
        </section>
        <section className="space-y-4 rounded-xl border border-stone-200 p-4">
          <h3 className="font-semibold text-stone-900">Cấu tạo và số lượng</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-medium text-stone-700">Số bộ trụ đứng<input className={`${inputClass} mt-1`} type="number" min={2} max={20} value={rackForm.uprightFrameCount} onChange={event => changeRackField('uprightFrameCount', event.target.valueAsNumber)} /></label>
            <label className="text-sm font-medium text-stone-700">Số cặp dằm ngang<input className={`${inputClass} mt-1`} type="number" min={1} value={rackForm.levelCount} onChange={event => changeRackField('levelCount', event.target.valueAsNumber)} /></label>
            <label className="text-sm font-medium text-stone-700">Số khung mỗi gian<input className={`${inputClass} mt-1`} type="number" min={1} value={rackForm.requestedRackCount} onChange={event => changeRackField('requestedRackCount', event.target.valueAsNumber)} /></label>
          </div>
        </section>
        <section className="space-y-4 rounded-xl border border-stone-200 p-4">
          <h3 className="font-semibold text-stone-900">Giới hạn chịu tải</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-stone-700">Giới hạn chịu tải mỗi khoang (kg)<input className={`${inputClass} mt-1`} type="number" min={0.01} value={rackForm.maxBeamPairLoadKg} onChange={event => changeRackField('maxBeamPairLoadKg', event.target.valueAsNumber)} /></label>
            <label className="text-sm font-medium text-stone-700">Giới hạn chịu tải mỗi khung (kg)<input className={`${inputClass} mt-1`} type="number" min={0.01} value={rackForm.maxRackLoadKg} onChange={event => changeRackField('maxRackLoadKg', event.target.valueAsNumber)} /></label>
          </div>
        </section>
        {rackLoading && <p role="status" className="rounded-lg bg-stone-50 p-3 text-sm text-stone-600">Đang tải cấu hình đã lưu…</p>}
        {confirmedResult && <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Stat label="Số tầng đã cấu hình / tối đa" value={`${format(confirmedResult.levelsPerRack, 0)} / ${format(confirmedResult.maxLevelsByHeight, 0)} tầng`} /><Stat label="Số khoang mỗi tầng" value={`${format(confirmedResult.compartmentsPerLevel, 0)} khoang`} /><Stat label="Tổng số khoang" value={`${format(confirmedResult.totalCompartments, 0)} khoang`} /><Stat label="Kích thước thông thủy khoang" value={`${cm(confirmedResult.compartmentClearLengthCm)} × ${cm(confirmedResult.compartmentClearWidthCm)} × ${cm(confirmedResult.compartmentClearHeightCm)}`} /><Stat label="Chiều cao hàng tối đa" value={cm(confirmedResult.maxCargoHeightCm)} /></dl>}
      </section>}
      {step === 3 && <section className="space-y-5">
        <section className="space-y-4 rounded-xl border border-stone-200 p-4">
          <h3 className="font-semibold text-stone-900">Số lượng tấm kê</h3>
          <label className="block text-sm font-medium text-stone-700">Số tấm kê mỗi khoang<input className={`${inputClass} mt-1`} type="number" min={1} max={20} value={rackForm.palletsPerCompartment} onChange={event => changeRackField('palletsPerCompartment', event.target.valueAsNumber)} /></label>
        </section>
        {confirmedResult && <dl className="grid gap-3 sm:grid-cols-2"><Stat label="Kích thước mỗi tấm kê" value={`${cm(confirmedResult.palletLengthCm)} × ${cm(confirmedResult.palletWidthCm)} × ${cm(confirmedResult.palletHeightCm)}`} /><Stat label="Khối lượng mỗi tấm kê" value={kg(confirmedResult.palletEmptyWeightKg ?? confirmedResult.palletEmptyKg)} /><Stat label="Giới hạn tải hàng mỗi tấm kê" value={kg(confirmedResult.palletMaxPayloadKg ?? confirmedResult.maxPalletPayloadKg)} /><Stat label="Tổng số tấm kê" value={`${format(confirmedResult.totalPallets ?? confirmedResult.palletSlotCount, 0)} tấm`} /><Stat label="Tổng khối lượng tấm kê" value={kg(confirmedResult.totalPalletEmptyWeightKg)} /><Stat label="Khối lượng hàng tối đa mỗi khoang" value={kg(confirmedResult.maxCargoWeightPerCompartmentKg)} /><Stat label="Khối lượng hàng tối đa mỗi khung" value={kg(confirmedResult.maxCargoWeightPerRackKg)} /></dl>}
      </section>}
      {step === 4 && <section className="space-y-5">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-stone-900">Loại hàng được nhận</h3>
            {activeCategories.length > 0 && (
              <button
                type="button"
                className="text-xs font-semibold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
                onClick={() => {
                  setMetadataDirty(true)
                  const allCatIds = activeCategories.map(c => c.id)
                  const allMatIds = activeCategories.flatMap(c => c.materials.filter(m => m.status === 'ACTIVE').map(m => m.id))
                  const allSelected = allCatIds.every(id => selectedCategories.includes(id))
                  if (allSelected) {
                    setSelectedCategories([])
                    setSelectedMaterials([])
                  } else {
                    setSelectedCategories(allCatIds)
                    setSelectedMaterials(allMatIds)
                  }
                }}
              >
                {activeCategories.every(c => selectedCategories.includes(c.id)) ? "Bỏ chọn tất cả nhóm hàng" : "Chọn tất cả nhóm hàng"}
              </button>
            )}
          </div>
          {!goodsCatalog ? (
            <p className="text-sm text-stone-500">Đang tải danh mục hàng hóa…</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              {activeCategories.map(category => {
                const checked = selectedCategories.includes(category.id)
                const materials = category.materials.filter(material => material.status === 'ACTIVE')
                const selectedCatMaterialsCount = materials.filter(m => selectedMaterials.includes(m.id)).length
                const allMaterialsChecked = materials.length > 0 && selectedCatMaterialsCount === materials.length
                return (
                  <details key={category.id} className="rounded-lg border border-stone-200 bg-white shadow-xs">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-sm font-semibold text-stone-900 select-none hover:bg-stone-50 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onClick={event => event.stopPropagation()}
                          onChange={event => {
                            setMetadataDirty(true)
                            const isChecking = event.target.checked
                            setSelectedCategories(current => isChecking ? [...new Set([...current, category.id])] : current.filter(id => id !== category.id))
                            if (!isChecking) {
                              setSelectedMaterials(current => current.filter(id => !materials.some(material => material.id === id)))
                            } else {
                              const detailsEl = (event.currentTarget as HTMLElement).closest('details')
                              if (detailsEl) detailsEl.open = true
                            }
                          }}
                          className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                        />
                        <span className="truncate">{category.label}</span>
                        {checked && (
                          <span className="text-[11px] font-normal text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                            {selectedCatMaterialsCount > 0 ? `${selectedCatMaterialsCount} vật liệu` : 'Không có vật liệu'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-xs font-normal text-stone-500">{checked ? 'Đã chọn' : 'Chưa chọn'}</span>
                        <span className="text-stone-400 text-xs">▼</span>
                      </div>
                    </summary>
                    <div className="space-y-3 border-t border-stone-200 p-3.5 bg-stone-50/50">
                      {materials.length === 0 ? (
                        <p className="text-xs text-stone-500 italic">Nhóm hàng này không có danh mục vật liệu phụ thuộc.</p>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-xs font-medium text-stone-600">Vật liệu chính (tùy chọn):</span>
                            <button
                              type="button"
                              className="text-xs font-semibold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
                              onClick={() => {
                                setMetadataDirty(true)
                                const materialIds = materials.map(m => m.id)
                                if (allMaterialsChecked) {
                                  setSelectedMaterials(current => current.filter(id => !materialIds.includes(id)))
                                } else {
                                  setSelectedCategories(current => [...new Set([...current, category.id])])
                                  setSelectedMaterials(current => [...new Set([...current, ...materialIds])])
                                }
                              }}
                            >
                              {allMaterialsChecked ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                            </button>
                          </div>
                          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                            {materials.map(material => (
                              <label key={material.id} className="flex items-center gap-2 rounded bg-white border border-stone-200 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-stone-50">
                                <input
                                  type="checkbox"
                                  checked={selectedMaterials.includes(material.id)}
                                  onChange={event => {
                                    setMetadataDirty(true)
                                    if (event.target.checked) {
                                      setSelectedCategories(current => [...new Set([...current, category.id])])
                                      setSelectedMaterials(current => [...new Set([...current, material.id])])
                                    } else {
                                      setSelectedMaterials(current => current.filter(id => id !== material.id))
                                    }
                                  }}
                                  className="h-3.5 w-3.5 rounded border-stone-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <span className="text-stone-800 truncate">{material.label}{material.fragile ? ' · Dễ vỡ' : ''}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                )
              })}
            </div>
          )}
        </section>
        <section className="rounded-xl border border-stone-200 p-4">
          <h3 className="font-semibold text-stone-900">Tổng hợp cấu hình gian kho</h3>
          <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><Stat label="Số lượng gian kho" value={`${format(validPhysicalUnitCount ? physicalUnitCount : undefined, 0)} gian`} /><Stat label="Kích thước gian kho" value={`${form.lengthM || '-'} × ${form.widthM || '-'} × ${form.heightM || '-'} m`} /><Stat label="Giới hạn khối lượng hàng" value={kg(Number(form.maxLoadKg))} /><Stat label="Số khung / khoang / tấm kê" value={`${format(confirmedResult?.rackCount ?? confirmedResult?.racks.length, 0)} / ${format(confirmedResult?.totalCompartments, 0)} / ${format(confirmedResult?.totalPallets ?? confirmedResult?.palletSlotCount, 0)}`} /><Stat label="Kích thước tấm kê" value={`${cm(confirmedResult?.palletLengthCm)} × ${cm(confirmedResult?.palletWidthCm)} × ${cm(confirmedResult?.palletHeightCm)}`} /><Stat label="Tổng khối lượng tấm kê và hàng" value={kg(confirmedResult?.maxStoredLoadAtCapacityKg)} /><Stat label="Thùng nhỏ tham khảo" value={`${format(confirmedResult?.smallBoxesPerUnit, 0)} thùng · ${confirmedResult?.smallBox.lengthCm ?? '-'} × ${confirmedResult?.smallBox.widthCm ?? '-'} × ${confirmedResult?.smallBox.heightCm ?? '-'} cm · ${confirmedResult?.smallBox.weightKg ?? '-'} kg/thùng`} /><Stat label="Thùng lớn tham khảo" value={`${format(confirmedResult?.largeBoxesPerUnit, 0)} thùng · ${confirmedResult?.largeBox.lengthCm ?? '-'} × ${confirmedResult?.largeBox.widthCm ?? '-'} × ${confirmedResult?.largeBox.heightCm ?? '-'} cm · ${confirmedResult?.largeBox.weightKg ?? '-'} kg/thùng`} /></dl>
          {confirmedResult?.warnings?.length ? <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><p className="font-semibold">Lưu ý kiểm tra</p><ul className="mt-1 list-disc space-y-1 pl-5">{confirmedResult.warnings.slice(0, 4).map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></div> : null}
        </section>
      </section>}
      {(stepError || error) && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{stepError || error}</p>}
    </div>
    <footer className="flex shrink-0 justify-end gap-2 border-t border-stone-200 bg-white px-4 py-3 sm:px-6"><Button type="button" variant="outline" disabled={busy || imageReading} onClick={() => { if (step === 0) onClose(); else { setStep(step - 1); setStepError(undefined) } }}>{step === 0 ? 'Hủy' : 'Quay lại'}</Button><Button type="button" disabled={busy || imageReading} onClick={() => void (step === 4 ? save() : next())}>{imageReading ? 'Đang đọc ảnh…' : busy ? 'Đang kiểm tra…' : step < 4 ? 'Tiếp theo' : initial ? 'Lưu thay đổi' : 'Tạo loại kho'}</Button></footer>
  </Modal>
}
