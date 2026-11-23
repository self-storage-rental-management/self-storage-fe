import { useState, type ReactNode } from 'react'
import { Button } from '../../components/ui'
import { apiRequest } from '../../services/apiClient'
import { formatVndAmount } from '../../i18n/currency'
import type { InventoryResult } from '../../domain/inventoryResult'

interface Alternative {
  storageUnitId: string; storageUnitCode: string; unitTypeName: string
  monthlyPrice: number | null; requiredPallets: number; availableSlots: number
}

const screens = {
  MATCHED: { title: 'Hàng hóa khớp với khai báo', icon: '✓', color: 'border-emerald-300 bg-emerald-50 text-emerald-950', description: 'Hàng thực tế phù hợp khai báo và có thể tiếp nhận toàn bộ trong gian kho hiện tại.' },
  VARIANCE_FITS: { title: 'Hàng hóa không khớp nhưng vẫn vừa kho', icon: '!', color: 'border-amber-300 bg-amber-50 text-amber-950', description: 'Số lượng, số đo, loại hàng hoặc tình trạng thực tế có thay đổi. Khách cần xem sai lệch và xác nhận nhận toàn bộ hàng.' },
  NOT_FIT: { title: 'Hàng hóa không thể chứa vừa trong kho', icon: '!', color: 'border-red-300 bg-red-50 text-red-950', description: 'Không thể tiếp nhận toàn bộ hàng thực tế trong gian kho hiện tại. Khách chọn nhận phần vừa kho và lấy hàng dư ra, hoặc tạo yêu cầu trả kho.' },
  UNKNOWN: { title: 'Chờ đối chiếu phương án xếp hàng', icon: '?', color: 'border-stone-300 bg-stone-50 text-stone-900', description: 'Chưa đủ dữ liệu để kết luận. Công bố kiểm kê để hệ thống kiểm tra phương án xếp pallet chính thức.' },
}

export default function InventoryResultNotice({ result, published, checkInId, packages, weight, volume, children }: {
  result: InventoryResult; published: boolean; checkInId: string | null
  packages: number; weight: number; volume: number; children: ReactNode
}) {
  const screen = screens[result]
  const [alternatives, setAlternatives] = useState<Alternative[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Alternative | null>(null)
  const load = async () => {
    if (!checkInId || !published || loading) return
    setLoading(true); setError(''); setAlternatives(null); setSelected(null)
    try {
      const response = await apiRequest<{ data: Alternative[] }>(`/api/staff/check-ins/${encodeURIComponent(checkInId)}/inventory-alternatives`)
      setAlternatives(response.data)
    } catch { setError('Chưa thể tải kho gợi ý. Vui lòng thử lại.') }
    finally { setLoading(false) }
  }
  const number = (value: number, digits: number) => Number.isFinite(value) ? value.toLocaleString('vi-VN', { maximumFractionDigits: digits }) : '—'
  return <section className={`overflow-hidden rounded-2xl border ${screen.color}`} aria-label="Xác nhận kết quả kiểm kê" aria-live="polite">
    <header className="flex items-start gap-3 border-b border-black/10 p-5">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-2xl font-bold">{screen.icon}</span>
      <div><p className="text-xs font-bold uppercase tracking-wide">Kết quả kiểm kê · {published ? 'Đã lưu' : 'Đối chiếu sơ bộ'}</p><h3 className="mt-1 text-xl font-bold">{screen.title}</h3><p className="mt-2 text-sm leading-6">{screen.description}</p></div>
    </header>
    <div className="space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-3">{[['Số kiện thực tế', number(packages, 0)], ['Tổng khối lượng', `${number(weight, 2)} kg`], ['Tổng thể tích', `${number(volume, 4)} m³`]].map(([label, value]) => <div key={label} className="rounded-xl border border-black/10 bg-white p-4"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-lg font-bold text-stone-900">{value}</p></div>)}</div>
      {children}
      {result !== 'MATCHED' && <section className="space-y-3 rounded-xl border border-black/10 bg-white p-4 text-stone-900">
        <h4 className="font-bold">Gợi ý chuyển sang kho phù hợp</h4>
        <p className="text-sm text-stone-600">Đối chiếu toàn bộ hàng thực tế bằng thuật toán xếp pallet như lúc đặt giữ kho, trong cùng cơ sở.</p>
        {!published && <p className="text-sm text-amber-900">Công bố kết quả kiểm kê trước khi tìm kho thay thế.</p>}
        <Button variant="outline" disabled={!published || !checkInId || loading} onClick={() => void load()}>{loading ? 'Đang đối chiếu kho…' : 'Tìm kho phù hợp với hàng thực tế'}</Button>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {alternatives?.length === 0 && <p role="status" className="text-sm text-amber-900">Chưa tìm được gian kho trống đủ điều kiện chứa toàn bộ hàng tại cơ sở này.</p>}
        {alternatives && alternatives.length > 0 && <div className="grid gap-3 sm:grid-cols-2">{alternatives.map(item => <article key={item.storageUnitId} className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-bold">{item.storageUnitCode}</p><p className="text-sm">{item.unitTypeName}</p><p className="text-sm">Phương án xếp: {item.requiredPallets}/{item.availableSlots} vị trí pallet</p><p className="text-sm">Giá niêm yết/tháng: <b>{item.monthlyPrice == null ? 'Chưa có giá' : formatVndAmount(item.monthlyPrice)}</b></p><Button size="sm" variant="outline" onClick={() => setSelected(item)}>Xem đề xuất chuyển kho</Button></article>)}</div>}
        {selected && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-950">Đề xuất chuyển sang <b>{selected.storageUnitCode}</b>. Nhân viên trao đổi với khách và Manager để kiểm tra lịch trống, chốt chi phí và xử lý chuyển kho. Gian kho hiện tại chưa thay đổi.</p>}
        <p className="text-xs text-stone-500">Đây là gợi ý theo sức chứa và trạng thái trống hiện tại, chưa giữ chỗ. Lịch thuê, chi phí và quyền chuyển kho cần được xác nhận trước khi chuyển.</p>
      </section>}
    </div>
  </section>
}
