import { useState } from 'react'
import { apiRequest } from '../services/apiClient'

type Contact = { name: string; phone: string; relationship?: string; email?: string }
type Contacts = { rentalId: string; customerName: string; currentContacts: Contact[]; contractSnapshot?: string }
export default function EmergencyContactsPanel({ rentalId, unitId }: { rentalId?: string; unitId?: string }) {
  const [rows, setRows] = useState<Contacts[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const load = async () => {
    setLoading(true); setError('')
    try {
      const response = await apiRequest<{ data: Contacts[] }>(`/api/${rentalId ? 'rentals/' + rentalId : 'storage-units/' + unitId}/emergency-contacts`)
      setRows(response.data)
    } catch { setError('Không tải được liên hệ khẩn cấp. Vui lòng thử lại hoặc kiểm tra quyền truy cập.') }
    finally { setLoading(false) }
  }
  const render = (contacts: Contact[]) => contacts.map((c, i) => <li key={i} className="my-2">
    <span className="font-medium">{c.name}</span>{c.relationship && ` · ${c.relationship}`} · <a className="font-semibold text-amber-800 underline" href={`tel:${c.phone.replace(/[^+0-9]/g, '')}`}>Gọi {c.phone}</a>{c.email && <span> · {c.email}</span>}
  </li>)
  return <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
    <button type="button" className="font-semibold underline" disabled={loading} onClick={() => void load()}>{loading ? 'Đang tải…' : 'Xem / gọi liên hệ khẩn cấp'}</button>
    {error && <p role="alert">{error}</p>}
    {rows && <><p className="mt-2 text-xs">Chỉ gọi khi không liên lạc được khách hoặc có sự cố. Người liên hệ không có quyền nhận hay trả kho.</p>
      {!rows.length && <p>Không có hợp đồng thuê đang sử dụng ô kho này.</p>}
      {rows.map(row => {
        let snapshot: Contact[] = []
        try { snapshot = row.contractSnapshot ? JSON.parse(row.contractSnapshot) : [] } catch { /* Historical snapshot unavailable. */ }
        return <div key={row.rentalId} className="mt-2"><p className="font-semibold">Khách: {row.customerName}</p><p>Liên hệ trong hồ sơ hiện tại:</p>
          {row.currentContacts.length ? <ul>{render(row.currentContacts)}</ul> : <p>Chưa cập nhật.</p>}
          {!!snapshot.length && <details><summary>Thông tin tại thời điểm ký hợp đồng</summary><ul>{render(snapshot)}</ul></details>}
        </div>
      })}</>}
  </div>
}
