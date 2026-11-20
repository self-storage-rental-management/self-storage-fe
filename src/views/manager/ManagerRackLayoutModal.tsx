import { useEffect, useRef, useState } from 'react'
import { Button, Input, Modal } from '../../components/ui'
import RackLayoutSummary from '../../components/RackLayoutSummary'
import ManagerFormProgress from './ManagerFormProgress'
import { ApiClientError } from '../../services/apiClient'
import {
  getManagerRackLayout, previewRackLayout, previewRackLayoutDraft, rackLayoutError, saveRackLayout,
  storageHubRules, type RackConfiguration, type RackInput, type RackPreview, type SavedRackLayout,
  type RackLayoutDraft,
} from '../../services/rackLayoutApi'

const steps = ['Cấu hình khung kệ', 'Thiết lập tấm kê', 'Kiểm tra và xác nhận'] as const

const initialRack: RackInput = {
  code: 'R01', lengthCm: 400, widthCm: 200, heightCm: 450, xCm: 30, yCm: 30, orientationDeg: 0,
  uprightFrameCount: 3, uprightSizeCm: storageHubRules.uprightSizeCm, levelCount: 3,
  beamHeightCm: storageHubRules.beamHeightCm, firstBeamBottomCm: storageHubRules.firstBeamBottomCm,
  palletsPerCompartment: 1, maxRackLoadKg: 1200, beamOuterSpanCm: 200, maxBeamPairLoadKg: 100,
}

const initialConfiguration: RackConfiguration = {
  racks: [initialRack],
  autoGeneratePallet: true,
  clearances: {
    palletGapCm: storageHubRules.palletGapCm,
    palletEndCm: storageHubRules.palletEndClearanceCm,
    palletSideCm: 0,
    handlingCm: storageHubRules.handlingClearanceCm,
    maxPalletOverhangCm: storageHubRules.maxPalletOverhangCm,
    rackWallClearanceCm: storageHubRules.wallClearanceCm,
  },
  requestedRackCount: 1,
  layoutMode: 'AUTO_BALANCED_TWO_ROWS',
}

const display = (value: number | undefined) => value !== undefined && Number.isFinite(value) ? String(value) : ''
const formatted = (value: number | undefined, fractionDigits = 2) => value !== undefined && Number.isFinite(value)
  ? value.toLocaleString('vi-VN', { maximumFractionDigits: fractionDigits })
  : '—'

/** Keep one input template; codes, coordinates and orientation are Backend-owned. */
const automaticConfiguration = (configuration: RackConfiguration, requestedRackCount?: number): RackConfiguration => {
  const sanitized = { ...configuration } as RackConfiguration & { palletRatings?: unknown }
  delete sanitized.palletRatings
  const source = configuration.racks[0] ?? initialRack
  const requested = requestedRackCount ?? configuration.requestedRackCount ?? configuration.racks.length ?? 1
  const template: RackInput = {
    ...source,
    code: 'R01',
    xCm: 30,
    yCm: 30,
    orientationDeg: 0,
    // Legacy ratings remain readable but are not sent as a new input.
    maxLoadedPalletKg: undefined,
  }
  return {
    ...sanitized,
    racks: [template],
    autoGeneratePallet: true,
    pallet: undefined,
    requestedRackCount: Number.isInteger(requested) && requested > 0 ? requested : 1,
    layoutMode: 'AUTO_BALANCED_TWO_ROWS',
  }
}

function numericIssue(value: number | undefined, label: string, integer = false, min = 0, max?: number) {
  if (value === undefined || !Number.isFinite(value) || value < min || (max !== undefined && value > max)
    || (integer && !Number.isInteger(value))) {
    const range = max === undefined
      ? `${min === 0 ? 'lớn hơn 0' : `từ ${min.toLocaleString('vi-VN')} trở lên`}`
      : `từ ${min.toLocaleString('vi-VN')} đến ${max.toLocaleString('vi-VN')}`
    return ` cần nhập “${label}” là số ${integer ? 'nguyên ' : ''}${range}.`
  }
  return undefined
}

/** Client validation only checks completeness; Backend owns geometry and load rules. */
export function validateRackStep(configuration: RackConfiguration, step: number): { message: string; rackIndex?: number } | undefined {
  const rack = configuration.racks[0]
  if (!rack) return { message: 'Cần nhập cấu hình mẫu của khung kệ.', rackIndex: 0 }
  if (step === 0) {
    const fields: [number | undefined, string, boolean, number, number | undefined][] = [
      [rack.lengthCm, 'Chiều dài khung', false, 0, undefined],
      [rack.widthCm, 'Chiều rộng khung', false, 0, undefined],
      [rack.heightCm, 'Chiều cao khung', false, 0, undefined],
      [rack.uprightFrameCount, 'Số bộ trụ đứng', true, 2, 20],
      [rack.levelCount, 'Số tầng mỗi khung', true, 1, 100],
      [configuration.requestedRackCount, 'Số khung mỗi gian', true, 1, 100],
      [rack.maxBeamPairLoadKg, 'Giới hạn tải của khoang', false, 0, undefined],
      [rack.maxRackLoadKg, 'Giới hạn tải của khung', false, 0, undefined],
    ]
    for (const [value, label, integer, min, max] of fields) {
      const issue = numericIssue(value, label, integer, min, max)
      if (issue) return { rackIndex: 0, message: `Khung mẫu${issue}` }
    }
  }
  if (step === 1) {
    const issue = numericIssue(rack.palletsPerCompartment, 'Số tấm kê mỗi khoang', true, 1, 20)
    if (issue) return { rackIndex: 0, message: `Khung mẫu${issue}` }
  }
  return undefined
}

type RackEditorTarget =
  | { unitTypeId: string; onSaved: () => void }
  | { facilityId: string; dimensions: RackLayoutDraft; configuration?: RackConfiguration; onConfirm: (preview: RackPreview) => void }

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-stone-50 p-3">
    <dt className="text-xs text-stone-500">{label}</dt>
    <dd className="mt-1 text-base font-semibold text-stone-900">{value}</dd>
  </div>
}

export default function ManagerRackLayoutModal({ target, typeName, onClose }: {
  target: RackEditorTarget; typeName: string; onClose: () => void
}) {
  const draft = 'facilityId' in target ? target : undefined
  const unitTypeId = 'unitTypeId' in target ? target.unitTypeId : undefined
  const [configuration, setConfiguration] = useState<RackConfiguration | null>(() => draft
    ? automaticConfiguration(draft.configuration ?? initialConfiguration, draft.dimensions.rackCount ?? undefined)
    : null)
  const [stored, setStored] = useState<SavedRackLayout | null>(null)
  const [geometryPreview, setGeometryPreview] = useState<RackPreview | null>(null)
  const [preview, setPreview] = useState<RackPreview | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [savedLayoutEditable, setSavedLayoutEditable] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ReturnType<typeof rackLayoutError> | null>(null)
  const [retry, setRetry] = useState(0)
  const [step, setStep] = useState(0)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  useEffect(() => {
    if (!unitTypeId) return
    let active = true
    void getManagerRackLayout(unitTypeId).then(data => {
      if (!active) return
      setStored(data)
      const savedConfiguration = data?.result.configuration
      const manualSavedLayout = Boolean(savedConfiguration)
        && !Boolean(savedConfiguration?.autoGeneratePallet)
        && savedConfiguration?.layoutMode !== 'AUTO_BALANCED_TWO_ROWS'
      setSavedLayoutEditable(!manualSavedLayout)
      setConfiguration(manualSavedLayout ? null : automaticConfiguration(
        savedConfiguration ?? initialConfiguration,
        data?.result.rackCount ?? savedConfiguration?.requestedRackCount ?? undefined,
      ))
      setShowSaved(Boolean(data))
      setGeometryPreview(null)
      setPreview(null)
      setStep(0)
    }, cause => { if (active) setError(rackLayoutError(cause)) })
    return () => { active = false }
  }, [unitTypeId, retry])

  function clearPreviews() {
    setGeometryPreview(null)
    setPreview(null)
    setConfirmed(false)
    setError(null)
  }

  function changeTemplate(change: Partial<RackInput>) {
    setConfiguration(current => current && {
      ...current,
      racks: [{ ...(current.racks[0] ?? initialRack), ...change }],
    })
    clearPreviews()
  }

  function changeRackCount(value: number) {
    setConfiguration(current => current && { ...current, requestedRackCount: value })
    clearPreviews()
  }

  async function requestPreview(nextStep: 1 | 2) {
    if (!configuration || busy) return
    setBusy(true)
    setError(null)
    try {
      const requestConfiguration = automaticConfiguration(configuration)
      const verified = 'facilityId' in target
        ? await previewRackLayoutDraft(target.facilityId, target.dimensions, requestConfiguration)
        : await previewRackLayout(target.unitTypeId, requestConfiguration)
      if (nextStep === 1) {
        setGeometryPreview(verified)
        setStep(1)
      } else {
        setGeometryPreview(verified)
        setPreview(verified)
        setConfirmed(false)
        setStep(2)
      }
    } catch (cause) {
      setError(rackLayoutError(cause))
    } finally {
      setBusy(false)
    }
  }

  function nextStep() {
    if (!configuration || busy) return
    const issue = validateRackStep(configuration, step)
    if (issue) {
      setError({ message: issue.message, details: [] })
      return
    }
    void requestPreview(step === 0 ? 1 : 2)
  }

  async function save() {
    if (!preview || !confirmed || busy) return
    if ('facilityId' in target) {
      target.onConfirm(preview)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const data = await saveRackLayout(target.unitTypeId, preview.result.configuration, preview.previewKey)
      setStored(data)
      setShowSaved(true)
      setSavedLayoutEditable(true)
      setPreview(null)
      setGeometryPreview(null)
      setConfirmed(false)
      target.onSaved()
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        setPreview(null)
        setConfirmed(false)
      }
      setError(rackLayoutError(cause))
    } finally {
      setBusy(false)
    }
  }

  const template = configuration?.racks[0]
  const geometryResult = geometryPreview?.result
  const generatedPallet = geometryResult?.configuration.pallet
  const currentStep = preview ? 2 : step
  const derived = geometryResult ? {
    rackCount: geometryResult.rackCount ?? geometryResult.racks.length,
    levels: geometryResult.levelsPerRack ?? geometryResult.racks[0]?.levels.length ?? 0,
    maxLevels: geometryResult.maxLevelsByHeight,
    compartmentsPerLevel: geometryResult.compartmentsPerLevel ?? geometryResult.racks[0]?.bayCount ?? 0,
    compartments: geometryResult.totalCompartments ?? geometryResult.racks.reduce((sum, rack) => sum + rack.compartmentCount, 0),
    pallets: geometryResult.totalPallets ?? geometryResult.palletSlotCount,
  } : undefined

  return <Modal open onClose={() => { if (!busy) onClose() }} size="2xl" hideHeader
    className="flex max-h-[90vh] flex-col overflow-hidden p-0"
    contentClassName="flex min-h-0 flex-1 flex-col p-0">
    <header className="shrink-0 border-b border-stone-200 bg-white px-4 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="modal-title" className="text-lg font-bold text-stone-900">Thiết lập khung kệ · {typeName}</h2>
          <p className="mt-1 text-sm text-stone-500">Một cấu hình mẫu áp dụng cho các khung cùng loại trong gian kho.</p>
        </div>
        <button type="button" aria-label="Đóng cửa sổ" disabled={busy} onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 text-xl leading-none text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:cursor-not-allowed">
          ×
        </button>
      </div>
      {configuration && !showSaved && <div className="mt-4"><ManagerFormProgress steps={steps} current={currentStep} /></div>}
    </header>

    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      {draft && <p className="mb-4 text-sm text-stone-600">Kích thước mỗi gian kho: {formatted(draft.dimensions.lengthM)} × {formatted(draft.dimensions.widthM)} × {formatted(draft.dimensions.heightM)} m.</p>}
      {error && <div ref={errorRef} tabIndex={-1} role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        <p>{error.message}</p>
        {error.details.length > 0 && <ul className="mt-1 list-disc space-y-1 pl-5">{error.details.map(issue => <li key={issue}>{issue}</li>)}</ul>}
      </div>}

      {!configuration && (error
        ? <Button variant="outline" onClick={() => { setError(null); setRetry(value => value + 1) }}>Tải lại</Button>
        : <p role="status">Đang tải cấu hình kệ…</p>)}

      {showSaved && stored && <div className="space-y-4">
        <p role="status" className="text-sm font-semibold text-emerald-800">Đã lưu cấu hình lúc {new Date(stored.savedAt).toLocaleString('vi-VN')}.</p>
        {!savedLayoutEditable && <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-600">Đây là bố trí thủ công đã lưu. Màn hình này chỉ chỉnh cấu hình tự động; bố trí thủ công được giữ nguyên.</p>}
        <RackLayoutSummary result={stored.result} />
      </div>}

      {preview && !showSaved && <div className="space-y-4">
        <RackLayoutSummary result={preview.result} />
        <label className="flex items-start gap-2 rounded-lg border border-stone-200 p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />
          Tôi đã kiểm tra cấu hình khung, khoang, tấm kê và các giới hạn tải hiển thị.
        </label>
      </div>}

      {configuration && !showSaved && !preview && <form id="rack-layout-form" className="space-y-5" noValidate onSubmit={event => { event.preventDefault(); nextStep() }}>
        {step === 0 && template && <>
          <section className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-stone-900">Kích thước và cấu tạo khung</h3>
              <p className="mt-1 text-sm text-stone-500">Nhập một mẫu khung. Hệ thống sẽ tự sinh mã, vị trí, hướng và số khoang cho các khung còn lại.</p>
            </div>
            <fieldset disabled={busy} className="grid gap-3 rounded-lg border border-stone-200 p-4 sm:grid-cols-2 xl:grid-cols-3">
              <Input label="Chiều dài khung (cm)" aria-label="Chiều dài khung (cm)" required type="number" min={0} step="any" value={display(template.lengthCm)} onChange={event => changeTemplate({ lengthCm: event.target.valueAsNumber })} />
              <Input label="Chiều rộng khung (cm)" aria-label="Chiều rộng khung (cm)" required type="number" min={0} step="any" value={display(template.widthCm)} onChange={event => changeTemplate({ widthCm: event.target.valueAsNumber })} />
              <Input label="Chiều cao khung (cm)" aria-label="Chiều cao khung (cm)" required type="number" min={0} step="any" value={display(template.heightCm)} onChange={event => changeTemplate({ heightCm: event.target.valueAsNumber })} />
              <Input label="Số bộ trụ đứng" aria-label="Số bộ trụ đứng" required type="number" min={2} max={20} step={1} value={display(template.uprightFrameCount)} onChange={event => changeTemplate({ uprightFrameCount: event.target.valueAsNumber })} />
              <Input label="Số tầng mỗi khung" aria-label="Số tầng mỗi khung" required type="number" min={1} max={100} step={1} value={display(template.levelCount)} onChange={event => changeTemplate({ levelCount: event.target.valueAsNumber })} />
              <Input label="Số khung mỗi gian" aria-label="Số khung mỗi gian" required type="number" min={1} max={100} step={1} value={display(configuration.requestedRackCount)} onChange={event => changeRackCount(event.target.valueAsNumber)} />
              <Input label="Giới hạn tải của khoang / cặp dầm (kg)" aria-label="Giới hạn tải của khoang / cặp dầm (kg)" required type="number" min={0} step="any" value={display(template.maxBeamPairLoadKg)} onChange={event => changeTemplate({ maxBeamPairLoadKg: event.target.valueAsNumber })} />
              <Input label="Giới hạn tải của khung (kg)" aria-label="Giới hạn tải của khung (kg)" required type="number" min={0} step="any" value={display(template.maxRackLoadKg)} onChange={event => changeTemplate({ maxRackLoadKg: event.target.valueAsNumber })} />
            </fieldset>
          </section>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
            Hệ thống sẽ kiểm tra chiều cao sử dụng, số tầng tối đa, số khoang và khả năng bố trí trong gian kho ở bước tiếp theo.
          </div>
        </>}

        {step === 1 && template && <section className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-stone-900">Số lượng tấm kê</h3>
            <p className="mt-1 text-sm text-stone-500">Chỉ nhập số tấm kê trong mỗi khoang. Kích thước và khối lượng tấm kê được hệ thống tự tính.</p>
          </div>
          <fieldset disabled={busy} className="rounded-lg border border-stone-200 p-4">
            <Input label="Số tấm kê mỗi khoang" aria-label="Số tấm kê mỗi khoang" required type="number" min={1} max={20} step={1} value={display(template.palletsPerCompartment)} onChange={event => changeTemplate({ palletsPerCompartment: event.target.valueAsNumber })} />
          </fieldset>
          {geometryResult && <>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric label="Kích thước tấm kê (D × R × C)" value={`${formatted(geometryResult.palletLengthCm ?? generatedPallet?.lengthCm)} × ${formatted(geometryResult.palletWidthCm ?? generatedPallet?.widthCm)} × ${formatted(geometryResult.palletHeightCm ?? generatedPallet?.heightCm)} cm`} />
              <Metric label="Khối lượng tấm kê rỗng" value={`${formatted(geometryResult.palletEmptyWeightKg ?? generatedPallet?.emptyKg)} kg`} />
              <Metric label="Giới hạn tải hàng mỗi tấm kê" value={`${formatted(geometryResult.palletMaxPayloadKg ?? generatedPallet?.maxPayloadKg)} kg`} />
              <Metric label="Số tầng được dùng" value={`${formatted(derived?.levels, 0)} / tối đa ${formatted(derived?.maxLevels, 0)} tầng`} />
              <Metric label="Số khoang mỗi khung" value={`${formatted(derived?.compartmentsPerLevel, 0)} khoang/tầng · ${formatted(derived?.compartments ? derived.compartments / Math.max(derived.rackCount, 1) : undefined, 0)} khoang/khung`} />
              <Metric label="Tổng số khoang / tấm kê" value={`${formatted(derived?.compartments, 0)} khoang · ${formatted(derived?.pallets, 0)} tấm kê`} />
            </dl>
            <div className="rounded-lg border border-stone-200 p-4">
              <p className="font-semibold text-stone-900">Giới hạn tấm kê theo cấu hình</p>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <p>Theo hình học: <strong>{formatted(geometryResult.maxPalletCountByGeometry, 0)}</strong></p>
                <p>Theo tải trọng: <strong>{formatted(geometryResult.maxPalletCountByLoad, 0)}</strong></p>
                <p>Có thể dùng: <strong>{formatted(geometryResult.maxFeasiblePalletCount ?? geometryResult.maxPalletCountByGeometry, 0)}</strong></p>
              </div>
              <p className="mt-3 text-sm text-stone-600">Hàng tối đa: {formatted(geometryResult.maxCargoWeightPerCompartmentKg)} kg/khoang · {formatted(geometryResult.maxCargoWeightPerRackKg)} kg/khung · {formatted(geometryResult.maxCargoWeightPerWarehouseKg ?? geometryResult.unitCargoLimitKg)} kg/gian.</p>
            </div>
          </>}
          {!geometryResult && <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-600">Nhấn “Kiểm tra thông số tấm kê” để hệ thống tính kích thước và giới hạn phù hợp.</p>}
        </section>}
      </form>}
    </div>

    {showSaved && savedLayoutEditable && <footer className="flex shrink-0 justify-end gap-2 border-t border-stone-200 bg-white px-4 py-3 sm:px-6">
      <Button variant="outline" disabled={busy} onClick={() => { setConfiguration(automaticConfiguration(stored?.result.configuration ?? initialConfiguration, stored?.result.rackCount)); setStep(0); setShowSaved(false); setGeometryPreview(null); setPreview(null); setConfirmed(false); setError(null) }}>Chỉnh sửa cấu hình</Button>
    </footer>}
    {configuration && !showSaved && !preview && <footer className="flex shrink-0 justify-end gap-2 border-t border-stone-200 bg-white px-4 py-3 sm:px-6">
      <Button type="button" variant="outline" disabled={busy} onClick={() => {
        if (step === 0) onClose()
        else { setStep(step - 1); setError(null) }
      }}>{step === 0 ? 'Hủy' : 'Quay lại'}</Button>
      <Button type="submit" form="rack-layout-form" disabled={busy}>{busy ? 'Đang kiểm tra…' : step === 0 ? 'Tính cấu hình khung' : 'Kiểm tra thông số tấm kê'}</Button>
    </footer>}
    {preview && !showSaved && <footer className="flex shrink-0 justify-end gap-2 border-t border-stone-200 bg-white px-4 py-3 sm:px-6">
      <Button variant="outline" disabled={busy} onClick={() => { setStep(1); setPreview(null); setConfirmed(false); setError(null) }}>Quay lại sửa</Button>
      <Button disabled={busy || !confirmed} onClick={() => void save()}>{busy ? 'Đang lưu…' : draft ? 'Dùng cấu hình này' : 'Lưu cấu hình'}</Button>
    </footer>}
  </Modal>
}
