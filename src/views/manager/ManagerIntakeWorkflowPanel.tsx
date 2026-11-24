import { useEffect, useState } from 'react'
import IntakeWorkflowPanel from '../../components/IntakeWorkflowPanel'
import { listCheckIns, type CheckInCase } from '../../services/checkInApi'

export default function ManagerIntakeWorkflowPanel() {
  const [items, setItems] = useState<CheckInCase[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    listCheckIns({ group: 'ONGOING', page: 0, pageSize: 100 }).then(r => {
      setItems(r.data.filter(i => ['setup_in_progress', 'setup_completed'].includes(i.checkInStatus || '')).sort((a, b) =>
        Date.parse(a.inventoryFinalDeadlineAt || a.setupDueAt || '9999-12-31') - Date.parse(b.inventoryFinalDeadlineAt || b.setupDueAt || '9999-12-31')))
    }).catch(() => setError('Chưa tải được hồ sơ kiểm kê. Vui lòng tải lại trang.'))
  }, [])
  return <section className="space-y-3 rounded-xl border bg-white p-4"><h3 className="font-bold">Chuẩn bị hàng và lịch kiểm kê đầu vào</h3>
    {error && <p role="alert">{error}</p>}
    {items.length === 0 && !error && <p>Không có hồ sơ đang chờ.</p>}
    {items.map(i => <div key={i.reservationId} className="border-b py-2"><button type="button" className="text-left font-semibold underline" onClick={() => setSelected(selected === i.reservationId ? null : i.reservationId)}>{i.reservationCode} · {i.customerName}</button>{selected === i.reservationId && <IntakeWorkflowPanel reservationId={i.reservationId} role="MANAGER" />}</div>)}
  </section>
}
