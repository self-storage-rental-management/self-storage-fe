import { useEffect, useState } from 'react'
import { Button, Modal } from '../../components/ui'
import RackLayoutSummary from '../../components/RackLayoutSummary'
import {
  getBusinessRackLayout, listBusinessRackLayouts, rackLayoutError, type RackLayoutType, type SavedRackLayout,
} from '../../services/rackLayoutApi'

export default function BusinessRackLayoutsModal({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(0)
  const [types, setTypes] = useState<RackLayoutType[]>([])
  const [selected, setSelected] = useState<RackLayoutType | null>(null)
  const [layout, setLayout] = useState<SavedRackLayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    if (selected) {
      setLayout(null)
      void getBusinessRackLayout(selected.id).then(result => {
        if (active) setLayout(result)
      }).catch(cause => {
        if (active) setError(rackLayoutError(cause).message)
      }).finally(() => { if (active) setLoading(false) })
    } else {
      void listBusinessRackLayouts(page).then(result => {
        if (!active) return
        setTypes(result.data)
        setPages(result.pagination.totalPages)
      }).catch(cause => {
        if (active) setError(rackLayoutError(cause).message)
      }).finally(() => { if (active) setLoading(false) })
    }
    return () => { active = false }
  }, [page, selected, retry])

  return <Modal open onClose={onClose} title="Cấu hình kệ pallet theo loại gian kho" size="2xl">
    <div className="space-y-4">
      {selected && <Button variant="outline" onClick={() => setSelected(null)}>Danh sách loại gian</Button>}
      {loading ? <p role="status">Đang tải cấu hình…</p> : error ? <div className="space-y-2">
        <p role="alert" className="text-red-800">{error}</p>
        <Button variant="outline" onClick={() => setRetry(value => value + 1)}>Thử lại</Button>
      </div> : selected ? layout && <>
        <div>
          <h3 className="font-semibold">{selected.name} ({selected.code}) · {selected.facilityName}</h3>
          <p className="text-sm text-stone-600">Cấu hình được lưu lúc {new Date(layout.savedAt).toLocaleString('vi-VN')}.</p>
        </div>
        <RackLayoutSummary result={layout.result} />
      </> : types.length ? <>
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200">
          {types.map(type => <li key={type.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <span><b>{type.name}</b> ({type.code}) · {type.facilityName}</span>
            <Button size="sm" variant="outline" onClick={() => setSelected(type)}>Xem cấu hình</Button>
          </li>)}
        </ul>
        {pages > 1 && <div className="flex items-center justify-end gap-3">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Trước</Button>
          <span className="text-sm">Trang {page + 1}/{pages}</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(value => value + 1)}>Sau</Button>
        </div>}
      </> : <p role="status">Chưa có loại gian kho nào có cấu hình kệ đã lưu.</p>}
    </div>
  </Modal>
}
