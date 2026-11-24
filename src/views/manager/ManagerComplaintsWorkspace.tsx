import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Card, Modal } from '../../components/ui'
import { formatVnd } from '../../i18n/currency'
import { isApiAuthenticated } from '../../services/authApi'
import { useReturnRecords } from '../../hooks/useReturnRecords'
import { returnScreenRecord } from '../../services/returnScreenAdapter'
import { getReturn, reviewDispute, returnError } from '../../services/returnApi'
import { isManagerFacilityVisible } from '../../domain/managerRules'
import { useStorageHub } from '../../store/StorageHubContext'
import type { ReturnCase } from '../../types/storageHub'
import type { User } from '../../types'
import ManagerPaymentComplaintsPanel from './ManagerPaymentComplaintsPanel'
import { listManagerPaymentComplaints } from '../../services/managerPaymentComplaintApi'

export interface ManagerComplaintsWorkspaceProps {
  user: User
  showToast: (message: string) => void
  initialTab?: 'payment' | 'returns'
  onTabChange?: (tab: 'payment' | 'returns') => void
}

interface DisputeSettlementFees {
  damageFee: number
  cleaningFee: number
  lostItemFee: number
  overdueFee: number
  outstandingFee: number
}

export default function ManagerComplaintsWorkspace({
  user,
  showToast,
  initialTab = 'payment',
  onTabChange
}: ManagerComplaintsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'payment' | 'returns'>(initialTab)
  const [paymentCount, setPaymentCount] = useState<number>(0)
  const hub = useStorageHub()
  const useApi = isApiAuthenticated()

  // Returns data for return disputes
  const returnApiRecords = useReturnRecords('manager', useApi)
  const storeReturns = useMemo(
    () => (useApi ? returnApiRecords.rows.map(returnScreenRecord) : hub.returns),
    [useApi, returnApiRecords.rows, hub.returns]
  )

  const facilityReturns = useMemo(
    () =>
      storeReturns.filter(
        r =>
          r.status === 'disputed' &&
          isManagerFacilityVisible(user, r.facilityId, r.facilityName)
      ),
    [storeReturns, user]
  )

  const returnDisputeCount = facilityReturns.length

  // Refresh counts
  const refreshPaymentCount = useCallback(async () => {
    if (!useApi) return
    try {
      const res = await listManagerPaymentComplaints(0, 100)
      const count =
        res.data?.filter(
          item => item.status === 'PENDING' || item.status === 'REVIEW_OVERDUE'
        ).length ?? 0
      setPaymentCount(count)
    } catch {
      // ignore
    }
  }, [useApi])

  useEffect(() => {
    void refreshPaymentCount()
    const handleUpdate = () => void refreshPaymentCount()
    window.addEventListener('storagehub:complaints-updated', handleUpdate)
    return () => {
      window.removeEventListener('storagehub:complaints-updated', handleUpdate)
    }
  }, [refreshPaymentCount])

  // Return Dispute Modal State
  const [selectedReturn, setSelectedReturn] = useState<ReturnCase | null>(null)
  const [disputeModalOpen, setDisputeModalOpen] = useState(false)
  const [disputePreset, setDisputePreset] = useState<
    'facility_fault_full_refund' | 'customer_fault_deduct' | 'mutual_settlement' | undefined
  >(undefined)
  const [disputeSettlement, setDisputeSettlement] = useState<DisputeSettlementFees>({
    damageFee: 0,
    cleaningFee: 0,
    lostItemFee: 0,
    overdueFee: 0,
    outstandingFee: 0
  })
  const [disputeResolutionNote, setDisputeResolutionNote] = useState('')
  const [apiBusy, setApiBusy] = useState(false)
  const apiLock = useRef(false)

  const openDisputeReview = (item: ReturnCase) => {
    setSelectedReturn(item)
    setDisputeResolutionNote(item.staffNotes || '')
    setDisputePreset(undefined)
    setDisputeSettlement({
      damageFee: Math.round(item.damageFee || 0),
      cleaningFee: Math.round(item.cleaningFee || 0),
      lostItemFee: Math.round(item.lostItemFee || 0),
      overdueFee: Math.round(item.overdueFee || 0),
      outstandingFee: Math.round(item.outstandingFee || 0)
    })
    setDisputeModalOpen(true)
  }

  const applyDisputePreset = (
    preset: 'facility_fault_full_refund' | 'customer_fault_deduct' | 'mutual_settlement'
  ) => {
    setDisputePreset(preset)
    if (!selectedReturn) return

    if (preset === 'facility_fault_full_refund') {
      setDisputeSettlement({
        damageFee: 0,
        cleaningFee: 0,
        lostItemFee: Math.round(selectedReturn.lostItemFee || 0),
        overdueFee: 0,
        outstandingFee: Math.round(selectedReturn.outstandingFee || 0)
      })
      setDisputeResolutionNote(
        'Thẩm định hiện trường: Phát hiện lỗi kết cấu cơ sở (nóc dột / vách ngấm nước ngoài vào). Cơ sở kho xin lỗi và chịu 100% trách nhiệm: Miễn toàn bộ phí vệ sinh & hư hại, hoàn 100% tiền cọc cho khách hàng.'
      )
    } else if (preset === 'customer_fault_deduct') {
      setDisputeSettlement({
        damageFee: Math.round(selectedReturn.damageFee || 0),
        cleaningFee: Math.round(selectedReturn.cleaningFee || 0),
        lostItemFee: Math.round(selectedReturn.lostItemFee || 0),
        overdueFee: Math.round(selectedReturn.overdueFee || 0),
        outstandingFee: Math.round(selectedReturn.outstandingFee || 0)
      })
      setDisputeResolutionNote(
        'Thẩm định hiện trường: Kết cấu trần, vách, sàn kho khô ráo 100%. Nấm mốc phát sinh do khách đóng gói hàng còn ẩm hoặc vi phạm quy định bảo quản đồ nhạy cảm. Giữ nguyên khấu trừ phí vệ sinh và hư hại theo đúng Hợp đồng.'
      )
    } else if (preset === 'mutual_settlement') {
      const reducedCleaning = Math.round((selectedReturn.cleaningFee || 0) * 0.5)
      setDisputeSettlement({
        damageFee: Math.round(selectedReturn.damageFee || 0),
        cleaningFee: reducedCleaning,
        lostItemFee: Math.round(selectedReturn.lostItemFee || 0),
        overdueFee: Math.round(selectedReturn.overdueFee || 0),
        outstandingFee: Math.round(selectedReturn.outstandingFee || 0)
      })
      setDisputeResolutionNote(
        'Thỏa thuận hỗ trợ thiện chí: Khách thuê kho tiêu chuẩn không điều hòa, vào mùa nồm ẩm. Cơ sở hỗ trợ giảm 50% phí vệ sinh/khử trùng để hai bên hoàn tất quyết toán nhanh chóng.'
      )
    }
  }

  const setSettlementFee = (field: keyof DisputeSettlementFees, value: string) => {
    const parsed = Number(value)
    setDisputeSettlement(current => ({
      ...current,
      [field]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0
    }))
  }

  const totalDeductions =
    disputeSettlement.damageFee +
    disputeSettlement.cleaningFee +
    disputeSettlement.lostItemFee +
    disputeSettlement.overdueFee +
    disputeSettlement.outstandingFee

  const deposit = selectedReturn?.depositAmount || 0
  const calculatedRefund = Math.max(0, deposit - totalDeductions)
  const calculatedDue = Math.max(0, totalDeductions - deposit)

  const handleReviewDispute = async () => {
    if (!selectedReturn) return
    if (!disputeResolutionNote.trim()) {
      showToast('Vui lòng nhập lý do giải quyết khiếu nại.')
      return
    }

    if (useApi) {
      if (apiLock.current) return
      apiLock.current = true
      setApiBusy(true)
      try {
        const latest = await getReturn('manager', selectedReturn.id)
        if (latest.status !== 'disputed' || latest.sourceType === 'RECOVERY') {
          throw new Error('Hồ sơ không còn ở trạng thái khiếu nại trả kho. Vui lòng tải lại.')
        }
        await reviewDispute(latest.id, {
          ...disputeSettlement,
          resolutionNote: disputeResolutionNote.trim(),
          proposedUnitStatus: latest.proposedUnitStatus ?? 'available'
        })
        await returnApiRecords.refresh()
        setDisputeModalOpen(false)
        setSelectedReturn(null)
        showToast(`Đã lưu kết quả xem xét khiếu nại cho hồ sơ ${selectedReturn.id}.`)
        window.dispatchEvent(new Event('storagehub:complaints-updated'))
      } catch (error) {
        showToast(returnError(error))
      } finally {
        apiLock.current = false
        setApiBusy(false)
      }
      return
    }

    // Mock mode fallback
    try {
      hub.reviewReturnDispute(
        selectedReturn.id,
        user,
        disputeResolutionNote.trim(),
        disputeSettlement,
        disputePreset
      )
      showToast(`Đã giải quyết khiếu nại cho hồ sơ ${selectedReturn.id} thành công!`)
      setDisputeModalOpen(false)
      setSelectedReturn(null)
      window.dispatchEvent(new Event('storagehub:complaints-updated'))
    } catch {
      showToast('Có lỗi khi xử lý khiếu nại trong dữ liệu mẫu.')
    }
  }

  const switchTab = (tab: 'payment' | 'returns') => {
    setActiveTab(tab)
    onTabChange?.(tab)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
            Hỗ trợ & Đối soát
          </p>
          <h1 className="text-2xl font-bold text-stone-900">Quản lý Khiếu nại</h1>
          <p className="mt-1 text-sm text-stone-500">
            Trung tâm xử lý khiếu nại tập trung: đối soát giao dịch thanh toán cọc giữ chỗ và giải quyết khiếu nại quyết toán trả kho.
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3">
        <button
          onClick={() => switchTab('payment')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
            activeTab === 'payment'
              ? 'bg-amber-600 text-white shadow'
              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          <span>Khiếu nại thanh toán</span>
          {paymentCount > 0 && (
            <span
              className={`px-2 py-0.5 text-xs rounded-full font-bold ${
                activeTab === 'payment'
                  ? 'bg-amber-800 text-white'
                  : 'bg-amber-200 text-amber-900'
              }`}
            >
              {paymentCount}
            </span>
          )}
        </button>

        <button
          onClick={() => switchTab('returns')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
            activeTab === 'returns'
              ? 'bg-amber-600 text-white shadow'
              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          <span>Khiếu nại trả kho & quyết toán</span>
          {returnDisputeCount > 0 && (
            <span
              className={`px-2 py-0.5 text-xs rounded-full font-bold ${
                activeTab === 'returns'
                  ? 'bg-rose-800 text-white'
                  : 'bg-rose-200 text-rose-900'
              }`}
            >
              {returnDisputeCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: Payment Complaints */}
      {activeTab === 'payment' && (
        <ManagerPaymentComplaintsPanel
          showToast={showToast}
          hideHeader={true}
          onCountChange={setPaymentCount}
        />
      )}

      {/* TAB 2: Return Settlement Disputes */}
      {activeTab === 'returns' && (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            {returnApiRecords.loading ? (
              <p className="p-8 text-center text-sm text-stone-500">
                Đang tải danh sách khiếu nại trả kho…
              </p>
            ) : facilityReturns.length === 0 ? (
              <div className="p-12 text-center text-stone-500 space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="font-semibold text-stone-800">
                  Không có hồ sơ trả kho nào đang khiếu nại
                </p>
                <p className="text-xs text-stone-500">
                  Tất cả các hồ sơ nghiệm thu và quyết toán tại cơ sở đều đang diễn ra bình thường.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-200">
                {facilityReturns.map(item => (
                  <div key={item.id} className="p-5 space-y-3.5 hover:bg-stone-50/60 transition">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 text-base">{item.id}</span>
                          <Badge variant="error">Đang khiếu nại quyết toán</Badge>
                        </div>
                        <p className="mt-1 text-xs text-stone-500">
                          Gian kho: <strong className="text-stone-700">{item.unitId}</strong> · Khách hàng:{' '}
                          <strong className="text-stone-700">{item.customerName}</strong> ({item.customerPhone || 'Không có SĐT'})
                          {item.customerEmail ? ` · ${item.customerEmail}` : ''}
                        </p>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        className="bg-rose-600 hover:bg-rose-700 text-white"
                        onClick={() => openDisputeReview(item)}
                      >
                        Phân xử & Giải quyết khiếu nại
                      </Button>
                    </div>

                    {/* Customer Dispute Reason Note */}
                    <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-900">
                      <div className="flex items-center gap-1.5 font-bold text-rose-800 mb-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Ý kiến phản hồi / Khiếu nại của khách hàng:
                      </div>
                      <p className="italic text-stone-800 bg-white/80 p-2.5 rounded border border-rose-100">
                        "{item.customerDecisionNote || 'Khách hàng không đồng ý với bảng kê quyết toán và yêu cầu xem xét lại.'}"
                      </p>
                    </div>

                    {/* Pre-dispute Settlement Summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs bg-stone-50 p-3 rounded-lg border border-stone-200 text-stone-700">
                      <div>
                        <span className="text-stone-400 block">Cọc ban đầu:</span>
                        <strong className="text-emerald-700 font-semibold">{formatVnd(item.depositAmount || 0)}</strong>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Phí hư hại:</span>
                        <span className="text-stone-800">{formatVnd(item.damageFee || 0)}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Phí vệ sinh:</span>
                        <span className="text-stone-800">{formatVnd(item.cleaningFee || 0)}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Phí mất tài sản:</span>
                        <span className="text-stone-800">{formatVnd(item.lostItemFee || 0)}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Phí quá hạn:</span>
                        <span className="text-stone-800">{formatVnd(item.overdueFee || 0)}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Nợ cước:</span>
                        <span className="text-stone-800">{formatVnd(item.outstandingFee || 0)}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Hoàn cọc tính trước:</span>
                        <strong className="text-amber-800 font-bold">{formatVnd(item.netRefundAmount || 0)}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Dispute Resolution Modal */}
          <Modal
            open={disputeModalOpen}
            onClose={() => {
              if (!apiBusy) setDisputeModalOpen(false)
            }}
            title="Phân Xử & Giải Quyết Khiếu Nại Quyết Toán"
          >
            {selectedReturn && (
              <div className="space-y-4 text-xs sm:text-sm">
                <div className="rounded-lg bg-stone-50 p-3 space-y-1 text-xs border border-stone-200">
                  <p>
                    Hồ sơ trả kho: <strong>{selectedReturn.id}</strong> · Gian kho: <strong>{selectedReturn.unitId}</strong>
                  </p>
                  <p>
                    Khách hàng: <strong>{selectedReturn.customerName}</strong> ({selectedReturn.customerPhone || 'Chưa có SĐT'})
                  </p>
                  <p>
                    Tiền cọc an ninh ban đầu: <strong className="text-emerald-700">{formatVnd(deposit)}</strong>
                  </p>
                </div>

                {/* Customer note banner */}
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs">
                  <p className="font-bold text-rose-800 mb-1">Nội dung khiếu nại của khách:</p>
                  <p className="text-stone-800 italic">
                    "{selectedReturn.customerDecisionNote || 'Khách hàng không đồng ý với biên bản quyết toán.'}"
                  </p>
                </div>

                {/* Quick Presets */}
                <div>
                  <p className="font-bold text-stone-800 mb-1.5 text-xs uppercase tracking-wide">
                    Phương án phân xử nhanh (Khuyến nghị chuẩn):
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => applyDisputePreset('facility_fault_full_refund')}
                      className={`text-left p-2.5 rounded-lg border text-xs transition ${
                        disputePreset === 'facility_fault_full_refund'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500'
                          : 'border-stone-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-stone-700'
                      }`}
                    >
                      <div className="font-bold text-emerald-800">🏢 Lỗi kết cấu cơ sở</div>
                      <div className="text-[11px] text-stone-500 mt-0.5">
                        Miễn 100% phí vệ sinh & hư hại, hoàn đủ cọc cho khách.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyDisputePreset('customer_fault_deduct')}
                      className={`text-left p-2.5 rounded-lg border text-xs transition ${
                        disputePreset === 'customer_fault_deduct'
                          ? 'border-amber-500 bg-amber-50 text-amber-900 ring-1 ring-amber-500'
                          : 'border-stone-200 hover:border-amber-300 hover:bg-amber-50/50 text-stone-700'
                      }`}
                    >
                      <div className="font-bold text-amber-800">👤 Lỗi do khách hàng</div>
                      <div className="text-[11px] text-stone-500 mt-0.5">
                        Giữ nguyên khấu trừ các khoản phí theo biên bản.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyDisputePreset('mutual_settlement')}
                      className={`text-left p-2.5 rounded-lg border text-xs transition ${
                        disputePreset === 'mutual_settlement'
                          ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                          : 'border-stone-200 hover:border-blue-300 hover:bg-blue-50/50 text-stone-700'
                      }`}
                    >
                      <div className="font-bold text-blue-800">🤝 Thỏa thuận thiện chí</div>
                      <div className="text-[11px] text-stone-500 mt-0.5">
                        Giảm 50% phí vệ sinh kho để giải quyết êm đẹp.
                      </div>
                    </button>
                  </div>
                </div>

                {/* Adjustable Fees Table */}
                <div>
                  <p className="font-bold text-stone-800 mb-1.5 text-xs uppercase tracking-wide">
                    Điều chỉnh bảng kê chi phí khấu trừ (VNĐ):
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-stone-600 mb-0.5 font-medium">Phí hư hại kho:</label>
                      <input
                        type="number"
                        min="0"
                        step="10000"
                        value={disputeSettlement.damageFee}
                        onChange={e => setSettlementFee('damageFee', e.target.value)}
                        className="w-full border border-stone-300 rounded px-2 py-1 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-600 mb-0.5 font-medium">Phí dọn dẹp vệ sinh:</label>
                      <input
                        type="number"
                        min="0"
                        step="10000"
                        value={disputeSettlement.cleaningFee}
                        onChange={e => setSettlementFee('cleaningFee', e.target.value)}
                        className="w-full border border-stone-300 rounded px-2 py-1 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-600 mb-0.5 font-medium">Phí mất chìa/thẻ/ổ khóa:</label>
                      <input
                        type="number"
                        min="0"
                        step="10000"
                        value={disputeSettlement.lostItemFee}
                        onChange={e => setSettlementFee('lostItemFee', e.target.value)}
                        className="w-full border border-stone-300 rounded px-2 py-1 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-600 mb-0.5 font-medium">Phí phạt trễ hạn:</label>
                      <input
                        type="number"
                        min="0"
                        step="10000"
                        value={disputeSettlement.overdueFee}
                        onChange={e => setSettlementFee('overdueFee', e.target.value)}
                        className="w-full border border-stone-300 rounded px-2 py-1 text-sm bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-stone-600 mb-0.5 font-medium">Nợ cước tồn đọng:</label>
                      <input
                        type="number"
                        min="0"
                        step="10000"
                        value={disputeSettlement.outstandingFee}
                        onChange={e => setSettlementFee('outstandingFee', e.target.value)}
                        className="w-full border border-stone-300 rounded px-2 py-1 text-sm bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Real-time Calculation Summary */}
                <div className="rounded-lg bg-stone-100 p-3 text-xs space-y-1.5 border border-stone-200">
                  <div className="flex justify-between">
                    <span className="text-stone-600">Tổng phí khấu trừ sau điều chỉnh:</span>
                    <strong className="text-rose-700">{formatVnd(totalDeductions)}</strong>
                  </div>
                  <div className="flex justify-between border-t border-stone-200 pt-1">
                    <span className="text-stone-700 font-medium">Tiền cọc an ninh ban đầu:</span>
                    <strong className="text-emerald-700">{formatVnd(deposit)}</strong>
                  </div>
                  <div className="flex justify-between border-t border-stone-300 pt-1.5 font-bold text-sm">
                    {calculatedRefund > 0 ? (
                      <>
                        <span className="text-emerald-800">Hoàn trả lại khách hàng:</span>
                        <span className="text-emerald-700">{formatVnd(calculatedRefund)}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-rose-800">Khách hàng cần đóng thêm:</span>
                        <span className="text-rose-700">{formatVnd(calculatedDue)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Resolution Note */}
                <div>
                  <label className="block font-bold text-stone-800 mb-1 text-xs">
                    Ghi chú kết luận & giải thích cho khách hàng <span className="text-rose-500">*</span>:
                  </label>
                  <textarea
                    rows={3}
                    value={disputeResolutionNote}
                    onChange={e => setDisputeResolutionNote(e.target.value)}
                    placeholder="Nhập nội dung giải thích căn cứ xử lý khiếu nại để gửi cho khách..."
                    className="w-full border border-stone-300 rounded-lg p-2.5 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* Modal Actions */}
                <div className="flex gap-2 justify-end pt-3 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setDisputeModalOpen(false)}
                    disabled={apiBusy}
                  >
                    Hủy
                  </Button>
                  <Button
                    variant="primary"
                    className="bg-rose-600 hover:bg-rose-700 text-white"
                    disabled={apiBusy || !disputeResolutionNote.trim()}
                    onClick={handleReviewDispute}
                  >
                    {apiBusy ? 'Đang gửi kết luận…' : 'Gửi kết luận cho khách'}
                  </Button>
                </div>
              </div>
            )}
          </Modal>
        </div>
      )}
    </div>
  )
}
