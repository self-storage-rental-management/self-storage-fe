import { useEffect, useState } from 'react'
import { Button, Card } from '../../components/ui'
import {
  getBusinessConfigApi,
  updateBusinessConfigApi,
  type BusinessConfigApi,
} from '../../services/businessConfigApi'
import { ApiClientError } from '../../services/apiClient'
import { formatVnd } from '../../i18n/currency'

interface Props {
  canWrite?: boolean
}

export default function BusinessConfigPanel({ canWrite = true }: Props) {
  const [config, setConfig] = useState<BusinessConfigApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [gracePeriodDays, setGracePeriodDays] = useState(3)
  const [lateFeeAmount, setLateFeeAmount] = useState(650000)
  const [defaultDepositRatio, setDefaultDepositRatio] = useState(0.2)
  const [holdExpiryHours, setHoldExpiryHours] = useState(2)
  const [managerRefundApprovalLimit, setManagerRefundApprovalLimit] = useState(5000000)
  const [autoInvoiceDays, setAutoInvoiceDays] = useState(7)
  const [autoProrate, setAutoProrate] = useState(true)

  const loadConfig = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getBusinessConfigApi()
      setConfig(data)
      setGracePeriodDays(data.gracePeriodDays ?? 3)
      setLateFeeAmount(data.lateFeeAmount ?? 650000)
      setDefaultDepositRatio(data.defaultDepositRatio ?? 0.2)
      setHoldExpiryHours(data.holdExpiryHours ?? 2)
      setManagerRefundApprovalLimit(data.managerRefundApprovalLimit ?? 5000000)
      setAutoInvoiceDays(data.autoInvoiceDays ?? 7)
      setAutoProrate(data.autoProrate ?? true)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Không thể tải cấu hình vận hành.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadConfig()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await updateBusinessConfigApi({
        gracePeriodDays: Number(gracePeriodDays),
        lateFeeAmount: Number(lateFeeAmount),
        defaultDepositRatio: Number(defaultDepositRatio),
        holdExpiryHours: Number(holdExpiryHours),
        managerRefundApprovalLimit: Number(managerRefundApprovalLimit),
        autoInvoiceDays: Number(autoInvoiceDays),
        autoProrate,
      })
      setConfig(updated)
      setSuccess('Đã cập nhật cấu hình vận hành & phí trễ hạn thành công xuống hệ thống!')
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Lỗi khi lưu cấu hình vận hành.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'mt-1.5 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-stone-100'

  if (loading) {
    return (
      <Card className="p-6 rounded-2xl border border-stone-200 bg-white text-sm text-stone-500">
        Đang tải cấu hình vận hành hệ thống...
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-0 text-sm shadow-sm">
      <div className="border-b border-stone-100 bg-gradient-to-r from-amber-50 to-white px-5 py-4">
        <h3 className="text-base font-semibold text-stone-900">
          Cấu hình vận hành & Phí phạt hệ thống (Business Operations)
        </h3>
        <p className="mt-1 text-xs text-stone-500">
          Quản lý mức phí phạt quá hạn thực tế, thời gian ân hạn, hạn mức cọc và các tham số tài chính áp dụng cho toàn bộ StorageHub.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 flex items-center justify-between">
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={loadConfig}>
              Tải lại
            </Button>
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
            {success}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          {/* 1. Mức phí phạt trễ hạn */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-xs text-stone-800">
                Phí phạt trễ hạn mỗi ngày (VND/ngày)
              </label>
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                Backend Ledger
              </span>
            </div>
            <input
              type="number"
              min={0}
              step={10000}
              required
              disabled={!canWrite || saving}
              value={lateFeeAmount}
              onChange={(e) => setLateFeeAmount(Number(e.target.value))}
              className={inputClass}
            />
            <p className="text-[11px] text-stone-500">
              Mức hiện tại: <b className="text-amber-700">{formatVnd(lateFeeAmount)}/ngày</b>. Áp dụng cho các hợp đồng quá hạn chưa gia hạn hoặc chưa trả kho.
            </p>
          </div>

          {/* 2. Số ngày ân hạn (Grace Period) */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-xs text-stone-800">
                Thời gian ân hạn thanh toán (ngày)
              </label>
              <span className="text-[11px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                Ân hạn
              </span>
            </div>
            <input
              type="number"
              min={0}
              max={30}
              required
              disabled={!canWrite || saving}
              value={gracePeriodDays}
              onChange={(e) => setGracePeriodDays(Number(e.target.value))}
              className={inputClass}
            />
            <p className="text-[11px] text-stone-500">
              Số ngày cho phép khách trễ trước khi bị khóa quyền truy cập hoặc áp dụng các chế tài thu hồi.
            </p>
          </div>

          {/* 3. Tỷ lệ cọc giữ chỗ mặc định */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-xs text-stone-800">
                Tỷ lệ cọc giữ chỗ mặc định (Deposit Ratio)
              </label>
              <span className="text-[11px] font-bold text-stone-700 bg-stone-200 px-2 py-0.5 rounded">
                Đặt giữ chỗ
              </span>
            </div>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              required
              disabled={!canWrite || saving}
              value={defaultDepositRatio}
              onChange={(e) => setDefaultDepositRatio(Number(e.target.value))}
              className={inputClass}
            />
            <p className="text-[11px] text-stone-500">
              Tương ứng: <b className="text-stone-800">{Math.round(defaultDepositRatio * 100)}%</b> đơn giá thuê kho. Trừ trực tiếp khi ký hợp đồng.
            </p>
          </div>

          {/* 4. Thời hạn giữ chỗ (Hold Expiry) */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-xs text-stone-800">
                Thời hạn giữ chỗ trước khi tự hủy (giờ)
              </label>
              <span className="text-[11px] font-bold text-stone-700 bg-stone-200 px-2 py-0.5 rounded">
                Tạm giữ
              </span>
            </div>
            <input
              type="number"
              min={0.5}
              max={72}
              step={0.5}
              required
              disabled={!canWrite || saving}
              value={holdExpiryHours}
              onChange={(e) => setHoldExpiryHours(Number(e.target.value))}
              className={inputClass}
            />
            <p className="text-[11px] text-stone-500">
              Khách có tối đa <b className="text-stone-800">{holdExpiryHours} giờ</b> để thanh toán tiền giữ chỗ trước khi phòng kho được nhả lại.
            </p>
          </div>

          {/* 5. Hạn mức duyệt hoàn tiền Quản lý */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-xs text-stone-800">
                Hạn mức duyệt hoàn tiền của Quản lý cơ sở (VND)
              </label>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                Hoàn tiền
              </span>
            </div>
            <input
              type="number"
              min={0}
              step={500000}
              required
              disabled={!canWrite || saving}
              value={managerRefundApprovalLimit}
              onChange={(e) => setManagerRefundApprovalLimit(Number(e.target.value))}
              className={inputClass}
            />
            <p className="text-[11px] text-stone-500">
              Tối đa: <b className="text-emerald-700">{formatVnd(managerRefundApprovalLimit)}</b>. Các khoản lớn hơn phải được Ban Giám đốc (BO) duyệt.
            </p>
          </div>

          {/* 6. Lập hóa đơn tự động & Tròn tháng */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-xs text-stone-800">
                Ngày gửi hóa đơn trước hạn (ngày)
              </label>
              <span className="text-[11px] font-bold text-stone-700 bg-stone-200 px-2 py-0.5 rounded">
                Hóa đơn
              </span>
            </div>
            <input
              type="number"
              min={1}
              max={30}
              required
              disabled={!canWrite || saving}
              value={autoInvoiceDays}
              onChange={(e) => setAutoInvoiceDays(Number(e.target.value))}
              className={inputClass}
            />
            <label className="flex items-center gap-2 pt-2 text-xs text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={autoProrate}
                disabled={!canWrite || saving}
                onChange={(e) => setAutoProrate(e.target.checked)}
                className="rounded accent-amber-600"
              />
              <span>Tự động tính tiền theo số ngày thực tế khi bắt đầu giữa tháng (Prorate)</span>
            </label>
          </div>
        </div>

        {canWrite && (
          <div className="flex justify-end pt-3 border-t border-stone-100">
            <Button type="submit" disabled={saving}>
              {saving ? 'Đang lưu cấu hình...' : 'Lưu & Cập nhật tham số hệ thống'}
            </Button>
          </div>
        )}
      </form>
    </Card>
  )
}
