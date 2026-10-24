import { useEffect, useState } from 'react'
import { Modal, Button } from '../../components/ui'
import { listUnitTypeReviews, getUnitTypeReview, decideUnitTypeReview, type UnitTypeReview } from '../../services/unitTypeReviewApi'
import type { ManagerUnitTypeInput } from '../../services/managerUnitTypeApi'

const fields: [keyof ManagerUnitTypeInput, string][] = [
  ['name', 'Tên loại kho'], ['description', 'Mô tả'], ['imageUrl', 'Ảnh tổng quan kho'], ['detailImageUrl', 'Ảnh chi tiết / sơ đồ bố trí'],
  ['lengthM', 'Chiều dài (m)'], ['widthM', 'Chiều rộng (m)'], ['heightM', 'Chiều cao (m)'],
  ['maxLoadKg', 'Tải trọng tối đa (kg)'], ['rackCount', 'Số khung kệ'],
  ['rackLengthM', 'Dài khung (m)'], ['rackWidthM', 'Rộng khung (m)'], ['rackHeightM', 'Cao khung (m)'],
  ['aisleWidthM', 'Chiều rộng lối đi (m)'], ['trolleyType', 'Xe đẩy hỗ trợ'],
  ['smallBoxCapacity', 'Sức chứa thùng nhỏ'], ['largeBoxCapacity', 'Sức chứa thùng lớn'],
]
const statusLabel = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối' }
export default function UnitTypeReviewModal({ open, requestId, onClose }: {
  open: boolean; requestId: string | null; onClose: () => void
}) {
  const [requests, setRequests] = useState<UnitTypeReview[]>([])
  const [selected, setSelected] = useState<UnitTypeReview | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [monthlyPrice, setMonthlyPrice] = useState('')
  const [securityDepositAmount, setSecurityDepositAmount] = useState('')
  const load = async () => {
    setLoading(true); setError('')
    try {
      const all = await listUnitTypeReviews()
      setRequests(all)
      setReason('')
      const detail = requestId ? await getUnitTypeReview(requestId) : null
      if (detail) {
        setSelected(detail)
        setMonthlyPrice(String(detail.currentMonthlyPrice ?? ''))
        setSecurityDepositAmount(String(detail.currentSecurityDepositAmount ?? ''))
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Không tải được yêu cầu duyệt.') }
    finally { setLoading(false) }
  }
  useEffect(() => { if (open) void load() }, [open, requestId])
  const decide = async (approved: boolean) => {
    if (!selected) return
    if (!approved && !reason.trim()) { setError('Vui lòng nhập lý do từ chối.'); return }
    setBusy(true); setError('')
    try {
      if (approved && selected.requiresRepricing && (!(Number(monthlyPrice) > 0) || Number(securityDepositAmount) < 0)) {
        setError('Vui lòng xác nhận giá thuê và tiền đảm bảo hợp lệ.'); setBusy(false); return
      }
      const saved = await decideUnitTypeReview(selected.id, approved, reason.trim(), approved ? Number(monthlyPrice) : undefined, approved ? Number(securityDepositAmount) : undefined)
      setSelected(saved)
      setRequests(current => current.map(item => item.id === saved.id ? saved : item))
    } catch (e) { setError(e instanceof Error ? e.message : 'Không xử lý được yêu cầu.') }
    finally { setBusy(false) }
  }
  return <Modal open={open} onClose={() => { if (!busy) onClose() }} title="Duyệt thay đổi loại kho" size="xl">
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <p>Đang tải yêu cầu…</p> : selected ? <>
        <Button variant="secondary" disabled={busy} onClick={() => { setSelected(null); setError(''); setReason('') }}>Danh sách yêu cầu</Button>
        <div className="rounded-lg bg-stone-50 p-4 text-sm">
          <h3 className="font-semibold">{selected.facilityName} · {selected.unitTypeCode}</h3>
          <p className="mt-1">Người sửa: {selected.requesterName} · {new Date(selected.createdAt).toLocaleString('vi-VN')}</p>
          <p className="mt-1">{statusLabel[selected.status]}</p>
          {selected.reviewedAt && <p className="mt-1">Xử lý lúc: {new Date(selected.reviewedAt).toLocaleString('vi-VN')}</p>}
          {selected.rejectionReason && <p className="mt-1">Lý do từ chối: {selected.rejectionReason}</p>}
        </div>
        <div className="space-y-3">
          {fields.filter(([key]) => (selected.before[key] ?? '') !== (selected.after[key] ?? '')).map(([key, label]) => (
            <section key={key} className="rounded-lg border border-stone-200 p-3">
              <h4 className="mb-2 text-sm font-semibold">{label}</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {(['before', 'after'] as const).map(side => {
                  const value = selected[side][key]
                  return <div key={side} className={`min-w-0 rounded-lg p-3 ${side === 'before' ? 'bg-stone-50' : 'bg-amber-50'}`}>
                    <p className="mb-2 text-xs text-slate-500">{side === 'before' ? 'Trước thay đổi' : 'Manager đề xuất'}</p>
                    {(key === 'imageUrl' || key === 'detailImageUrl') && value && <img src={String(value)} alt={side === 'before' ? 'Ảnh cũ' : 'Ảnh đề xuất'} className="mb-2 h-40 w-full rounded object-cover" />}
                    <p className="whitespace-pre-wrap break-all text-sm">{value == null || value === '' ? 'Chưa khai báo' : (key === 'imageUrl' || key === 'detailImageUrl') && String(value).startsWith('data:') ? 'Ảnh tải từ máy' : String(value)}</p>
                  </div>
                })}
              </div>
            </section>
          ))}
        </div>
        {(selected.before.acceptedGoodsCategoryIds?.join(',') || '') !== (selected.after.acceptedGoodsCategoryIds?.join(',') || '') || (selected.before.acceptedGoodsMaterialIds?.join(',') || '') !== (selected.after.acceptedGoodsMaterialIds?.join(',') || '') ? <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><b>Phạm vi hàng hóa thay đổi</b><p className="mt-1">Số loại hàng: {selected.before.acceptedGoodsCategoryIds?.length || 0} → {selected.after.acceptedGoodsCategoryIds?.length || 0}. Số vật liệu: {selected.before.acceptedGoodsMaterialIds?.length || 0} → {selected.after.acceptedGoodsMaterialIds?.length || 0}.</p></section> : null}
        {selected.status === 'PENDING' && <>
          {selected.requiresRepricing && <div className="rounded-lg border border-amber-300 bg-amber-50 p-4"><p className="font-semibold text-amber-900">Thay đổi ảnh hưởng đến giá</p><p className="mt-1 text-sm text-amber-800">BO phải xác nhận lại giá trước khi công bố phiên bản mới.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Giá thuê tháng<input type="number" min="1" className="mt-1 w-full rounded-lg border border-stone-300 p-2" value={monthlyPrice} onChange={e => setMonthlyPrice(e.target.value)} /></label><label className="text-sm">Tiền đảm bảo<input type="number" min="0" className="mt-1 w-full rounded-lg border border-stone-300 p-2" value={securityDepositAmount} onChange={e => setSecurityDepositAmount(e.target.value)} /></label></div></div>}
          <label className="block text-sm">Lý do từ chối
            <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} disabled={busy} className="mt-1 w-full rounded-lg border border-stone-300 p-3" rows={2} />
          </label>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" disabled={busy} onClick={() => void decide(false)}>Từ chối</Button>
            <Button disabled={busy} onClick={() => void decide(true)}>{busy ? 'Đang xử lý…' : 'Duyệt thay đổi'}</Button>
          </div>
        </>}
      </> : <>
        <div className="flex justify-end"><Button variant="secondary" onClick={() => void load()}>Tải lại</Button></div>
        {requests.length === 0 ? <p className="py-5 text-center text-slate-500">Chưa có yêu cầu thay đổi loại kho.</p> :
          requests.map(item => <button key={item.id} onClick={() => { setSelected(item); setMonthlyPrice(String(item.currentMonthlyPrice ?? '')); setSecurityDepositAmount(String(item.currentSecurityDepositAmount ?? '')); setReason(''); setError('') }} className="block w-full rounded-lg border border-stone-200 p-4 text-left hover:bg-stone-50">
            <span className="block font-semibold">{item.facilityName} · {item.unitTypeCode}</span>
            <span className="mt-1 block text-sm text-slate-500">{item.requesterName} · {new Date(item.createdAt).toLocaleString('vi-VN')} · {statusLabel[item.status]}</span>
          </button>)}
      </>}
    </div>
  </Modal>
}
