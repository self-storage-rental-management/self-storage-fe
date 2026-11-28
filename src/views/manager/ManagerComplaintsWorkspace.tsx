import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Card, Modal } from '../../components/ui'
import { formatVnd } from '../../i18n/currency'
import { isApiAuthenticated } from '../../services/authApi'
import { useReturnRecords } from '../../hooks/useReturnRecords'
import { returnScreenRecord } from '../../services/returnScreenAdapter'
import { getReturn, reviewDispute, returnError } from '../../services/returnApi'
import { isManagerFacilityVisible } from '../../domain/managerRules'
import { useStorageHub } from '../../store/StorageHubContext'
import type { ReturnCase, RentalRecord } from '../../types/storageHub'
import type { User } from '../../types'
import ManagerPaymentComplaintsPanel from './ManagerPaymentComplaintsPanel'
import { listManagerPaymentComplaints } from '../../services/managerPaymentComplaintApi'
import { getRental } from '../../services/rentalApi'

import ManagerSuspicionReports from './ManagerSuspicionReports'

export type ManagerComplaintsTab = 'payment' | 'returns' | 'reports'

const rentalCodeCache = new Map<string, string>()

function RentalDisplayCode({
  rentalId,
  useApi,
  hubRentals
}: {
  rentalId: string
  useApi: boolean
  hubRentals?: RentalRecord[]
}) {
  const [code, setCode] = useState<string | null>(() => rentalCodeCache.get(rentalId) ?? null)

  useEffect(() => {
    let active = true
    if (rentalCodeCache.has(rentalId)) {
      setCode(rentalCodeCache.get(rentalId)!)
      return
    }
    if (useApi) {
      void getRental('manager', rentalId)
        .then(record => {
          const display = record.displayCode || rentalId
          rentalCodeCache.set(rentalId, display)
          if (active) setCode(display)
        })
        .catch(() => {
          if (active) setCode(rentalId)
        })
    } else {
      const match = hubRentals?.find(r => r.id === rentalId)
      const display = match?.contractId || rentalId
      rentalCodeCache.set(rentalId, display)
      setCode(display)
    }
    return () => {
      active = false
    }
  }, [rentalId, useApi, hubRentals])

  return <span>{code ?? 'Đang tải…'}</span>
}

export interface ManagerComplaintsWorkspaceProps {
  user: User
  showToast: (message: string) => void
  activeTab: ManagerComplaintsTab
  onTabChange: (tab: ManagerComplaintsTab) => void
  onOpenReport: (id: string) => void
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
  activeTab,
  onTabChange,
  onOpenReport,
}: ManagerComplaintsWorkspaceProps) {
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
          (r.status === 'disputed' || r.customerDecision === 'disputed') &&
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
  const [lockFee, setLockFee] = useState(0)
  const [palletFee, setPalletFee] = useState(0)
  const [disputeResolutionNote, setDisputeResolutionNote] = useState('')
  const [apiBusy, setApiBusy] = useState(false)
  const apiLock = useRef(false)

  const openDisputeReview = (item: ReturnCase) => {
    setSelectedReturn(item)
    setDisputeResolutionNote(item.staffNotes || '')
    setDisputePreset(undefined)
    const apiMatch = (returnApiRecords.rows || []).find(r => r.id === item.id)
    const pLoss = apiMatch?.palletLossFee || 0
    const totalLost = Math.round(item.lostItemFee || 0)
    const initPallet = pLoss > 0 ? pLoss : 0
    const initLock = Math.max(0, totalLost - initPallet)
    setLockFee(initLock)
    setPalletFee(initPallet)
    setDisputeSettlement({
      damageFee: Math.round(item.damageFee || 0),
      cleaningFee: Math.round(item.cleaningFee || 0),
      lostItemFee: totalLost,
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
        lostItemFee: 0,
        overdueFee: 0,
        outstandingFee: Math.round(selectedReturn.outstandingFee || 0)
      })
      setLockFee(0)
      setPalletFee(0)
      setDisputeResolutionNote(
        'Thẩm định hiện trường: Phát hiện lỗi kết cấu cơ sở (nóc dột / vách ngấm nước ngoài vào). Cơ sở kho xin lỗi và chịu 100% trách nhiệm: Miễn toàn bộ phí vệ sinh, hư hại & pallet, hoàn 100% tiền cọc cho khách hàng.'
      )
    } else if (preset === 'customer_fault_deduct') {
      const apiMatch = (returnApiRecords.rows || []).find(r => r.id === selectedReturn.id)
      const pLoss = apiMatch?.palletLossFee || 0
      const totalLost = Math.round(selectedReturn.lostItemFee || 0)
      const initPallet = pLoss > 0 ? pLoss : 0
      const initLock = Math.max(0, totalLost - initPallet)
      setDisputeSettlement({
        damageFee: Math.round(selectedReturn.damageFee || 0),
        cleaningFee: Math.round(selectedReturn.cleaningFee || 0),
        lostItemFee: totalLost,
        overdueFee: Math.round(selectedReturn.overdueFee || 0),
        outstandingFee: Math.round(selectedReturn.outstandingFee || 0)
      })
      setLockFee(initLock)
      setPalletFee(initPallet)
      setDisputeResolutionNote(
        'Thẩm định hiện trường: Kết cấu trần, vách, sàn kho khô ráo 100%. Nấm mốc phát sinh do khách đóng gói hàng còn ẩm hoặc vi phạm quy định bảo quản đồ nhạy cảm. Giữ nguyên khấu trừ phí vệ sinh, hư hại và phụ kiện/pallet theo đúng Hợp đồng.'
      )
    } else if (preset === 'mutual_settlement') {
      const reducedCleaning = Math.round((selectedReturn.cleaningFee || 0) * 0.5)
      const apiMatch = (returnApiRecords.rows || []).find(r => r.id === selectedReturn.id)
      const pLoss = apiMatch?.palletLossFee || 0
      const totalLost = Math.round(selectedReturn.lostItemFee || 0)
      const initPallet = pLoss > 0 ? pLoss : 0
      const initLock = Math.max(0, totalLost - initPallet)
      setDisputeSettlement({
        damageFee: Math.round(selectedReturn.damageFee || 0),
        cleaningFee: reducedCleaning,
        lostItemFee: totalLost,
        overdueFee: Math.round(selectedReturn.overdueFee || 0),
        outstandingFee: Math.round(selectedReturn.outstandingFee || 0)
      })
      setLockFee(initLock)
      setPalletFee(initPallet)
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

  const matchingApiItem = (returnApiRecords.rows || []).find(r => r.id === selectedReturn?.id)
  const unusedRentCredit = matchingApiItem?.setupEarlyExit
    ? (matchingApiItem.rentalRefundCredit ?? 0)
    : (matchingApiItem?.activeReturnPolicy?.rentalRefundAmount ?? 0)

  const totalDeductions =
    disputeSettlement.damageFee +
    disputeSettlement.cleaningFee +
    lockFee +
    palletFee +
    disputeSettlement.overdueFee +
    disputeSettlement.outstandingFee

  const deposit = selectedReturn?.depositAmount || 0
  const depositRemaining = Math.max(0, deposit - totalDeductions)
  const excessDeduction = Math.max(0, totalDeductions - deposit)
  const netRentRefund = Math.max(0, unusedRentCredit - excessDeduction)
  const calculatedRefund = depositRemaining + netRentRefund
  const calculatedDue = Math.max(0, excessDeduction - unusedRentCredit)

  const handleReviewDispute = async () => {
    if (!selectedReturn) return
    if (!disputeResolutionNote.trim()) {
      showToast('Vui lòng nhập lý do giải quyết khiếu nại.')
      return
    }

    const finalSettlement: DisputeSettlementFees = {
      ...disputeSettlement,
      lostItemFee: lockFee + palletFee
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
          ...finalSettlement,
          resolutionNote: disputeResolutionNote.trim(),
          proposedUnitStatus: latest.proposedUnitStatus ?? 'available'
        })
        await returnApiRecords.refresh()
        try {
          hub.reviewReturnDispute(
            selectedReturn.id,
            user,
            disputeResolutionNote.trim(),
            finalSettlement,
            disputePreset
          )
        } catch {
          // ignore if record exists only in backend database
        }
        setDisputeModalOpen(false)
        setSelectedReturn(null)
        showToast('Đã lưu kết quả xem xét khiếu nại thành công.')
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
        finalSettlement,
        disputePreset
      )
      showToast('Đã giải quyết khiếu nại thành công!')
      setDisputeModalOpen(false)
      setSelectedReturn(null)
      window.dispatchEvent(new Event('storagehub:complaints-updated'))
    } catch {
      showToast('Có lỗi khi xử lý khiếu nại trong dữ liệu mẫu.')
    }
  }

  const switchTab = onTabChange

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
            Hỗ trợ & Đối soát
          </p>
          <h1 className="text-2xl font-bold text-stone-900">Khiếu nại và báo cáo</h1>
          <p className="mt-1 text-sm text-stone-500">
            Xem khiếu nại thanh toán, khiếu nại quyết toán trả kho và báo cáo nghi vấn hàng cấm.
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
        {useApi && <button type="button" aria-pressed={activeTab === 'reports'} onClick={() => switchTab('reports')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${activeTab === 'reports'
            ? 'bg-amber-600 text-white shadow' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}>
          Báo cáo nghi vấn
        </button>}
      </div>

      {activeTab === 'reports' && useApi && <ManagerSuspicionReports onOpenReport={onOpenReport} />}

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
                          <span className="font-bold text-stone-900 text-base font-mono">
                            <RentalDisplayCode rentalId={item.rentalId} useApi={useApi} hubRentals={hub.rentals} />
                          </span>
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
            size="2xl"
          >
            {selectedReturn && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs sm:text-sm">
                {/* Cột trái: Thông tin hợp đồng + Ý kiến khách + Phương án nhanh + Ghi chú kết luận */}
                <div className="space-y-3 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    {/* Thông tin hồ sơ & cọc */}
                    <div className="rounded-lg bg-stone-50 p-2.5 space-y-1 text-xs border border-stone-200">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span>
                          Mã hồ sơ thuê: <strong className="font-mono text-stone-900"><RentalDisplayCode rentalId={selectedReturn.rentalId} useApi={useApi} hubRentals={hub.rentals} /></strong>
                        </span>
                        <span>Gian kho: <strong>{selectedReturn.unitId}</strong></span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span>
                          Khách hàng: <strong>{selectedReturn.customerName}</strong> ({selectedReturn.customerPhone || 'Chưa có SĐT'})
                        </span>
                        <span>
                          Cọc ban đầu: <strong className="text-emerald-700">{formatVnd(deposit)}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Customer note banner */}
                    <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs">
                      <p className="font-bold text-rose-800 mb-0.5">Nội dung khiếu nại của khách:</p>
                      <p className="text-stone-800 italic line-clamp-3">
                        "{selectedReturn.customerDecisionNote || 'Khách hàng không đồng ý với biên bản quyết toán.'}"
                      </p>
                    </div>

                    {/* Quick Presets */}
                    <div>
                      <p className="font-bold text-stone-800 mb-1 text-xs uppercase tracking-wide">
                        Phương án phân xử nhanh:
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => applyDisputePreset('facility_fault_full_refund')}
                          className={`text-left p-2 rounded-lg border text-xs transition ${
                            disputePreset === 'facility_fault_full_refund'
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500'
                              : 'border-stone-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-stone-700'
                          }`}
                        >
                          <div className="font-bold text-emerald-800 text-[11px] leading-tight">🏢 Lỗi cơ sở</div>
                          <div className="text-[10px] text-stone-500 mt-0.5 line-clamp-2">
                            Miễn 100% phí vệ sinh & hư hại.
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => applyDisputePreset('customer_fault_deduct')}
                          className={`text-left p-2 rounded-lg border text-xs transition ${
                            disputePreset === 'customer_fault_deduct'
                              ? 'border-amber-500 bg-amber-50 text-amber-900 ring-1 ring-amber-500'
                              : 'border-stone-200 hover:border-amber-300 hover:bg-amber-50/50 text-stone-700'
                          }`}
                        >
                          <div className="font-bold text-amber-800 text-[11px] leading-tight">👤 Lỗi khách</div>
                          <div className="text-[10px] text-stone-500 mt-0.5 line-clamp-2">
                            Giữ nguyên khấu trừ biên bản.
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => applyDisputePreset('mutual_settlement')}
                          className={`text-left p-2 rounded-lg border text-xs transition ${
                            disputePreset === 'mutual_settlement'
                              ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                              : 'border-stone-200 hover:border-blue-300 hover:bg-blue-50/50 text-stone-700'
                          }`}
                        >
                          <div className="font-bold text-blue-800 text-[11px] leading-tight">🤝 Thiện chí</div>
                          <div className="text-[10px] text-stone-500 mt-0.5 line-clamp-2">
                            Giảm 50% phí vệ sinh kho.
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Resolution Note */}
                  <div>
                    <label className="block font-bold text-stone-800 mb-1 text-xs">
                      Ghi chú kết luận & giải thích cho khách hàng <span className="text-rose-500">*</span>:
                    </label>
                    <textarea
                      rows={2}
                      value={disputeResolutionNote}
                      onChange={e => setDisputeResolutionNote(e.target.value)}
                      placeholder="Nhập nội dung giải thích căn cứ xử lý khiếu nại để gửi cho khách..."
                      className="w-full border border-stone-300 rounded-lg p-2 text-xs bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Cột phải: Bảng kê khấu trừ + Dự toán hoàn/thu + Nút hành động */}
                <div className="space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    {/* Adjustable Fees Table */}
                    <div>
                      <p className="font-bold text-stone-800 mb-1 text-xs uppercase tracking-wide">
                        Điều chỉnh chi phí khấu trừ (VNĐ):
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-stone-600 mb-0.5 font-medium text-[11px]">Phí hư hại kho:</label>
                          <input
                            type="number"
                            min="0"
                            step="10000"
                            value={disputeSettlement.damageFee}
                            onChange={e => setSettlementFee('damageFee', e.target.value)}
                            className="w-full border border-stone-300 rounded px-2 py-1 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-stone-600 mb-0.5 font-medium text-[11px]">Phí dọn vệ sinh:</label>
                          <input
                            type="number"
                            min="0"
                            step="10000"
                            value={disputeSettlement.cleaningFee}
                            onChange={e => setSettlementFee('cleaningFee', e.target.value)}
                            className="w-full border border-stone-300 rounded px-2 py-1 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-stone-600 mb-0.5 font-medium text-[11px]">Phí mất chìa/thẻ/khóa:</label>
                          <input
                            type="number"
                            min="0"
                            step="10000"
                            value={lockFee}
                            onChange={e => setLockFee(Math.max(0, Number(e.target.value) || 0))}
                            className="w-full border border-stone-300 rounded px-2 py-1 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-0.5">
                            <label className="block text-stone-600 font-medium text-[11px]">Phí thiếu tấm kê (Pallet):</label>
                            <span className="text-[10px] text-stone-400">150k/tấm</span>
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="150000"
                            value={palletFee}
                            onChange={e => setPalletFee(Math.max(0, Number(e.target.value) || 0))}
                            className="w-full border border-stone-300 rounded px-2 py-1 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-stone-600 mb-0.5 font-medium text-[11px]">Phí phạt trễ hạn:</label>
                          <input
                            type="number"
                            min="0"
                            step="10000"
                            value={disputeSettlement.overdueFee}
                            onChange={e => setSettlementFee('overdueFee', e.target.value)}
                            className="w-full border border-stone-300 rounded px-2 py-1 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-stone-600 mb-0.5 font-medium text-[11px]">Nợ cước tồn đọng:</label>
                          <input
                            type="number"
                            min="0"
                            step="10000"
                            value={disputeSettlement.outstandingFee}
                            onChange={e => setSettlementFee('outstandingFee', e.target.value)}
                            className="w-full border border-stone-300 rounded px-2 py-1 text-xs bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bảng chiết tính 2 bước minh bạch theo đúng tư duy con người */}
                    <div className="rounded-lg bg-stone-50 border border-stone-200 p-2.5 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-stone-600 border-b border-stone-200 pb-0.5">
                        <span>Chiết tính hoàn tiền quyết toán</span>
                        <span className="text-stone-400 font-normal text-[10px]">Đơn vị: VNĐ</span>
                      </div>

                      {/* BƯỚC 1: Quyết toán tiền cọc an ninh */}
                      <div className="space-y-0.5 text-[11px]">
                        <p className="font-bold text-stone-700">1. Quyết toán tiền cọc an ninh:</p>
                        <div className="flex justify-between items-center text-stone-600 pl-2">
                          <span>· Tiền cọc ban đầu:</span>
                          <span className="font-mono font-semibold text-stone-800">{formatVnd(deposit)}</span>
                        </div>
                        <div className="flex justify-between items-center text-rose-700 pl-2">
                          <span>· Trừ chi phí phát sinh sau phân xử:</span>
                          <span className="font-mono font-semibold">-{formatVnd(totalDeductions)}</span>
                        </div>
                        {totalDeductions > 0 && (
                          <div className="pl-5 text-[10px] text-stone-500 space-y-0.5">
                            {disputeSettlement.damageFee > 0 && (
                              <div className="flex justify-between">
                                <span>Hư hại kho:</span>
                                <span>-{formatVnd(disputeSettlement.damageFee)}</span>
                              </div>
                            )}
                            {disputeSettlement.cleaningFee > 0 && (
                              <div className="flex justify-between">
                                <span>Vệ sinh kho:</span>
                                <span>-{formatVnd(disputeSettlement.cleaningFee)}</span>
                              </div>
                            )}
                            {lockFee > 0 && (
                              <div className="flex justify-between">
                                <span>Mất chìa/thẻ/khóa:</span>
                                <span>-{formatVnd(lockFee)}</span>
                              </div>
                            )}
                            {palletFee > 0 && (
                              <div className="flex justify-between">
                                <span>Thiếu tấm kê (Pallet):</span>
                                <span>-{formatVnd(palletFee)}</span>
                              </div>
                            )}
                            {disputeSettlement.overdueFee > 0 && (
                              <div className="flex justify-between">
                                <span>Quá hạn trả kho:</span>
                                <span>-{formatVnd(disputeSettlement.overdueFee)}</span>
                              </div>
                            )}
                            {disputeSettlement.outstandingFee > 0 && (
                              <div className="flex justify-between">
                                <span>Nợ cước tồn đọng:</span>
                                <span>-{formatVnd(disputeSettlement.outstandingFee)}</span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex justify-between items-center border-t border-dashed border-stone-200 pt-0.5 pl-2 font-semibold">
                          <span className="text-stone-700">=&gt; Tiền cọc còn lại hoàn trả:</span>
                          <span className={`font-mono ${depositRemaining > 0 ? 'text-emerald-700' : 'text-stone-600'}`}>
                            {formatVnd(depositRemaining)}
                          </span>
                        </div>
                        {excessDeduction > 0 && (
                          <div className="flex justify-between items-center text-rose-700 pl-2 text-[10px] font-medium">
                            <span>(Chi phí vượt quá tiền cọc:</span>
                            <span>-{formatVnd(excessDeduction)})</span>
                          </div>
                        )}
                      </div>

                      {/* BƯỚC 2: Tiền thuê các tháng chưa sử dụng (nếu có) */}
                      {unusedRentCredit > 0 && (
                        <div className="border-t border-stone-200 pt-1 space-y-0.5 text-[11px]">
                          <p className="font-bold text-stone-700">2. Hoàn tiền thuê chưa sử dụng:</p>
                          <div className="flex justify-between items-center text-stone-700 pl-2">
                            <span>· Tiền cước các kỳ chưa dùng:</span>
                            <span className="font-mono font-semibold text-emerald-700">+{formatVnd(unusedRentCredit)}</span>
                          </div>
                          {excessDeduction > 0 && (
                            <div className="flex justify-between items-center text-rose-700 pl-2 text-[10px]">
                              <span>· Cấn trừ phần chi phí vượt cọc:</span>
                              <span className="font-mono">-{formatVnd(Math.min(unusedRentCredit, excessDeduction))}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* BƯỚC 3: Kết luận tổng tiền thực nhận / nộp thêm */}
                      <div className="border-t-2 border-stone-300 pt-1">
                        {calculatedRefund > 0 ? (
                          <div className="rounded bg-emerald-50 border border-emerald-300 px-2 py-1.5 flex items-center justify-between">
                            <div>
                              <span className="text-[11px] font-black text-emerald-900 uppercase block leading-tight">
                                (=) Thực nhận hoàn trả khách:
                              </span>
                              <span className="text-[9px] text-emerald-700 leading-none block mt-0.5">
                                {unusedRentCredit > 0
                                  ? `Cọc còn (${formatVnd(depositRemaining)}) + Cước hoàn (${formatVnd(netRentRefund)})`
                                  : `Cọc (${formatVnd(deposit)}) − Chi phí (${formatVnd(totalDeductions)})`}
                              </span>
                            </div>
                            <span className="text-sm font-black text-emerald-700 font-mono">
                              {formatVnd(calculatedRefund)}
                            </span>
                          </div>
                        ) : calculatedDue > 0 ? (
                          <div className="rounded bg-rose-50 border border-rose-300 px-2 py-1.5 flex items-center justify-between">
                            <div>
                              <span className="text-[11px] font-black text-rose-900 uppercase block leading-tight">
                                (=) Khách hàng cần đóng thêm:
                              </span>
                              <span className="text-[9px] text-rose-700 leading-none block mt-0.5">
                                Chi phí vượt quá tiền cọc và tiền hoàn
                              </span>
                            </div>
                            <span className="text-sm font-black text-rose-700 font-mono">
                              {formatVnd(calculatedDue)}
                            </span>
                          </div>
                        ) : (
                          <div className="rounded bg-stone-100 border border-stone-300 px-2 py-1.5 flex items-center justify-between">
                            <div>
                              <span className="text-[11px] font-black text-stone-800 uppercase block leading-tight">
                                (=) Quyết toán cân bằng:
                              </span>
                              <span className="text-[9px] text-stone-600 leading-none block mt-0.5">
                                Tiền cọc cấn trừ vừa đủ chi phí
                              </span>
                            </div>
                            <span className="text-sm font-black text-stone-800 font-mono">0 ₫</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modal Actions */}
                  <div className="flex gap-2 justify-end pt-1.5 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDisputeModalOpen(false)}
                      disabled={apiBusy}
                    >
                      Hủy
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="bg-rose-600 hover:bg-rose-700 text-white"
                      disabled={apiBusy || !disputeResolutionNote.trim()}
                      onClick={handleReviewDispute}
                    >
                      {apiBusy ? 'Đang gửi kết luận…' : 'Gửi kết luận cho khách'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Modal>
        </div>
      )}
    </div>
  )
}
