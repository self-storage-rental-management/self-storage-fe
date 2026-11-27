import { Button } from '../../components/ui'
import type { ReturnRenewalEligibility } from '../../services/returnRenewalEligibility'

export default function ReturnRenewalBlock({ gate, loading, error, onRetry, onOpenRenewal }: {
  gate?: ReturnRenewalEligibility | null
  loading: boolean
  error?: string
  onRetry: () => void
  onOpenRenewal?: (id: string) => void
}) {
  return <div className="space-y-5">
    <div id="return-renewal-reason" role={loading ? 'status' : 'alert'} className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      <p>{loading ? 'Đang kiểm tra yêu cầu gia hạn trước khi trả kho…' : error || gate?.message || 'Chưa thể xác định điều kiện trả kho. Vui lòng thử lại.'}</p>
      {!loading && gate?.state === 'DEPOSIT_PAID' && <p className="font-semibold">Khoản không hoàn lại là cọc gia hạn, được xử lý khi bạn xác nhận hủy gia hạn.</p>}
      {!loading && gate?.state === 'FULLY_PAID' && <p className="font-semibold">Toàn bộ tiền gia hạn đã thanh toán không được hoàn lại. Bạn cần xác nhận điều này khi hủy trong Gia hạn.</p>}
      {error && <Button type="button" variant="outline" onClick={onRetry}>Thử lại</Button>}
      {!loading && !error && gate?.renewalId && onOpenRenewal &&
        <Button type="button" variant="outline" onClick={() => onOpenRenewal(gate.renewalId!)}>Đến yêu cầu gia hạn</Button>}
    </div>
    <fieldset disabled aria-describedby="return-renewal-reason" className="space-y-4 opacity-50">
      <label className="block text-sm font-medium">Ngày hẹn trả kho<input disabled type="date" className="mt-2 block w-full rounded-lg border border-stone-300 bg-stone-100 p-3" /></label>
      <label className="block text-sm font-medium">Lý do trả kho<textarea disabled rows={2} className="mt-2 block w-full rounded-lg border border-stone-300 bg-stone-100 p-3" /></label>
      <div className="flex justify-end border-t border-stone-200 pt-3"><Button disabled>Gửi yêu cầu trả kho</Button></div>
    </fieldset>
  </div>
}
