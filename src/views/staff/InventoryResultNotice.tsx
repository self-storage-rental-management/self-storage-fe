import { useEffect, useState, type ReactNode } from 'react'
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
  VARIANCE_FITS: { title: 'Hàng hóa không khớp nhưng vẫn vừa kho', icon: '!', color: 'border-amber-300 bg-amber-50 text-amber-950', description: 'Số lượng, số đo, loại hàng hoặc tình trạng thực tế có thay đổi. Staff ghi nhận việc tiếp nhận toàn bộ hàng sau khi trao đổi trực tiếp với khách.' },
  NOT_FIT: { title: 'Hàng hóa không thể chứa vừa trong kho', icon: '!', color: 'border-red-300 bg-red-50 text-red-950', description: 'Không thể tiếp nhận toàn bộ hàng thực tế trong gian kho hiện tại. Ghi nhận tại cơ sở phương án chuyển hàng hoặc trả kho.' },
  UNKNOWN: { title: 'Chờ đối chiếu phương án xếp hàng', icon: '?', color: 'border-stone-300 bg-stone-50 text-stone-900', description: 'Chưa đủ dữ liệu để kết luận. Chuyển đến bước Kết quả tiếp nhận để hệ thống kiểm tra phương án xếp chính thức.' },
}

export default function InventoryResultNotice({ result, published, checkInId, packages, weight, volume, children, showAlternatives = true }: {
  result: InventoryResult; published: boolean; checkInId: string | null
  packages: number; weight: number; volume: number; children: ReactNode; showAlternatives?: boolean
}) {
  const screen = screens[result]
  const number = (value: number, digits: number) => Number.isFinite(value) ? value.toLocaleString('vi-VN', { maximumFractionDigits: digits }) : '-'
  return <section className={`overflow-hidden rounded-2xl border ${screen.color}`} aria-label="Xác nhận hàng hóa kiểm kê" aria-live="polite">
    <header className="flex items-start gap-3 border-b border-black/10 p-5">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-2xl font-bold">{screen.icon}</span>
      <div><p className="text-xs font-bold uppercase tracking-wide">Xác nhận hàng hóa kiểm kê · {published ? 'Đã lưu' : 'Đối chiếu sơ bộ'}</p><h3 className="mt-1 text-xl font-bold">{screen.title}</h3><p className="mt-2 text-sm leading-6">{screen.description}</p></div>
    </header>
    <div className="space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-3">{[['Số kiện thực tế', number(packages, 0)], ['Tổng khối lượng', `${number(weight, 2)} kg`], ['Tổng thể tích', `${number(volume, 4)} m³`]].map(([label, value]) => <div key={label} className="rounded-xl border border-black/10 bg-white p-4"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-lg font-bold text-stone-900">{value}</p></div>)}</div>
      {children}
      <InventoryAlternatives result={result} published={published} checkInId={checkInId} packages={packages} weight={weight} volume={volume} showAlternatives={showAlternatives} />
    </div>
  </section>
}

export function InventoryAlternatives({ result, published, checkInId, packages, weight, volume, showAlternatives = true }: {
  result: InventoryResult; published: boolean; checkInId: string | null
  packages: number; weight: number; volume: number; showAlternatives?: boolean
}) {
  const [alternatives, setAlternatives] = useState<Alternative[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<Alternative | null>(null)
  useEffect(() => {
    let active = true
    setAlternatives(null); setSelected(null); setFailed(false)
    if (!showAlternatives || result !== 'NOT_FIT' || !checkInId || !published) {
      setLoading(false)
      return
    }
    setLoading(true)
    void apiRequest<{ data: Alternative[] }>(`/api/staff/check-ins/${encodeURIComponent(checkInId)}/inventory-alternatives`)
      .then(response => { if (active) setAlternatives(response.data) })
      .catch(() => { if (active) setFailed(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [showAlternatives, result, checkInId, published, packages, weight, volume])
  return <div className="space-y-3">
      {showAlternatives && result === 'NOT_FIT' && published && <>
        {!failed && (loading || alternatives === null ? <p role="status" className="text-sm">Kiểm tra tự động: đang tìm kho phù hợp để chuyển…</p>
          : alternatives.length === 0 ? <p role="status" className="text-sm">Kiểm tra tự động: không có kho phù hợp để chuyển tại cơ sở này.</p> : null)}
        {alternatives && alternatives.length > 0 && <section className="space-y-3 rounded-xl border border-black/10 bg-white p-4 text-stone-900">
        <h4 className="font-bold">Gợi ý chuyển sang kho phù hợp</h4>
        {alternatives && alternatives.length > 0 && <div className="grid gap-3 sm:grid-cols-2">{alternatives.map(item => <article key={item.storageUnitId} className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-bold">{item.storageUnitCode}</p><p className="text-sm">{item.unitTypeName}</p><p className="text-sm">Phương án xếp: {item.requiredPallets}/{item.availableSlots} vị trí pallet</p><p className="text-sm">Giá niêm yết/tháng: <b>{item.monthlyPrice == null ? 'Chưa có giá' : formatVndAmount(item.monthlyPrice)}</b></p><Button size="sm" variant="outline" onClick={() => setSelected(item)}>Xem đề xuất chuyển kho</Button></article>)}</div>}
        {selected && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-950">Đề xuất chuyển sang <b>{selected.storageUnitCode}</b>. Nhân viên trao đổi với khách và quản lý cơ sở để kiểm tra lịch trống, chốt chi phí và xử lý chuyển kho. Gian kho hiện tại chưa thay đổi.</p>}
        <p className="text-xs text-stone-500">Đây là gợi ý theo sức chứa và trạng thái trống hiện tại, chưa giữ chỗ. Lịch thuê, chi phí và quyền chuyển kho cần được xác nhận trước khi chuyển.</p>
      </section>}
      </>}
  </div>
}
