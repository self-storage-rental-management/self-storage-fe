import React, { useState } from 'react'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Select, Avatar, Input, Tabs } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { formatVnd, useLanguage } from '../../i18n/LanguageContext'
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'
import type { ReturnCase, DamageClassification } from '../../types/storageHub'

interface ManagerReturnsPanelProps {
  user: User
  showToast: (msg: string) => void
  sb: (v: string) => React.ReactNode
}

export default function ManagerReturnsPanel({ user, showToast, sb }: ManagerReturnsPanelProps) {
  const { lang } = useLanguage()
  const { returns: storeReturns, reviewReturnDispute, completeReturnRefund } = useStorageHub()

  const [returnTab, setReturnTab] = useState('All')
  const [returnSearch, setReturnSearch] = useState('')
  const [selectedReturn, setSelectedReturn] = useState<ReturnCase | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [disputeModalOpen, setDisputeModalOpen] = useState(false)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [disputeResolutionNote, setDisputeResolutionNote] = useState('')
  const [refundTxnRef, setRefundTxnRef] = useState('')

  // Filter returns by facility
  const facilityReturns = storeReturns.filter(
    r => !user.facility || r.facilityName === user.facility || user.facility === 'All facilities'
  )

  const disputedCount = facilityReturns.filter(r => r.status === 'disputed').length
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
        return lang === 'vi' ? 'Không hư hại' : 'No Damage'
      case 'minor_damage':
        return lang === 'vi' ? 'Hư hại nhẹ' : 'Minor Damage'
      case 'major_damage':
        return lang === 'vi' ? 'Hư hại nặng' : 'Major Damage'
      case 'abandoned_goods':
        return lang === 'vi' ? 'Bỏ lại hàng hóa' : 'Abandoned Goods'
      default:
        return lang === 'vi' ? 'Chưa phân loại' : 'Unclassified'
    }
  }

  const handleReviewDispute = () => {
    if (!selectedReturn) return
    try {
      reviewReturnDispute(selectedReturn.id, user, disputeResolutionNote)
      showToast(
        lang === 'vi'
          ? `Đã rà soát khiếu nại cho đơn ${selectedReturn.id} thành công!`
          : `Dispute review submitted for ${selectedReturn.id}!`
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
      showToast(lang === 'vi' ? 'Vui lòng nhập mã giao dịch hoàn cọc.' : 'Please enter transaction reference.')
      return
    }
    try {
      completeReturnRefund(selectedReturn.id, user, refundTxnRef.trim())
      showToast(
        lang === 'vi'
          ? `Đã xác nhận hoàn tiền cọc ${formatVnd(selectedReturn.netRefundAmount)} cho ${selectedReturn.customerName}!`
          : `Refund of ${formatVnd(selectedReturn.netRefundAmount)} completed for ${selectedReturn.customerName}!`
      )
      setRefundModalOpen(false)
      setRefundTxnRef('')
      setSelectedReturn(null)
    } catch (err: any) {
      showToast(err?.message || 'Error completing refund')
    }
  }

  return (
    <div className="fade-in space-y-6">
      <SectionHeader
        title={lang === 'vi' ? 'Quyết Toán Trả Kho & Xử Lý Khiếu Nại' : 'Move-Out Settlement & Disputes'}
        subtitle={
          lang === 'vi'
            ? 'Theo dõi biên bản nghiệm thu, phê duyệt quyết toán hoàn cọc và phân xử khiếu nại từ khách hàng'
            : 'Track move-out inspections, resolve damage fee disputes, and process deposit refunds'
        }
      />

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={lang === 'vi' ? 'Tổng yêu cầu trả kho' : 'Total Returns'}
          value={facilityReturns.length}
          icon={Icon.box}
          iconBg="bg-blue-50 text-blue-700"
        />
        <StatCard
          title={lang === 'vi' ? 'Khiếu nại chờ xử lý' : 'Active Disputes'}
          value={disputedCount}
          delta={disputedCount > 0 ? (lang === 'vi' ? 'Cần Manager giải quyết' : 'Requires Manager action') : undefined}
          deltaPositive={disputedCount === 0}
          icon={Icon.alert}
          iconBg={disputedCount > 0 ? 'bg-rose-50 text-rose-700 ring-2 ring-rose-200' : 'bg-stone-50 text-stone-600'}
        />
        <StatCard
          title={lang === 'vi' ? 'Chờ hoàn tiền cọc' : 'Refunds Pending'}
          value={refundPendingCount}
          delta={lang === 'vi' ? 'Đã duyệt biên bản' : 'Inspection accepted'}
          deltaPositive
          icon={Icon.dollar}
          iconBg="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          title={lang === 'vi' ? 'Đã hoàn tất thanh lý' : 'Completed Returns'}
          value={completedCount}
          icon={Icon.check}
          iconBg="bg-purple-50 text-purple-700"
        />
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs
          tabs={
            lang === 'vi'
              ? ['Tất cả', 'Khiếu nại', 'Chờ hoàn cọc', 'Còn nợ phí', 'Đang xử lý', 'Đã hoàn tất']
              : ['All', 'disputed', 'refund_pending', 'payment_due', 'in_progress', 'completed']
          }
          active={
            returnTab === 'All' && lang === 'vi' ? 'Tất cả' :
            returnTab === 'disputed' && lang === 'vi' ? 'Khiếu nại' :
            returnTab === 'refund_pending' && lang === 'vi' ? 'Chờ hoàn cọc' :
            returnTab === 'payment_due' && lang === 'vi' ? 'Còn nợ phí' :
            returnTab === 'in_progress' && lang === 'vi' ? 'Đang xử lý' :
            returnTab === 'completed' && lang === 'vi' ? 'Đã hoàn tất' : returnTab
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
            placeholder={lang === 'vi' ? 'Tìm theo mã, khách, gian kho...' : 'Search return ID, tenant, unit...'}
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
              <Th>{lang === 'vi' ? 'Mã Trả Kho / HĐ' : 'Return ID / Lease'}</Th>
              <Th>{lang === 'vi' ? 'Khách Hàng' : 'Customer'}</Th>
              <Th>{lang === 'vi' ? 'Gian Kho' : 'Unit'}</Th>
              <Th>{lang === 'vi' ? 'Ngày Hẹn' : 'Schedule'}</Th>
              <Th>{lang === 'vi' ? 'Đánh Giá Nghiệm Thu' : 'Inspection'}</Th>
              <Th>{lang === 'vi' ? 'Quyết Toán Tiền Cọc' : 'Deposit Settlement'}</Th>
              <Th>{lang === 'vi' ? 'Trạng Thái' : 'Status'}</Th>
              <Th className="text-right">{lang === 'vi' ? 'Hành Động' : 'Actions'}</Th>
            </tr>
          </Thead>
          <Tbody>
            {filteredReturns.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-stone-400 text-sm">
                  {lang === 'vi'
                    ? 'Không có hồ sơ trả kho nào trong danh mục này.'
                    : 'No return requests found matching the current filter.'}
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
                          {lang === 'vi' ? 'Yêu cầu:' : 'Req:'} {ret.requestedAt.slice(0, 10)}
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
                            {lang === 'vi' ? `Khấu trừ: -${formatVnd(totalDeductions)}` : `Deduction: -${formatVnd(totalDeductions)}`}
                          </p>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div className="text-xs">
                        <p className="text-stone-500">
                          {lang === 'vi' ? 'Cọc:' : 'Deposit:'} <span className="font-mono">{formatVnd(ret.depositAmount)}</span>
                        </p>
                        {ret.amountDueFromCustomer && ret.amountDueFromCustomer > 0 ? (
                          <p className="font-bold text-rose-600">
                            {lang === 'vi' ? `Khách nộp thêm: ${formatVnd(ret.amountDueFromCustomer ?? 0)}` : `Due: ${formatVnd(ret.amountDueFromCustomer ?? 0)}`}
                          </p>
                        ) : (
                          <p className="font-bold text-emerald-700">
                            {lang === 'vi' ? `Hoàn lại: ${formatVnd(ret.netRefundAmount)}` : `Refund: ${formatVnd(ret.netRefundAmount)}`}
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
                          {lang === 'vi' ? 'Chi tiết' : 'Details'}
                        </Button>

                        {ret.status === 'disputed' && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
                            onClick={() => {
                              setSelectedReturn(ret)
                              setDisputeResolutionNote(ret.staffNotes || '')
                              setDisputeModalOpen(true)
                            }}
                          >
                            {lang === 'vi' ? 'Xử lý khiếu nại' : 'Resolve Dispute'}
                          </Button>
                        )}

                        {ret.status === 'refund_pending' && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                            onClick={() => {
                              setSelectedReturn(ret)
                              setRefundTxnRef(`REF-TXN-${Date.now().toString().slice(-6)}`)
                              setRefundModalOpen(true)
                            }}
                          >
                            {lang === 'vi' ? 'Hoàn cọc' : 'Refund'}
                          </Button>
                        )}
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
        title={lang === 'vi' ? 'Chi Tiết Hồ Sơ Trả Kho & Nghiệm Thu' : 'Return Dossier & Move-Out Inspection'}
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
                    {lang === 'vi' ? `Gian Kho ${selectedReturn.unitId}` : `Unit ${selectedReturn.unitId}`}
                  </p>
                  <p className="text-xs text-slate-400">
                    {selectedReturn.customerName} · {selectedReturn.customerPhone}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{lang === 'vi' ? 'Trạng thái' : 'Status'}</p>
                  {sb(selectedReturn.status)}
                </div>
              </div>
            </div>

            {/* Inspection & Fees Breakdown Bento Box */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-stone-50 p-3.5 rounded-lg border border-stone-200">
              <div>
                <span className="text-stone-400 block">{lang === 'vi' ? 'Mức độ hư hại' : 'Damage Level'}</span>
                <span className="font-semibold text-stone-800 text-sm">
                  {getDamageLabel(selectedReturn.damageClassification)}
                </span>
              </div>
              <div>
                <span className="text-stone-400 block">{lang === 'vi' ? 'Khớp danh mục đồ gửi' : 'Inventory Match'}</span>
                <span className="font-semibold text-stone-800 text-sm capitalize">
                  {selectedReturn.inventoryMatch || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-stone-400 block">{lang === 'vi' ? 'Ngày nghiệm thu' : 'Inspected At'}</span>
                <span className="font-medium text-stone-700">
                  {selectedReturn.inspectedAt ? selectedReturn.inspectedAt.slice(0, 16).replace('T', ' ') : 'Chưa nghiệm thu'}
                </span>
              </div>
              <div>
                <span className="text-stone-400 block">{lang === 'vi' ? 'Vật tư bàn giao lại' : 'Returned Items'}</span>
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
                {lang === 'vi' ? 'Chi Tiết Quyết Toán Tài Chính' : 'Financial Settlement Breakdown'}
              </p>
              <div className="flex justify-between py-0.5">
                <span className="text-stone-500">{lang === 'vi' ? 'Tiền đặt cọc ban đầu' : 'Initial Security Deposit'}</span>
                <span className="font-mono font-semibold text-stone-800">{formatVnd(selectedReturn.depositAmount)}</span>
              </div>
              {selectedReturn.damageFee > 0 && (
                <div className="flex justify-between py-0.5 text-red-600">
                  <span>{lang === 'vi' ? 'Phí sửa chữa hư hại' : 'Damage Repair Fee'}</span>
                  <span className="font-mono">-{formatVnd(selectedReturn.damageFee)}</span>
                </div>
              )}
              {selectedReturn.cleaningFee && selectedReturn.cleaningFee > 0 && (
                <div className="flex justify-between py-0.5 text-red-600">
                  <span>{lang === 'vi' ? 'Phí vệ sinh kho' : 'Cleaning Fee'}</span>
                  <span className="font-mono">-{formatVnd(selectedReturn.cleaningFee)}</span>
                </div>
              )}
              {selectedReturn.overdueFee && selectedReturn.overdueFee > 0 && (
                <div className="flex justify-between py-0.5 text-red-600">
                  <span>{lang === 'vi' ? `Phí phạt trễ hạn (${selectedReturn.overdueDays || 0} ngày)` : `Overdue Fee (${selectedReturn.overdueDays || 0}d)`}</span>
                  <span className="font-mono">-{formatVnd(selectedReturn.overdueFee)}</span>
                </div>
              )}
              {selectedReturn.outstandingFee && selectedReturn.outstandingFee > 0 && (
                <div className="flex justify-between py-0.5 text-red-600">
                  <span>{lang === 'vi' ? 'Cước thuê còn nợ' : 'Outstanding Rent'}</span>
                  <span className="font-mono">-{formatVnd(selectedReturn.outstandingFee)}</span>
                </div>
              )}
              <div className="pt-2 border-t flex justify-between font-bold text-sm">
                <span>{lang === 'vi' ? 'Thực hoàn lại cho khách' : 'Net Deposit Refund'}</span>
                <span className={selectedReturn.netRefundAmount > 0 ? 'text-emerald-700 font-mono' : 'text-stone-600 font-mono'}>
                  {formatVnd(selectedReturn.netRefundAmount)}
                </span>
              </div>
              {selectedReturn.amountDueFromCustomer && selectedReturn.amountDueFromCustomer > 0 && (
                <div className="flex justify-between font-bold text-sm text-rose-600 pt-1">
                  <span>{lang === 'vi' ? 'Khách còn phải nộp thêm' : 'Additional Amount Due'}</span>
                  <span className="font-mono">{formatVnd(selectedReturn.amountDueFromCustomer ?? 0)}</span>
                </div>
              )}
            </div>

            {/* Staff / Customer Notes */}
            {selectedReturn.staffNotes && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs">
                <span className="font-semibold text-amber-900 block mb-1">{lang === 'vi' ? 'Ghi chú nghiệp vụ' : 'Operational Notes'}</span>
                <p className="text-amber-800">{selectedReturn.staffNotes}</p>
              </div>
            )}

            {selectedReturn.customerDecisionNote && (
              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-lg text-xs">
                <span className="font-semibold text-rose-900 block mb-1">
                  {lang === 'vi' ? 'Lý do khiếu nại của khách hàng' : 'Customer Dispute Argument'}
                </span>
                <p className="text-rose-800">{selectedReturn.customerDecisionNote}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setDetailModalOpen(false)}>
                {lang === 'vi' ? 'Đóng' : 'Close'}
              </Button>
              {selectedReturn.status === 'disputed' && (
                <Button
                  variant="primary"
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  onClick={() => {
                    setDetailModalOpen(false)
                    setDisputeResolutionNote(selectedReturn.staffNotes || '')
                    setDisputeModalOpen(true)
                  }}
                >
                  {lang === 'vi' ? 'Xử lý khiếu nại' : 'Resolve Dispute'}
                </Button>
              )}
              {selectedReturn.status === 'refund_pending' && (
                <Button
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    setDetailModalOpen(false)
                    setRefundTxnRef(`REF-TXN-${Date.now().toString().slice(-6)}`)
                    setRefundModalOpen(true)
                  }}
                >
                  {lang === 'vi' ? 'Hoàn cọc ngay' : 'Process Refund'}
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
        title={lang === 'vi' ? 'Phân Xử & Giải Quyết Khiếu Nại Quyết Toán' : 'Review & Adjudicate Dispute'}
      >
        {selectedReturn && (
          <div className="space-y-4">
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-xs space-y-1.5">
              <p className="font-bold text-rose-900 text-sm">
                {lang === 'vi' ? `Khiếu nại từ khách: ${selectedReturn.customerName}` : `Dispute by ${selectedReturn.customerName}`}
              </p>
              <p className="text-rose-800 font-mono">
                {lang === 'vi' ? `Kho ${selectedReturn.unitId} · Hồ sơ ${selectedReturn.id}` : `Unit ${selectedReturn.unitId} · Case ${selectedReturn.id}`}
              </p>
              <div className="mt-2 pt-2 border-t border-rose-200/80">
                <p className="text-stone-500">{lang === 'vi' ? 'Ý kiến phản ánh của khách:' : 'Customer dispute note:'}</p>
                <p className="font-medium text-rose-950 mt-0.5">
                  "{selectedReturn.customerDecisionNote || (lang === 'vi' ? 'Không đồng ý với phí khấu trừ nghiệm thu kho.' : 'Disagrees with move-out inspection fee deductions.')}"
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700">
                {lang === 'vi' ? 'Kết luận phân xử của Facility Manager' : 'Manager Resolution Decision & Notes'}
              </label>
              <textarea
                rows={4}
                value={disputeResolutionNote}
                onChange={e => setDisputeResolutionNote(e.target.value)}
                placeholder={
                  lang === 'vi'
                    ? 'Nhập căn cứ xử lý (ví dụ: Đã đối chiếu ảnh hiện trạng camera ngày vào và ra; chấp thuận giảm 50% phí vệ sinh...)'
                    : 'Enter adjudication rationale and adjusted fee resolution...'
                }
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t">
              <Button variant="outline" onClick={() => setDisputeModalOpen(false)}>
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </Button>
              <Button
                variant="primary"
                className="bg-rose-600 hover:bg-rose-700 text-white"
                onClick={handleReviewDispute}
              >
                {lang === 'vi' ? 'Gửi kết luận cho khách' : 'Submit Adjudication'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Complete Refund Modal */}
      <Modal
        open={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        title={lang === 'vi' ? 'Xác Nhận Hoàn Tiền Cọc Cho Khách' : 'Execute Deposit Refund'}
      >
        {selectedReturn && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-emerald-800">{lang === 'vi' ? 'Khách thụ hưởng' : 'Beneficiary'}</span>
                <span className="font-bold text-emerald-950 text-sm">{selectedReturn.customerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-emerald-800">{lang === 'vi' ? 'Mã gian kho thanh lý' : 'Move-out Unit'}</span>
                <span className="font-mono font-bold text-emerald-950">{selectedReturn.unitId}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-emerald-200 text-sm">
                <span className="font-bold text-emerald-900">{lang === 'vi' ? 'Số tiền hoàn cọc' : 'Refund Amount'}</span>
                <span className="font-mono font-extrabold text-emerald-700 text-lg">{formatVnd(selectedReturn.netRefundAmount)}</span>
              </div>
            </div>

            <Input
              label={lang === 'vi' ? 'Mã chứng từ / Tham chiếu chuyển khoản ngân hàng' : 'Bank Transfer Reference'}
              value={refundTxnRef}
              onChange={e => setRefundTxnRef(e.target.value)}
              placeholder="e.g. VCB-REF-849204"
            />

            <div className="flex gap-2 justify-end pt-3 border-t">
              <Button variant="outline" onClick={() => setRefundModalOpen(false)}>
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </Button>
              <Button
                variant="primary"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleCompleteRefund}
              >
                {lang === 'vi' ? 'Xác nhận hoàn cọc' : 'Confirm Refund'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
