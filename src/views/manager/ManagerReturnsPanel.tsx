import React, { useEffect, useState } from 'react'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Select, Avatar, Input, Tabs } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { formatVnd, USD_TO_VND_RATE } from '../../i18n/currency'
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'
import type { ReturnCase, DamageClassification } from '../../types/storageHub'
import {
  calculateManagerReturnSettlement,
  isManagerFacilityVisible,
  type ManagerReturnSettlementFees
} from '../../domain/managerRules'
import ManagerActionNotice from './ManagerActionNotice'

interface ManagerReturnsPanelProps {
  user: User
  showToast: (msg: string) => void
  sb: (v: string) => React.ReactNode
}

export default function ManagerReturnsPanel({ user, showToast, sb }: ManagerReturnsPanelProps) {
  const { returns: storeReturns, reviewReturnDispute, completeReturnRefund } = useStorageHub()

  const [returnTab, setReturnTab] = useState(() => storeReturns.some(r => r.status === 'disputed' && isManagerFacilityVisible(user, r.facilityId, r.facilityName)) ? 'disputed' : 'All')
  const [returnSearch, setReturnSearch] = useState('')
  const [selectedReturn, setSelectedReturn] = useState<ReturnCase | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [disputeModalOpen, setDisputeModalOpen] = useState(false)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [disputeResolutionNote, setDisputeResolutionNote] = useState('')
  const [disputeSettlement, setDisputeSettlement] = useState<ManagerReturnSettlementFees>({ damageFee: 0, cleaningFee: 0, lostItemFee: 0, overdueFee: 0, outstandingFee: 0 })
  const [refundTxnRef, setRefundTxnRef] = useState('')

  // Filter returns by facility
  const facilityReturns = storeReturns.filter(r => isManagerFacilityVisible(user, r.facilityId, r.facilityName))

  const disputedCount = facilityReturns.filter(r => r.status === 'disputed').length
  useEffect(() => { if (disputedCount > 0) setReturnTab('disputed') }, [disputedCount])
  const refundPendingCount = facilityReturns.filter(r => r.status === 'refund_pending').length
  const completedCount = facilityReturns.filter(r => r.status === 'completed').length
  const inspectingCount = facilityReturns.filter(
    r => r.status === 'requested' || r.status === 'scheduled' || r.status === 'inspected' || r.status === 'awaiting_customer_confirmation'
  ).length

  const filteredReturns = facilityReturns.filter(r => {
    const matchTab =
      returnTab === 'All' ||
      returnTab === 'Tất cả' ||
      (returnTab === 'disputed' && r.status === 'disputed') ||
      (returnTab === 'refund_pending' && r.status === 'refund_pending') ||
      (returnTab === 'payment_due' && r.status === 'payment_due') ||
      (returnTab === 'completed' && r.status === 'completed') ||
      (returnTab === 'in_progress' && (r.status === 'requested' || r.status === 'scheduled' || r.status === 'inspected' || r.status === 'awaiting_customer_confirmation'))

    const q = returnSearch.toLowerCase().trim()
    const matchSearch =
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.customerName.toLowerCase().includes(q) ||
      r.unitId.toLowerCase().includes(q) ||
      (r.customerEmail && r.customerEmail.toLowerCase().includes(q)) ||
      (r.customerPhone && r.customerPhone.includes(q))

    return matchTab && matchSearch
  })

  const getDamageLabel = (d?: DamageClassification) => {
    switch (d) {
      case 'no_damage':
        return 'Không hư hại'
      case 'minor_damage':
        return 'Hư hại nhẹ'
      case 'major_damage':
        return 'Hư hại nặng'
      case 'abandoned_goods':
        return 'Bỏ lại hàng hóa'
      default:
        return 'Chưa phân loại'
    }
  }

  const getReturnActionReason = (returnCase: ReturnCase) => {
    if (returnCase.status === 'requested' || returnCase.status === 'scheduled' || returnCase.status === 'inspected') return 'Chờ Staff hoàn tất nghiệm thu và lập quyết toán.'
    if (returnCase.status === 'awaiting_customer_confirmation') return 'Chờ Customer xác nhận kết quả quyết toán.'
    if (returnCase.status === 'payment_due') return 'Chờ Customer thanh toán phần còn thiếu trước khi đóng hồ sơ.'
    if (returnCase.status === 'completed') return 'Hồ sơ đã hoàn tất, không còn thao tác Manager.'
    return null
  }

  const openDisputeReview = (returnCase: ReturnCase) => {
    setSelectedReturn(returnCase)
    setDisputeResolutionNote(returnCase.staffNotes || '')
    setDisputeSettlement({
      damageFee: Math.round((returnCase.damageFee || 0) * USD_TO_VND_RATE),
      cleaningFee: Math.round((returnCase.cleaningFee || 0) * USD_TO_VND_RATE),
      lostItemFee: Math.round((returnCase.lostItemFee || 0) * USD_TO_VND_RATE),
      overdueFee: Math.round((returnCase.overdueFee || 0) * USD_TO_VND_RATE),
      outstandingFee: Math.round((returnCase.outstandingFee || 0) * USD_TO_VND_RATE)
    })
    setDisputeModalOpen(true)
  }

  const setSettlementFee = (field: keyof ManagerReturnSettlementFees, value: string) => {
    const parsed = Number(value)
    setDisputeSettlement(current => ({ ...current, [field]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 }))
  }

  const handleReviewDispute = () => {
    if (!selectedReturn) return
    try {
      reviewReturnDispute(selectedReturn.id, user, disputeResolutionNote, settlementInBaseCurrency)
      showToast(
        `Đã rà soát khiếu nại cho đơn ${selectedReturn.id} thành công!`
      )
      setDisputeModalOpen(false)
      setDisputeResolutionNote('')
      setSelectedReturn(null)
    } catch (err: any) {
      showToast(err?.message || 'Error reviewing dispute')
    }
  }

  const handleCompleteRefund = () => {
    if (!selectedReturn) return
    if (!refundTxnRef.trim()) {
      showToast('Vui lòng nhập mã giao dịch hoàn cọc.')
      return
    }
    try {
      completeReturnRefund(selectedReturn.id, user, refundTxnRef.trim())
      showToast(
        `Đã xác nhận hoàn tiền cọc ${formatVnd(selectedReturn.netRefundAmount)} cho ${selectedReturn.customerName}!`
      )
      setRefundModalOpen(false)
      setRefundTxnRef('')
      setSelectedReturn(null)
    } catch (err: any) {
      showToast(err?.message || 'Error completing refund')
    }
  }

  const settlementInBaseCurrency: ManagerReturnSettlementFees = {
    damageFee: disputeSettlement.damageFee / USD_TO_VND_RATE,
    cleaningFee: disputeSettlement.cleaningFee / USD_TO_VND_RATE,
    lostItemFee: disputeSettlement.lostItemFee / USD_TO_VND_RATE,
    overdueFee: disputeSettlement.overdueFee / USD_TO_VND_RATE,
    outstandingFee: disputeSettlement.outstandingFee / USD_TO_VND_RATE
  }

  const disputePreview = selectedReturn
    ? calculateManagerReturnSettlement(selectedReturn.depositAmount, settlementInBaseCurrency)
    : null

  return (
    <div className="fade-in space-y-6">
      <SectionHeader
        title={'Quyết Toán Trả Kho & Xử Lý Khiếu Nại'}
        subtitle={
          'Theo dõi biên bản nghiệm thu, phê duyệt quyết toán hoàn cọc và phân xử khiếu nại từ khách hàng'
        }
      />

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={'Tổng yêu cầu trả kho'}
          value={facilityReturns.length}
          icon={Icon.box}
          iconBg="bg-blue-50 text-blue-700"
        />
        <StatCard
          title={'Khiếu nại chờ xử lý'}
          value={disputedCount}
          delta={disputedCount > 0 ? ('Cần Manager giải quyết') : undefined}
          deltaPositive={disputedCount === 0}
          icon={Icon.alert}
          iconBg={disputedCount > 0 ? 'bg-rose-50 text-rose-700 ring-2 ring-rose-200' : 'bg-stone-50 text-stone-600'}
        />
        <StatCard
          title={'Chờ hoàn tiền cọc'}
          value={refundPendingCount}
          delta={'Đã duyệt biên bản'}
          deltaPositive
          icon={Icon.dollar}
          iconBg="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          title={'Đã hoàn tất thanh lý'}
          value={completedCount}
          icon={Icon.check}
          iconBg="bg-purple-50 text-purple-700"
        />
      </div>

      <ManagerActionNotice tone={disputedCount || refundPendingCount ? 'warning' : 'info'}>
        Manager trực tiếp xử lý hồ sơ bị khiếu nại và hồ sơ đã đủ điều kiện hoàn cọc. Các trạng thái còn lại đang chờ Staff nghiệm thu, Customer xác nhận hoặc Customer thanh toán.
      </ManagerActionNotice>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs
          tabs={
            ['Tất cả', 'Khiếu nại', 'Chờ hoàn cọc', 'Còn nợ phí', 'Đang xử lý', 'Đã hoàn tất']
          }
          active={
            returnTab === 'All' ? 'Tất cả' :
            returnTab === 'disputed' ? 'Khiếu nại' :
            returnTab === 'refund_pending' ? 'Chờ hoàn cọc' :
            returnTab === 'payment_due' ? 'Còn nợ phí' :
            returnTab === 'in_progress' ? 'Đang xử lý' :
            returnTab === 'completed' ? 'Đã hoàn tất' : returnTab
          }
          onChange={val => {
            if (val === 'Tất cả') setReturnTab('All')
            else if (val === 'Khiếu nại') setReturnTab('disputed')
            else if (val === 'Chờ hoàn cọc') setReturnTab('refund_pending')
            else if (val === 'Còn nợ phí') setReturnTab('payment_due')
            else if (val === 'Đang xử lý') setReturnTab('in_progress')
            else if (val === 'Đã hoàn tất') setReturnTab('completed')
            else setReturnTab(val)
          }}
        />
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder={'Tìm theo mã, khách, gian kho...'}
            value={returnSearch}
            onChange={e => setReturnSearch(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
          />
        </div>
      </div>

      {/* Returns Table */}
      <Card className="overflow-hidden border border-stone-200/80 shadow-sm">
        <Table>
          <Thead>
            <tr>
              <Th>{'Mã Trả Kho / HĐ'}</Th>
              <Th>{'Khách Hàng'}</Th>
              <Th>{'Gian Kho'}</Th>
              <Th>{'Ngày Hẹn'}</Th>
              <Th>{'Đánh Giá Nghiệm Thu'}</Th>
              <Th>{'Quyết Toán Tiền Cọc'}</Th>
              <Th>{'Trạng Thái'}</Th>
              <Th className="text-right">{'Hành Động'}</Th>
            </tr>
          </Thead>
          <Tbody>
            {filteredReturns.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-stone-400 text-sm">
                  {'Không có hồ sơ trả kho nào trong danh mục này.'}
                </td>
              </tr>
            ) : (
              filteredReturns.map(ret => {
                const totalDeductions =
                  (ret.damageFee || 0) +
                  (ret.cleaningFee || 0) +
                  (ret.lostItemFee || 0) +
                  (ret.overdueFee || 0) +
                  (ret.outstandingFee || 0)

                return (
                  <Tr
                    key={ret.id}
                    className={
                      ret.status === 'disputed'
                        ? 'bg-rose-50/40 hover:bg-rose-50/70 border-l-4 border-l-rose-500'
                        : ret.status === 'refund_pending'
                        ? 'bg-emerald-50/20 hover:bg-emerald-50/50'
                        : undefined
                    }
                  >
                    <Td>
                      <span className="font-mono text-xs font-bold text-stone-800">{ret.id}</span>
                      <p className="text-[11px] text-stone-400 font-mono">HĐ: {ret.rentalId}</p>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={ret.customerName} size="sm" />
                        <div>
                          <p className="font-medium text-sm text-stone-900">{ret.customerName}</p>
                          <p className="text-xs text-stone-400">{ret.customerPhone || ret.customerEmail}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <span className="font-mono font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded text-xs">
                        {ret.unitId}
                      </span>
                    </Td>
                    <Td>
                      <div className="text-xs">
                        <p className="text-stone-700 font-medium">{ret.scheduledDate}</p>
                        <p className="text-[11px] text-stone-400">
                          {'Yêu cầu:'} {ret.requestedAt.slice(0, 10)}
                        </p>
                      </div>
                    </Td>
                    <Td>
                      <div className="text-xs space-y-0.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                          ret.damageClassification === 'no_damage'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ret.damageClassification === 'minor_damage'
                            ? 'bg-amber-100 text-amber-800'
                            : ret.damageClassification === 'major_damage'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-stone-100 text-stone-600'
                        }`}>
                          {getDamageLabel(ret.damageClassification)}
                        </span>
                        {totalDeductions > 0 && (
                          <p className="text-[11px] text-red-600 font-medium">
                            {`Khấu trừ: -${formatVnd(totalDeductions)}`}
                          </p>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div className="text-xs">
                        <p className="text-stone-500">
                          {'Cọc:'} <span className="font-mono">{formatVnd(ret.depositAmount)}</span>
                        </p>
                        {ret.amountDueFromCustomer && ret.amountDueFromCustomer > 0 ? (
                          <p className="font-bold text-rose-600">
                            {`Khách nộp thêm: ${formatVnd(ret.amountDueFromCustomer ?? 0)}`}
                          </p>
                        ) : (
                          <p className="font-bold text-emerald-700">
                            {`Hoàn lại: ${formatVnd(ret.netRefundAmount)}`}
                          </p>
                        )}
                      </div>
                    </Td>
                    <Td>{sb(ret.status)}</Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReturn(ret)
                            setDetailModalOpen(true)
                          }}
                        >
                          {'Chi tiết'}
                        </Button>

                        {ret.status === 'disputed' && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
                            onClick={() => {
                              openDisputeReview(ret)
                            }}
                          >
                            {'Xử lý khiếu nại'}
                          </Button>
                        )}

                        {ret.status === 'refund_pending' && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                            onClick={() => {
                              setSelectedReturn(ret)
                              setRefundTxnRef('')
                              setRefundModalOpen(true)
                            }}
                          >
                            {'Hoàn cọc'}
                          </Button>
                        )}
                        {getReturnActionReason(ret) && <div className="max-w-48 text-left"><ManagerActionNotice compact tone={ret.status === 'completed' ? 'success' : 'info'}>{getReturnActionReason(ret)}</ManagerActionNotice></div>}
                      </div>
                    </Td>
                  </Tr>
                )
              })
            )}
          </Tbody>
        </Table>
      </Card>

      {/* Return Details Modal */}
      <Modal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={'Chi Tiết Hồ Sơ Trả Kho & Nghiệm Thu'}
      >
        {selectedReturn && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="p-4 rounded-xl bg-slate-900 text-white shadow-inner">
              <div className="flex justify-between items-center text-xs font-mono text-amber-400">
                <span>{selectedReturn.id}</span>
                <span>HĐ: {selectedReturn.rentalId}</span>
              </div>
              <div className="mt-2 flex justify-between items-end">
                <div>
                  <p className="text-xl font-bold font-mono">
                    {`Gian Kho ${selectedReturn.unitId}`}
                  </p>
                  <p className="text-xs text-slate-400">
                    {selectedReturn.customerName} · {selectedReturn.customerPhone}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{'Trạng thái'}</p>
                  {sb(selectedReturn.status)}
                </div>
              </div>
            </div>

            {/* Inspection & Fees Breakdown Bento Box */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-stone-50 p-3.5 rounded-lg border border-stone-200">
              <div>
                <span className="text-stone-400 block">{'Mức độ hư hại'}</span>
                <span className="font-semibold text-stone-800 text-sm">
                  {getDamageLabel(selectedReturn.damageClassification)}
                </span>
              </div>
              <div>
                <span className="text-stone-400 block">{'Khớp danh mục đồ gửi'}</span>
                <span className="font-semibold text-stone-800 text-sm capitalize">
                  {selectedReturn.inventoryMatch || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-stone-400 block">{'Ngày nghiệm thu'}</span>
                <span className="font-medium text-stone-700">
                  {selectedReturn.inspectedAt ? selectedReturn.inspectedAt.slice(0, 16).replace('T', ' ') : 'Chưa nghiệm thu'}
                </span>
              </div>
              <div>
                <span className="text-stone-400 block">{'Vật tư bàn giao lại'}</span>
                <span className="font-medium text-stone-700">
                  {selectedReturn.returnedItems
                    ? `Chìa: ${selectedReturn.returnedItems.key ? '✓' : '✗'} · Thẻ: ${selectedReturn.returnedItems.card ? '✓' : '✗'} · Khóa: ${selectedReturn.returnedItems.lock ? '✓' : '✗'}`
                    : 'N/A'}
                </span>
              </div>
            </div>

            {/* Financial Calculation Matrix */}
            <div className="rounded-lg border border-stone-200 p-3.5 bg-white space-y-2 text-xs">
              <p className="font-semibold text-stone-900 border-b pb-1.5 text-sm">
                {'Chi Tiết Quyết Toán Tài Chính'}
              </p>
              <div className="flex justify-between py-0.5">
                <span className="text-stone-500">{'Tiền đặt cọc ban đầu'}</span>
                <span className="font-mono font-semibold text-stone-800">{formatVnd(selectedReturn.depositAmount)}</span>
              </div>
              {selectedReturn.damageFee > 0 && (
                <div className="flex justify-between py-0.5 text-red-600">
                  <span>{'Phí sửa chữa hư hại'}</span>
                  <span className="font-mono">-{formatVnd(selectedReturn.damageFee)}</span>
                </div>
              )}
              {selectedReturn.cleaningFee && selectedReturn.cleaningFee > 0 && (
                <div className="flex justify-between py-0.5 text-red-600">
                  <span>{'Phí vệ sinh kho'}</span>
                  <span className="font-mono">-{formatVnd(selectedReturn.cleaningFee)}</span>
                </div>
              )}
              {selectedReturn.overdueFee && selectedReturn.overdueFee > 0 && (
                <div className="flex justify-between py-0.5 text-red-600">
                  <span>{`Phí phạt trễ hạn (${selectedReturn.overdueDays || 0} ngày)`}</span>
                  <span className="font-mono">-{formatVnd(selectedReturn.overdueFee)}</span>
                </div>
              )}
              {selectedReturn.outstandingFee && selectedReturn.outstandingFee > 0 && (
                <div className="flex justify-between py-0.5 text-red-600">
                  <span>{'Cước thuê còn nợ'}</span>
                  <span className="font-mono">-{formatVnd(selectedReturn.outstandingFee)}</span>
                </div>
              )}
              <div className="pt-2 border-t flex justify-between font-bold text-sm">
                <span>{'Thực hoàn lại cho khách'}</span>
                <span className={selectedReturn.netRefundAmount > 0 ? 'text-emerald-700 font-mono' : 'text-stone-600 font-mono'}>
                  {formatVnd(selectedReturn.netRefundAmount)}
                </span>
              </div>
              {selectedReturn.amountDueFromCustomer && selectedReturn.amountDueFromCustomer > 0 && (
                <div className="flex justify-between font-bold text-sm text-rose-600 pt-1">
                  <span>{'Khách còn phải nộp thêm'}</span>
                  <span className="font-mono">{formatVnd(selectedReturn.amountDueFromCustomer ?? 0)}</span>
                </div>
              )}
            </div>

            {/* Staff / Customer Notes */}
            {selectedReturn.staffNotes && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs">
                <span className="font-semibold text-amber-900 block mb-1">{'Ghi chú nghiệp vụ'}</span>
                <p className="text-amber-800">{selectedReturn.staffNotes}</p>
              </div>
            )}

            {selectedReturn.customerDecisionNote && (
              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-lg text-xs">
                <span className="font-semibold text-rose-900 block mb-1">
                  {'Lý do khiếu nại của khách hàng'}
                </span>
                <p className="text-rose-800">{selectedReturn.customerDecisionNote}</p>
              </div>
            )}

            {getReturnActionReason(selectedReturn) && <ManagerActionNotice tone={selectedReturn.status === 'completed' ? 'success' : 'info'}>{getReturnActionReason(selectedReturn)}</ManagerActionNotice>}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setDetailModalOpen(false)}>
                {'Đóng'}
              </Button>
              {selectedReturn.status === 'disputed' && (
                <Button
                  variant="primary"
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  onClick={() => {
                    setDetailModalOpen(false)
                    openDisputeReview(selectedReturn)
                  }}
                >
                  {'Xử lý khiếu nại'}
                </Button>
              )}
              {selectedReturn.status === 'refund_pending' && (
                <Button
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    setDetailModalOpen(false)
                    setRefundTxnRef('')
                    setRefundModalOpen(true)
                  }}
                >
                  {'Hoàn cọc ngay'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Review Dispute Modal */}
      <Modal
        open={disputeModalOpen}
        onClose={() => setDisputeModalOpen(false)}
        title={'Phân Xử & Giải Quyết Khiếu Nại Quyết Toán'}
      >
        {selectedReturn && (
          <div className="space-y-4">
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-xs space-y-1.5">
              <p className="font-bold text-rose-900 text-sm">
                {`Khiếu nại từ khách: ${selectedReturn.customerName}`}
              </p>
              <p className="text-rose-800 font-mono">
                {`Kho ${selectedReturn.unitId} · Hồ sơ ${selectedReturn.id}`}
              </p>
              <div className="mt-2 pt-2 border-t border-rose-200/80">
                <p className="text-stone-500">{'Ý kiến phản ánh của khách:'}</p>
                <p className="font-medium text-rose-950 mt-0.5">
                  "{selectedReturn.customerDecisionNote || ('Không đồng ý với phí khấu trừ nghiệm thu kho.')}"
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-bold text-stone-900">Xác nhận lại các khoản quyết toán</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Phí hư hỏng (VND)" type="number" min="0" step="1000" value={String(disputeSettlement.damageFee)} onChange={event => setSettlementFee('damageFee', event.target.value)} />
                <Input label="Phí vệ sinh (VND)" type="number" min="0" step="1000" value={String(disputeSettlement.cleaningFee)} onChange={event => setSettlementFee('cleaningFee', event.target.value)} />
                <Input label="Phí mất vật dụng (VND)" type="number" min="0" step="1000" value={String(disputeSettlement.lostItemFee)} onChange={event => setSettlementFee('lostItemFee', event.target.value)} />
                <Input label="Phí quá hạn (VND)" type="number" min="0" step="1000" value={String(disputeSettlement.overdueFee)} onChange={event => setSettlementFee('overdueFee', event.target.value)} />
                <Input label="Công nợ còn lại (VND)" type="number" min="0" step="1000" value={String(disputeSettlement.outstandingFee)} onChange={event => setSettlementFee('outstandingFee', event.target.value)} />
              </div>
              {disputePreview && <div className="grid gap-2 border-t border-stone-200 pt-3 text-sm sm:grid-cols-3"><p>Khấu trừ: <b>{formatVnd(disputePreview.totalDeductions)}</b></p><p>Hoàn khách: <b className="text-emerald-700">{formatVnd(disputePreview.netRefundAmount)}</b></p><p>Khách nộp thêm: <b className="text-rose-700">{formatVnd(disputePreview.amountDueFromCustomer)}</b></p></div>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700">
                {'Kết luận xử lý của quản lý cơ sở'}
              </label>
              <textarea
                rows={4}
                value={disputeResolutionNote}
                onChange={e => setDisputeResolutionNote(e.target.value)}
                placeholder={
                  'Nhập căn cứ xử lý (ví dụ: Đã đối chiếu ảnh hiện trạng camera ngày vào và ra; chấp thuận giảm 50% phí vệ sinh...)'
                }
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t">
              <Button variant="outline" onClick={() => setDisputeModalOpen(false)}>
                {'Hủy'}
              </Button>
              <Button
                variant="primary"
                className="bg-rose-600 hover:bg-rose-700 text-white"
                onClick={handleReviewDispute}
              >
                {'Gửi kết luận cho khách'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Complete Refund Modal */}
      <Modal
        open={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        title={'Xác Nhận Hoàn Tiền Cọc Cho Khách'}
      >
        {selectedReturn && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-emerald-800">{'Khách thụ hưởng'}</span>
                <span className="font-bold text-emerald-950 text-sm">{selectedReturn.customerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-emerald-800">{'Mã gian kho thanh lý'}</span>
                <span className="font-mono font-bold text-emerald-950">{selectedReturn.unitId}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-emerald-200 text-sm">
                <span className="font-bold text-emerald-900">{'Số tiền hoàn cọc'}</span>
                <span className="font-mono font-extrabold text-emerald-700 text-lg">{formatVnd(selectedReturn.netRefundAmount)}</span>
              </div>
            </div>

            <Input
              label={'Mã chứng từ / Tham chiếu chuyển khoản ngân hàng'}
              value={refundTxnRef}
              onChange={e => setRefundTxnRef(e.target.value)}
              placeholder="e.g. VCB-REF-849204"
            />

            <div className="flex gap-2 justify-end pt-3 border-t">
              <Button variant="outline" onClick={() => setRefundModalOpen(false)}>
                {'Hủy'}
              </Button>
              <Button
                variant="primary"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleCompleteRefund}
              >
                {'Xác nhận hoàn cọc'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
