import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Modal, Select, Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui'
import { formatVnd } from '../../i18n/currency'
import { isApiAuthenticated } from '../../services/authApi'
import {
  feeKeys,
  getReturn,
  listReturns,
  reviewDispute,
  returnError,
  type ApiReturn,
  type ReturnFees,
} from '../../services/returnApi'
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'
import type { ReturnCase } from '../../types/storageHub'

interface Props {
  user: User
}

const statusLabels: Record<string, string> = {
  requested: 'Đã yêu cầu trả kho',
  scheduled: 'Đã hẹn nghiệm thu',
  inspected: 'Đã nghiệm thu',
  awaiting_customer_confirmation: 'Chờ khách xác nhận',
  disputed: 'Đang khiếu nại',
  payment_due: 'Chờ thanh toán',
  refund_pending: 'Chờ hoàn cọc',
  completed: 'Đã hoàn tất',
  cancelled: 'Đã hủy yêu cầu',
}

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case 'disputed':
      return 'error'
    case 'refund_pending':
      return 'purple'
    case 'completed':
      return 'success'
    case 'awaiting_customer_confirmation':
    case 'payment_due':
    case 'requested':
      return 'warning'
    default:
      return 'info'
  }
}

export default function BusinessReturnsPanel({ user }: Props) {
  const hub = useStorageHub()
  const useApi = isApiAuthenticated()

  // API State
  const [apiRows, setApiRows] = useState<ApiReturn[]>([])
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Filter State
  const [statusFilter, setStatusFilter] = useState('all')
  const [facilityFilter, setFacilityFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal State
  const [selectedItem, setSelectedItem] = useState<{
    id: string
    unitNumber: string
    facilityName: string
    customerName: string
    scheduledDate: string
    status: string
    depositAmount: number
    totalDeductions: number
    netRefundAmount: number
    amountDueFromCustomer: number
    damageFee: number
    cleaningFee: number
    lostItemFee: number
    overdueFee: number
    outstandingFee: number
    inspectionNotes?: string | null
    managerResolutionNote?: string | null
    evidencePhotos?: string[]
    customerDecisionNote?: string
    proposedUnitStatus?: 'available' | 'maintenance' | null
  } | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')

  // Dispute form state
  const [resolutionNote, setResolutionNote] = useState('')
  const [proposedUnit, setProposedUnit] = useState<'available' | 'maintenance'>('available')
  const [reviewFees, setReviewFees] = useState<ReturnFees>({
    damageFee: 0,
    cleaningFee: 0,
    lostItemFee: 0,
    overdueFee: 0,
    outstandingFee: 0,
  })

  // Load from API if authenticated
  const loadApiData = async () => {
    if (!useApi) return
    setApiLoading(true)
    setApiError(null)
    try {
      const res = await listReturns('manager', page, 20)
      setApiRows(res.data)
      setTotalPages(res.pagination.totalPages || 1)
    } catch (err) {
      setApiError(returnError(err))
    } finally {
      setApiLoading(false)
    }
  }

  useEffect(() => {
    if (useApi) {
      void loadApiData()
    }
  }, [useApi, page])

  // Facilities list for dropdown
  const facilityNames = useMemo(() => {
    const set = new Set<string>()
    if (useApi) {
      apiRows.forEach((r) => r.facilityName && set.add(r.facilityName))
    } else {
      hub.returns.forEach((r) => r.facilityName && set.add(r.facilityName))
      hub.facilities.forEach((f) => f.name && set.add(f.name))
    }
    return Array.from(set)
  }, [useApi, apiRows, hub.returns, hub.facilities])

  // Normalized items list
  const displayItems = useMemo(() => {
    if (useApi) {
      return apiRows.map((r) => ({
        id: r.id,
        unitNumber: r.unitNumber,
        facilityName: r.facilityName,
        customerName: r.customerName,
        scheduledDate: r.scheduledDate,
        status: r.status,
        depositAmount: r.depositAmount ?? 0,
        totalDeductions: r.totalDeductions,
        netRefundAmount: r.netRefundAmount ?? 0,
        amountDueFromCustomer: r.amountDueFromCustomer ?? 0,
        damageFee: r.damageFee,
        cleaningFee: r.cleaningFee,
        lostItemFee: r.lostItemFee,
        overdueFee: r.overdueFee,
        outstandingFee: r.outstandingFee,
        inspectionNotes: r.inspectionNotes,
        managerResolutionNote: r.managerResolutionNote,
        evidencePhotos: r.evidencePhotos,
        proposedUnitStatus: r.proposedUnitStatus,
      }))
    }

    return hub.returns.map((r: ReturnCase) => ({
      id: r.id,
      unitNumber: r.unitId,
      facilityName: r.facilityName,
      customerName: r.customerName,
      scheduledDate: r.scheduledDate,
      status: r.status,
      depositAmount: r.depositAmount || 0,
      totalDeductions: (r.damageFee || 0) + (r.cleaningFee || 0) + (r.lostItemFee || 0) + (r.overdueFee || 0) + (r.outstandingFee || 0),
      netRefundAmount: r.netRefundAmount || 0,
      amountDueFromCustomer: r.amountDueFromCustomer || 0,
      damageFee: r.damageFee || 0,
      cleaningFee: r.cleaningFee || 0,
      lostItemFee: r.lostItemFee || 0,
      overdueFee: r.overdueFee || 0,
      outstandingFee: r.outstandingFee || 0,
      inspectionNotes: r.staffNotes,
      managerResolutionNote: r.customerDecisionNote,
      evidencePhotos: r.evidence,
      customerDecisionNote: r.customerDecisionNote,
      proposedUnitStatus: r.proposedUnitStatus,
    }))
  }, [useApi, apiRows, hub.returns])

  // Filtered rows
  const filteredItems = useMemo(() => {
    return displayItems.filter((item) => {
      const matchStatus = statusFilter === 'all' || item.status === statusFilter
      const matchFacility = facilityFilter === 'all' || item.facilityName === facilityFilter
      const matchQuery =
        !searchQuery.trim() ||
        item.unitNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase())
      return matchStatus && matchFacility && matchQuery
    })
  }, [displayItems, statusFilter, facilityFilter, searchQuery])

  // Quick stats
  const totalCount = displayItems.length
  const disputedCount = displayItems.filter((i) => i.status === 'disputed').length
  const refundPendingCount = displayItems.filter((i) => i.status === 'refund_pending').length
  const completedCount = displayItems.filter((i) => i.status === 'completed').length

  const handleOpenDetail = (item: (typeof displayItems)[0]) => {
    setSelectedItem(item)
    setReviewFees({
      damageFee: item.damageFee,
      cleaningFee: item.cleaningFee,
      lostItemFee: item.lostItemFee,
      overdueFee: item.overdueFee,
      outstandingFee: item.outstandingFee,
    })
    setProposedUnit(item.proposedUnitStatus || 'available')
    setResolutionNote(item.managerResolutionNote || '')
    setFeedback('')
    setModalOpen(true)
  }

  const handleReviewDispute = async () => {
    if (!selectedItem) return
    if (!resolutionNote.trim()) {
      setFeedback('Vui lòng nhập ghi chú kết luận thẩm định khiếu nại.')
      return
    }

    setSubmitting(true)
    setFeedback('')

    try {
      if (useApi) {
        await reviewDispute(selectedItem.id, {
          damageFee: reviewFees.damageFee,
          cleaningFee: reviewFees.cleaningFee,
          lostItemFee: reviewFees.lostItemFee,
          overdueFee: reviewFees.overdueFee,
          outstandingFee: reviewFees.outstandingFee,
          resolutionNote: resolutionNote.trim(),
          proposedUnitStatus: proposedUnit,
        })
        await loadApiData()
      } else {
        hub.reviewReturnDispute(
          selectedItem.id,
          user,
          resolutionNote.trim(),
          reviewFees,
          'mutual_settlement',
        )
      }
      setFeedback('Đã hoàn tất thẩm định khiếu nại trả kho thành công.')
      setTimeout(() => {
        setModalOpen(false)
      }, 1000)
    } catch (err) {
      setFeedback(returnError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── THỐNG KÊ NHANH (STATS OVERVIEW - ZERO ICONS) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-[#cfcdc1]">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Tổng số hồ sơ</p>
          <p className="mt-1 text-2xl font-bold text-stone-900">{totalCount}</p>
          <p className="text-xs text-stone-400 mt-1">Toàn bộ chi nhánh hệ thống</p>
        </Card>

        <Card className="p-4 bg-amber-50/50 border border-amber-200">
          <p className="text-xs font-medium text-amber-700 uppercase tracking-wider">Khiếu nại cần xử lý</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">{disputedCount}</p>
          <p className="text-xs text-amber-600 mt-1">Hồ sơ khách yêu cầu xem xét lại</p>
        </Card>

        <Card className="p-4 bg-purple-50/50 border border-purple-200">
          <p className="text-xs font-medium text-purple-700 uppercase tracking-wider">Chờ hoàn tiền cọc</p>
          <p className="mt-1 text-2xl font-bold text-purple-900">{refundPendingCount}</p>
          <p className="text-xs text-purple-600 mt-1">Đã chốt quyết toán, chờ giải ngân</p>
        </Card>

        <Card className="p-4 bg-emerald-50/50 border border-emerald-200">
          <p className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Đã hoàn tất</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{completedCount}</p>
          <p className="text-xs text-emerald-600 mt-1">Đã đóng hồ sơ và trả mặt bằng</p>
        </Card>
      </div>

      {/* ── BỘ LỌC VÀ TÌM KIẾM (TOOLBAR) ── */}
      <Card className="p-4 space-y-4 bg-white border border-[#cfcdc1]">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="flex flex-1 flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder="Tìm theo gian kho, tên khách hàng, mã hồ sơ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 border border-[#cfcdc1] rounded-lg text-sm bg-white min-w-[260px] flex-1 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-[#cfcdc1] rounded-lg text-sm bg-white focus:outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="disputed">Đang khiếu nại (Cần BO)</option>
              <option value="refund_pending">Chờ hoàn cọc</option>
              <option value="payment_due">Chờ thanh toán</option>
              <option value="awaiting_customer_confirmation">Chờ khách xác nhận</option>
              <option value="inspected">Đã nghiệm thu</option>
              <option value="scheduled">Đã hẹn nghiệm thu</option>
              <option value="requested">Đã yêu cầu</option>
              <option value="completed">Đã hoàn tất</option>
            </select>

            <select
              value={facilityFilter}
              onChange={(e) => setFacilityFilter(e.target.value)}
              className="px-3 py-2 border border-[#cfcdc1] rounded-lg text-sm bg-white focus:outline-none"
            >
              <option value="all">Tất cả cơ sở</option>
              {facilityNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 items-center">
            {useApi && (
              <Button
                variant="outline"
                size="sm"
                disabled={apiLoading}
                onClick={() => void loadApiData()}
              >
                Tải lại máy chủ
              </Button>
            )}
            <span className="text-xs text-stone-500 whitespace-nowrap">
              {filteredItems.length} hồ sơ hiển thị
            </span>
          </div>
        </div>

        {apiLoading && <p className="text-sm text-stone-500">Đang tải dữ liệu từ máy chủ...</p>}
        {apiError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{apiError}</p>}
      </Card>

      {/* ── BẢNG DANH SÁCH HỒ SƠ TRẢ KHO ── */}
      <Card className="overflow-hidden border border-[#cfcdc1] bg-white">
        <div className="overflow-x-auto">
          <Table>
            <Thead>
              <Tr>
                <Th>Gian Kho & Cơ Sở</Th>
                <Th>Khách Hàng</Th>
                <Th>Ngày Hẹn Trả</Th>
                <Th>Tiền Cọc</Th>
                <Th>Khấu Trừ</Th>
                <Th>Quyết Toán</Th>
                <Th>Trạng Thái</Th>
                <Th className="text-right">Thao Tác</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredItems.length === 0 ? (
                <Tr>
                  <Td colSpan={8} className="text-center py-8 text-stone-500">
                    Không tìm thấy hồ sơ trả kho nào phù hợp với bộ lọc hiện tại.
                  </Td>
                </Tr>
              ) : (
                filteredItems.map((item) => (
                  <Tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                    <Td>
                      <p className="font-semibold text-stone-900">{item.unitNumber}</p>
                      <p className="text-xs text-stone-500">{item.facilityName}</p>
                    </Td>
                    <Td>
                      <p className="font-medium text-stone-800">{item.customerName}</p>
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-xs text-stone-600">
                      {item.scheduledDate}
                    </Td>
                    <Td className="whitespace-nowrap font-medium text-stone-700">
                      {formatVnd(item.depositAmount)}
                    </Td>
                    <Td className="whitespace-nowrap text-stone-600">
                      {item.totalDeductions > 0 ? (
                        <span className="text-red-600 font-medium">-{formatVnd(item.totalDeductions)}</span>
                      ) : (
                        '0 ₫'
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {item.netRefundAmount > 0 ? (
                        <span className="text-emerald-700 font-semibold">
                          Hoàn: {formatVnd(item.netRefundAmount)}
                        </span>
                      ) : item.amountDueFromCustomer > 0 ? (
                        <span className="text-amber-700 font-semibold">
                          Thu thêm: {formatVnd(item.amountDueFromCustomer)}
                        </span>
                      ) : (
                        <span className="text-stone-500">Cân bằng</span>
                      )}
                    </Td>
                    <Td>
                      <Badge variant={statusBadgeVariant(item.status)}>
                        {statusLabels[item.status] || item.status}
                      </Badge>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <Button
                        variant={item.status === 'disputed' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => handleOpenDetail(item)}
                      >
                        {item.status === 'disputed' ? 'Thẩm định' : 'Chi tiết'}
                      </Button>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </div>

        {/* Phân trang khi dùng API */}
        {useApi && totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-[#deddd2]">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || apiLoading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Trang trước
            </Button>
            <span className="text-xs text-stone-600">
              Trang {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages || apiLoading}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Trang sau
            </Button>
          </div>
        )}
      </Card>

      {/* ── MODAL CHI TIẾT & THẨM ĐỊNH KHIẾU NẠI (DISPUTE RESOLUTION) ── */}
      {modalOpen && selectedItem && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Hồ sơ trả kho: ${selectedItem.unitNumber} (${selectedItem.facilityName})`}
        >
          <div className="space-y-5 text-sm">
            {/* Tóm tắt thông tin */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-stone-50 rounded-lg border border-[#deddd2]">
              <div>
                <p className="text-xs text-stone-500">Khách hàng</p>
                <p className="font-semibold text-stone-900">{selectedItem.customerName}</p>
              </div>
              <div>
                <p className="text-xs text-stone-500">Ngày hẹn trả kho</p>
                <p className="font-semibold text-stone-900">{selectedItem.scheduledDate}</p>
              </div>
              <div>
                <p className="text-xs text-stone-500">Trạng thái hồ sơ</p>
                <Badge variant={statusBadgeVariant(selectedItem.status)}>
                  {statusLabels[selectedItem.status] || selectedItem.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-stone-500">Tiền cọc ban đầu</p>
                <p className="font-semibold text-stone-900">{formatVnd(selectedItem.depositAmount)}</p>
              </div>
            </div>

            {/* Bảng chi tiết khấu trừ tài chính */}
            <div>
              <p className="font-semibold text-stone-900 mb-2">Quyết toán tài chính</p>
              <div className="border border-[#deddd2] rounded-lg overflow-hidden">
                <div className="flex justify-between p-2.5 border-b border-[#deddd2] bg-stone-50 font-medium">
                  <span>Khoản mục</span>
                  <span>Số tiền</span>
                </div>
                <div className="flex justify-between p-2 border-b border-[#deddd2]">
                  <span>Cọc bảo đảm ban đầu</span>
                  <span className="font-medium">{formatVnd(selectedItem.depositAmount)}</span>
                </div>
                <div className="flex justify-between p-2 border-b border-[#deddd2] text-stone-600">
                  <span>Phí hư hại gian kho</span>
                  <span className="text-red-600">-{formatVnd(selectedItem.damageFee)}</span>
                </div>
                <div className="flex justify-between p-2 border-b border-[#deddd2] text-stone-600">
                  <span>Phí vệ sinh kho</span>
                  <span className="text-red-600">-{formatVnd(selectedItem.cleaningFee)}</span>
                </div>
                <div className="flex justify-between p-2 border-b border-[#deddd2] text-stone-600">
                  <span>Phí mất khóa / thẻ / tài sản</span>
                  <span className="text-red-600">-{formatVnd(selectedItem.lostItemFee)}</span>
                </div>
                <div className="flex justify-between p-2 border-b border-[#deddd2] text-stone-600">
                  <span>Phí trễ hạn trả</span>
                  <span className="text-red-600">-{formatVnd(selectedItem.overdueFee)}</span>
                </div>
                <div className="flex justify-between p-2 border-b border-[#deddd2] text-stone-600">
                  <span>Tiền nợ kỳ trước</span>
                  <span className="text-red-600">-{formatVnd(selectedItem.outstandingFee)}</span>
                </div>
                <div className="flex justify-between p-2.5 bg-amber-50/50 font-semibold">
                  <span>Kết quả quyết toán</span>
                  {selectedItem.netRefundAmount > 0 ? (
                    <span className="text-emerald-700">Hoàn cọc: {formatVnd(selectedItem.netRefundAmount)}</span>
                  ) : selectedItem.amountDueFromCustomer > 0 ? (
                    <span className="text-amber-800">Khách đóng thêm: {formatVnd(selectedItem.amountDueFromCustomer)}</span>
                  ) : (
                    <span className="text-stone-700">0 ₫</span>
                  )}
                </div>
              </div>
            </div>

            {/* Ghi chú hiện trường & Khiếu nại */}
            {selectedItem.inspectionNotes && (
              <div>
                <p className="font-semibold text-stone-900 mb-1">Ghi chú nghiệm thu của nhân viên:</p>
                <p className="p-2.5 bg-stone-50 rounded border border-[#deddd2] text-stone-700">
                  {selectedItem.inspectionNotes}
                </p>
              </div>
            )}

            {selectedItem.customerDecisionNote && (
              <div>
                <p className="font-semibold text-amber-800 mb-1">Ý kiến khiếu nại của khách hàng:</p>
                <p className="p-2.5 bg-amber-50 rounded border border-amber-200 text-amber-900">
                  {selectedItem.customerDecisionNote}
                </p>
              </div>
            )}

            {/* Bằng chứng nghiệm thu */}
            {selectedItem.evidencePhotos && selectedItem.evidencePhotos.length > 0 && (
              <div>
                <p className="font-semibold text-stone-900 mb-1">
                  Tài liệu / Bằng chứng nghiệm thu ({selectedItem.evidencePhotos.length} tệp):
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.evidencePhotos.map((photo, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-stone-100 rounded border border-stone-200 text-xs font-mono text-stone-700"
                    >
                      Bằng chứng #{idx + 1}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── FORM THẨM ĐỊNH KHIẾU NẠI CHO BAN ĐIỀU HÀNH (KHI STATUS = DISPUTED) ── */}
            {selectedItem.status === 'disputed' && (
              <div className="p-4 bg-amber-50/60 rounded-lg border border-amber-300 space-y-4">
                <p className="font-bold text-amber-950 text-base">
                  Thẩm định & Quyết định giải quyết khiếu nại (Ban Điều Hành)
                </p>
                <p className="text-xs text-amber-800">
                  Ban Điều Hành xem xét lại biên bản hiện trường và ý kiến khách hàng để điều chỉnh lại các khoản khấu trừ nếu hợp lý.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {feeKeys.map((k, idx) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        {['Phí hư hại', 'Phí vệ sinh', 'Phí mất chìa/khóa', 'Phí trễ hạn', 'Tiền nợ cũ'][idx]} (₫)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={reviewFees[k]}
                        onChange={(e) =>
                          setReviewFees((prev) => ({
                            ...prev,
                            [k]: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        className="w-full px-2.5 py-1.5 border border-[#cfcdc1] rounded bg-white text-sm"
                      />
                    </div>
                  ))}

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Đề xuất hiện trạng kho sau thu hồi
                    </label>
                    <select
                      value={proposedUnit}
                      onChange={(e) => setProposedUnit(e.target.value as 'available' | 'maintenance')}
                      className="w-full px-2.5 py-1.5 border border-[#cfcdc1] rounded bg-white text-sm"
                    >
                      <option value="available">Sẵn sàng cho thuê tiếp</option>
                      <option value="maintenance">Cần bảo trì / sửa chữa</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Kết luận giải quyết khiếu nại của Ban Điều Hành (*)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ghi rõ lý do miễn giảm hoặc giữ nguyên các khoản phí để thông báo đến khách hàng và cơ sở..."
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    className="w-full p-2.5 border border-[#cfcdc1] rounded bg-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {feedback && (
                  <p
                    className={`text-sm p-2 rounded ${feedback.includes('thành công')
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                  >
                    {feedback}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                    Hủy bỏ
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={submitting || !resolutionNote.trim()}
                    onClick={handleReviewDispute}
                  >
                    {submitting ? 'Đang lưu...' : 'Xác nhận kết quả thẩm định'}
                  </Button>
                </div>
              </div>
            )}

            {selectedItem.status !== 'disputed' && (
              <div className="flex justify-end pt-3">
                <Button variant="outline" onClick={() => setModalOpen(false)}>
                  Đóng
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
