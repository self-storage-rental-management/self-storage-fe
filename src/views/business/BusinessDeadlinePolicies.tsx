import { useEffect, useState } from 'react'
import { Button } from '../../components/ui'
import { listAccessibleUnitTypes, type CustomerUnitType } from '../../services/customerReservationApi'
import { saveFacilityDeadlinePolicies, unitTypeDeadlinePolicyApi, type UnitTypeDeadlinePolicy } from '../../services/facilityApi'

type DraftPolicy = { [K in keyof UnitTypeDeadlinePolicy]: number | '' }
type FacilityChoice = { id: string; code?: string; name: string }
const fields = [
  ['setupDeadlineDays', 'Hạn chuẩn bị và đến kiểm kê (ngày)'],
  ['setupMaxExtensionDays', 'Gia hạn kiểm kê mỗi lần tối đa (ngày)'],
  ['mismatchReturnDays', 'Hạn trả kho do kiểm kê sai lệch (ngày)'],
  ['mismatchReturnMaxExtensionDays', 'Gia hạn trả kho mỗi lần tối đa (ngày)'],
] as const

export default function BusinessDeadlinePolicies({ facilities, resolveFacilityId, connected }: {
  facilities: FacilityChoice[]
  resolveFacilityId: (facility: FacilityChoice) => Promise<string>
  connected: boolean
}) {
  const [facilityId, setFacilityId] = useState('')
  const [rows, setRows] = useState<CustomerUnitType[]>([])
  const [values, setValues] = useState<Record<string, DraftPolicy>>({})
  const [saved, setSaved] = useState<Record<string, DraftPolicy>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [backendFacilityId, setBackendFacilityId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)
  const selectedId = facilityId || facilities[0]?.id || ''
  const facility = facilities.find(item => item.id === selectedId)
  const code = facility?.code
  const name = facility?.name

  useEffect(() => {
    let active = true
    setRows([]); setValues({}); setSaved({}); setBackendFacilityId(''); setMessage(''); setError('')
    if (!connected || !selectedId || !name) return
    setLoading(true)
    const load = async () => {
      try {
        const id = await resolveFacilityId({ id: selectedId, code, name })
        const first = await listAccessibleUnitTypes(id, 0, 100)
        const types = [...first.data]
        for (let page = 1; page < first.pagination.totalPages; page++) {
          types.push(...(await listAccessibleUnitTypes(id, page, 100)).data)
        }
        const editable = types.filter(type => type.status !== 'archived')
        const policies = Object.fromEntries(await Promise.all(editable.map(async type =>
          [type.id, await unitTypeDeadlinePolicyApi(type.id)] as const)))
        if (active) { setRows(editable); setValues(policies); setSaved(policies); setBackendFacilityId(id) }
      } catch {
        if (active) setError('Không thể tải cấu hình thời hạn. Vui lòng thử lại.')
      } finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [selectedId, code, name, connected, resolveFacilityId, reload])

  const save = async () => {
    if (saving || loading || !rows.length || !backendFacilityId) return
    const invalid = rows.find(type => !values[type.id] || fields.some(([key]) => {
      const days = values[type.id][key]
      return days === '' || !Number.isInteger(days) || days < 1 || days > 365
    }))
    if (invalid) {
      setError(`Vui lòng nhập đủ 4 thời hạn cho ${invalid.name}. Các thời hạn phải là số nguyên từ 1 đến 365 ngày.`)
      setMessage(''); return
    }
    setSaving(true); setError(''); setMessage('')
    try {
      const policies = Object.fromEntries(rows.map(type => [type.id, values[type.id]])) as Record<string, UnitTypeDeadlinePolicy>
      const updated = await saveFacilityDeadlinePolicies(backendFacilityId, policies)
      setValues(updated); setSaved(updated)
      setMessage(`Đã lưu toàn bộ thời hạn của ${rows.length} loại kho tại ${facility?.name}.`)
    } catch { setError('Không thể lưu toàn bộ thời hạn. Vui lòng thử lại.') }
    finally { setSaving(false) }
  }

  return <section className="space-y-5">
    <header>
      <h1 className="text-2xl font-bold text-stone-900">Thiết lập thời hạn kho</h1>
      <p className="mt-2 text-sm text-stone-600">Quản lý thời hạn chuẩn bị, kiểm kê và trả kho theo từng loại kho tại từng cơ sở.</p>
    </header>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      Phải nhập đầy đủ 4 thời hạn cho tất cả loại kho tại cơ sở trước khi lưu. Mỗi loại kho có cấu hình riêng. Thay đổi áp dụng khi mở giai đoạn mới; hồ sơ đã chốt giữ nguyên thời hạn. Mỗi giai đoạn được gia hạn tối đa 2 lần.
    </div>
    {!connected ? <p role="status">Vui lòng đăng nhập để quản lý cấu hình thời hạn trên hệ thống.</p> : <>
      <label className="block max-w-lg text-sm font-semibold text-stone-700">Cơ sở
        <select value={selectedId} disabled={!!saving} onChange={event => setFacilityId(event.target.value)} className="mt-2 block w-full rounded-lg border border-stone-300 bg-white p-3">
          {!facilities.length && <option value="">Chưa có cơ sở</option>}
          {facilities.map(item => <option key={item.id} value={item.id}>{item.name}{item.code ? ` (${item.code})` : ''}</option>)}
        </select>
      </label>
      {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} <Button variant="outline" size="sm" disabled={!!saving} onClick={() => setReload(value => value + 1)}>Tải lại</Button></div>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      <form className="space-y-5" onSubmit={event => { event.preventDefault(); void save() }}>
      {loading ? <p role="status">Đang tải loại kho và thời hạn...</p> : !error && !rows.length ? <p>Chưa có loại kho đang sử dụng tại cơ sở này.</p> : rows.map(type => <article key={type.id} className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="font-bold text-stone-900">{type.name} <span className="font-normal text-stone-500">({type.code})</span></h2>
        <p className="mt-1 text-xs text-stone-500">{type.lengthM} × {type.widthM} × {type.heightM} m</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {fields.map(([key, label]) => <label key={key} className="text-sm font-medium text-stone-700">{label}
            <input required type="number" min={1} max={365} step={1} disabled={!!saving} value={values[type.id]?.[key] ?? ''}
              onInvalid={event => event.currentTarget.setCustomValidity('Vui lòng nhập số nguyên từ 1 đến 365 ngày.')}
              onInput={event => event.currentTarget.setCustomValidity('')}
              onChange={event => setValues(current => ({ ...current, [type.id]: { ...current[type.id], [key]: event.target.value === '' ? '' : Number(event.target.value) } }))}
              className="mt-2 block w-full rounded-lg border border-stone-300 p-3" />
          </label>)}
        </div>
      </article>)}
      {!loading && rows.length > 0 && <div className="sticky bottom-0 flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-stone-600">Lưu đồng thời toàn bộ {rows.length} loại kho của cơ sở. Không được bỏ trống trường nào.</p>
        <Button type="submit" variant="primary" disabled={saving || !backendFacilityId || JSON.stringify(values) === JSON.stringify(saved)}>{saving ? 'Đang lưu...' : 'Lưu tất cả thời hạn'}</Button>
      </div>}
      </form>
    </>}
  </section>
}
