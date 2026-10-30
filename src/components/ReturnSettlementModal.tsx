import { useState } from 'react'
import { Badge, Button, Card, Modal, Table, Thead, Tbody, Th, Td, Tr } from './ui'
import { formatVnd as legacyMoney } from '../i18n/currency'
import type { ApiReturn } from '../services/returnApi'
import { EvidenceDownload } from '../views/rental-support-integration/EvidenceControls'
import type { ReturnCase, StoragePayment } from '../types/storageHub'

export interface ReturnSettlementModalProps {
  open: boolean
  onClose: () => void
  returnCase: ReturnCase | null | undefined
  payments?: StoragePayment[]
  role?: 'manager' | 'staff' | 'customer'
  apiRecord?: ApiReturn
}

export default function ReturnSettlementModal({
  open,
  onClose,
  returnCase,
  payments = [],
  role = 'manager',
  apiRecord,
}: ReturnSettlementModalProps) {
  const [activeTab, setActiveTab] = useState<'invoice' | 'receipt' | 'history'>('invoice')

  if (!returnCase) return null
  const formatVnd = (value: number) => Number.isFinite(value) ? legacyMoney(value) : 'Chưa xác định'

  const isCompleted = returnCase.status === 'completed'
  const isRefundPending = returnCase.status === 'refund_pending'
  const isPaymentDue = returnCase.status === 'payment_due'
  const netRefund = apiRecord ? apiRecord.netRefundAmount == null ? Number.NaN : apiRecord.netRefundAmount : returnCase.netRefundAmount || 0
  const amountDue = apiRecord ? apiRecord.amountDueFromCustomer == null ? Number.NaN : apiRecord.amountDueFromCustomer : returnCase.amountDueFromCustomer || 0
  const deposit = apiRecord ? apiRecord.depositAmount == null ? Number.NaN : apiRecord.depositAmount : returnCase.depositAmount || 0
  const damageFee = returnCase.damageFee || 0
  const cleaningFee = returnCase.cleaningFee || 0
  const overdueFee = returnCase.overdueFee || 0
  const lostItemFee = returnCase.lostItemFee || 0
  const outstandingFee = returnCase.outstandingFee || 0
  const totalDeductions = apiRecord ? apiRecord.totalDeductions : damageFee + cleaningFee + overdueFee + lostItemFee + outstandingFee

  // Lọc các giao dịch liên quan đến hồ sơ thuê này
  const relatedPayments = apiRecord ? [] : payments.filter(p => p.rentalId === returnCase.rentalId)
  const receipt = apiRecord?.settlementReceipt
  const balancedKnown = Number.isFinite(netRefund) && Number.isFinite(amountDue)
  const recorded = isCompleted && (!apiRecord || !!receipt)
  const receiptMethod = receipt?.paymentMethod === 'CASH' ? 'Tiền mặt' : receipt?.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : receipt?.paymentMethod === 'DEPOSIT_OFFSET' ? 'Đối trừ cọc' : 'Chưa ghi nhận'

  // Ngày lập chứng từ
  const docDate = returnCase.completedAt 
    ? new Date(returnCase.completedAt).toLocaleDateString('vi-VN')
    : returnCase.inspectedAt
    ? new Date(returnCase.inspectedAt).toLocaleDateString('vi-VN')
    : returnCase.scheduledDate || new Date().toLocaleDateString('vi-VN')

  const handlePrint = () => {
    window.print()
  }

  return (
    <Modal open={open} onClose={onClose} title="Hồ Sơ Quyết Toán & Biên Lai Trả Kho" size="lg">
      <div className="space-y-4">
        {/* Header tóm tắt */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-stone-900">{returnCase.id}</span>
              <span className="text-stone-400">·</span>
              <span className="text-xs text-stone-500">Gian kho: <b className="text-stone-800">{returnCase.unitId}</b></span>
              <span className="text-stone-400">·</span>
              <span className="text-xs text-stone-500">Hợp đồng: <b className="font-mono text-stone-800">{returnCase.rentalId}</b></span>
            </div>
            <p className="mt-1 text-xs text-stone-600">
              Khách hàng: <b>{returnCase.customerName}</b> {returnCase.customerPhone ? `(${returnCase.customerPhone})` : ''}
            </p>
          </div>
          <div className="text-right">
            {netRefund > 0 ? (
              <Badge variant={isCompleted ? 'success' : isRefundPending ? 'purple' : 'warning'}>
                {isCompleted ? (role === 'customer' ? 'Đã hoàn cọc' : '✓ Đã hoàn cọc') : 'Chờ hoàn cọc'}
              </Badge>
            ) : amountDue > 0 ? (
              <Badge variant={isCompleted ? 'success' : isPaymentDue ? 'error' : 'warning'}>
                {isCompleted ? (role === 'customer' ? 'Đã thu đủ' : '✓ Đã thu đủ') : 'Chờ nộp thêm'}
              </Badge>
            ) : (
              <Badge variant="muted">{balancedKnown ? 'Quyết toán cân bằng' : 'Chưa đủ dữ liệu quyết toán'}</Badge>
            )}
            <p className="mt-1 text-[11px] text-stone-500">Cơ sở: {returnCase.facilityName || 'StorageHub'}</p>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-stone-200 text-sm">
          <button
            type="button"
            className={`border-b-2 px-4 py-2 font-medium transition-colors ${
              activeTab === 'invoice'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
            onClick={() => setActiveTab('invoice')}
          >
            {role !== 'customer' && '🧾 '}{apiRecord ? "Bảng kê quyết toán" : "Hóa đơn quyết toán"}
          </button>
          <button
            type="button"
            className={`border-b-2 px-4 py-2 font-medium transition-colors ${
              activeTab === 'receipt'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
            onClick={() => setActiveTab('receipt')}
          >
            {role !== 'customer' && '📑 '}Biên lai & Chứng từ
          </button>
          <button
            type="button"
            className={`border-b-2 px-4 py-2 font-medium transition-colors ${
              activeTab === 'history'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
            onClick={() => setActiveTab('history')}
          >
            {role !== 'customer' && '📜 '}Lịch sử thanh toán
          </button>
        </div>

        {/* TAB 1: HÓA ĐƠN QUYẾT TOÁN */}
        {activeTab === 'invoice' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between border-b border-stone-200 pb-4">
                <div>
                  <h4 className="text-lg font-bold uppercase tracking-wider text-stone-900">
                    BẢNG TÍNH QUYẾT TOÁN TRẢ KHO
                  </h4>
                  <p className="mt-0.5 font-mono text-xs text-stone-500">Mã: {apiRecord ? returnCase.id : `INV-SETTLE-${returnCase.id}`}</p>
                </div>
                <div className="text-right text-xs text-stone-500">
                  <p>Ngày lập: <b>{docDate}</b></p>
                  <p className="mt-0.5">Hệ thống: StorageHub Self-Storage</p>
                </div>
              </div>

              {/* Bảng kê chiết tính */}
              <div className="mt-4">
                <Table>
                  <Thead>
                    <tr>
                      <Th>Khoản mục</Th>
                      <Th>Ghi chú đối soát</Th>
                      <Th className="text-right">Số tiền</Th>
                    </tr>
                  </Thead>
                  <Tbody>
                    <Tr>
                      <Td className="font-semibold text-stone-800">
                        1. Tiền đặt cọc ban đầu (Deposit)
                      </Td>
                      <Td className="text-xs text-stone-500">
                        Tiền đảm bảo thực hiện hợp đồng đã ghi nhận lúc nhận kho
                      </Td>
                      <Td className="text-right font-bold text-stone-900">
                        +{formatVnd(deposit)}
                      </Td>
                    </Tr>
                    {apiRecord?.setupEarlyExit && <>
                      <Tr><Td className="font-semibold">Tiền thuê thực thu được quyết toán</Td><Td className="text-xs text-stone-500">Theo bảng kê backend</Td><Td className="text-right font-bold">{apiRecord.rentalRefundCredit == null ? 'Chưa xác định' : formatVnd(apiRecord.rentalRefundCredit)}</Td></Tr>
                      {role !== 'customer' && <Tr><Td className="font-semibold">Phí chấm dứt sớm một lần</Td><Td className="text-xs text-stone-500">Theo điều khoản đã chấp nhận</Td><Td className="text-right font-bold">{apiRecord.earlyTerminationFee == null ? 'Chưa xác định' : formatVnd(apiRecord.earlyTerminationFee)}</Td></Tr>}
                    </>}
                    {damageFee > 0 && (
                      <Tr>
                        <Td className="font-semibold text-rose-700">
                          2. Khấu trừ hư hại hiện trường
                        </Td>
                        <Td className="text-xs text-stone-500">
                          {returnCase.damageClassification || 'Hư hại vật chất'} {returnCase.staffNotes ? `(${returnCase.staffNotes})` : ''}
                        </Td>
                        <Td className="text-right font-bold text-rose-700">
                          -{formatVnd(damageFee)}
                        </Td>
                      </Tr>
                    )}
                    {cleaningFee > 0 && (
                      <Tr>
                        <Td className="font-semibold text-rose-700">
                          3. Phí vệ sinh & thu gom rác
                        </Td>
                        <Td className="text-xs text-stone-500">
                          Chi phí dọn dẹp gian kho sau bàn giao
                        </Td>
                        <Td className="text-right font-bold text-rose-700">
                          -{formatVnd(cleaningFee)}
                        </Td>
                      </Tr>
                    )}
                    {overdueFee > 0 && (
                      <Tr>
                        <Td className="font-semibold text-rose-700">
                          4. Phí quá hạn trả kho
                        </Td>
                        <Td className="text-xs text-stone-500">
                          Quá hạn {returnCase.overdueDays || 0} ngày so với hợp đồng
                        </Td>
                        <Td className="text-right font-bold text-rose-700">
                          -{formatVnd(overdueFee)}
                        </Td>
                      </Tr>
                    )}
                    {lostItemFee > 0 && (
                      <Tr>
                        <Td className="font-semibold text-rose-700">
                          5. Phí làm mất chìa / thẻ / khóa
                        </Td>
                        <Td className="text-xs text-stone-500">
                          Chi phí cấp lại phụ kiện mở kho
                        </Td>
                        <Td className="text-right font-bold text-rose-700">
                          -{formatVnd(lostItemFee)}
                        </Td>
                      </Tr>
                    )}
                    {outstandingFee > 0 && (
                      <Tr>
                        <Td className="font-semibold text-rose-700">
                          6. Tiền thuê còn tồn đọng
                        </Td>
                        <Td className="text-xs text-stone-500">
                          Tiền thuê các kỳ chưa thanh toán
                        </Td>
                        <Td className="text-right font-bold text-rose-700">
                          -{formatVnd(outstandingFee)}
                        </Td>
                      </Tr>
                    )}
                    {totalDeductions === 0 && (
                      <Tr>
                        <Td colSpan={2} className="text-xs italic text-emerald-700">
                          {role !== 'customer' && '✓ '}Không phát sinh khoản giảm trừ. Khách hàng bàn giao gian kho nguyên vẹn, đúng hạn.
                        </Td>
                        <Td className="text-right text-xs font-semibold text-emerald-700">
                          0 ₫
                        </Td>
                      </Tr>
                    )}
                  </Tbody>
                </Table>
              </div>

              {/* Tổng kết dòng tiền */}
              <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-stone-500">Tổng các khoản khấu trừ:</p>
                    <p className="font-mono font-semibold text-stone-700">{formatVnd(totalDeductions)}</p>
                  </div>
                  <div className="text-right">
                    {netRefund > 0 ? (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                          SỐ TIỀN HOÀN TRẢ KHÁCH HÀNG:
                        </p>
                        <p className="text-2xl font-black text-emerald-700">{formatVnd(netRefund)}</p>
                      </>
                    ) : amountDue > 0 ? (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">
                          SỐ TIỀN KHÁCH HÀNG CẦN NỘP THÊM:
                        </p>
                        <p className="text-2xl font-black text-rose-700">{formatVnd(amountDue)}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
                          KẾT QUẢ QUYẾT TOÁN:
                        </p>
                        <p className="text-xl font-bold text-stone-800">{balancedKnown ? 'Cân bằng (0 ₫)' : 'Chưa xác định'}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BIÊN LAI & CHỨNG TỪ */}
        {activeTab === 'receipt' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between border-b border-stone-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    {role !== 'customer' && <span className="text-xl">🧾</span>}
                    <h4 className="text-lg font-bold text-stone-900">
                      {netRefund > 0
                        ? 'BIÊN LAI HOÀN CỌC TRẢ KHO'
                        : amountDue > 0
                        ? 'BIÊN LAI THU BỔ SUNG TRẢ KHO'
                        : 'BIÊN NHẬN ĐỐI SOÁT TẤT TOÁN'}
                    </h4>
                  </div>
                  <p className="mt-1 font-mono text-xs text-stone-500">
                    Số phiếu: {apiRecord ? receipt?.transactionReference || "Chưa có chứng từ thực thu/hoàn" : `RCP-${returnCase.id}`}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={recorded ? 'success' : 'warning'}>
                    {recorded ? 'ĐÃ ĐỐI SOÁT XÁC NHẬN' : 'CHỜ XÁC NHẬN NGHIỆP VỤ'}
                  </Badge>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 text-sm">
                <div className="space-y-2">
                  <p className="text-xs text-stone-500">Người nộp / thụ hưởng:</p>
                  <p className="font-bold text-stone-900">{returnCase.customerName}</p>
                  <p className="text-xs text-stone-600">Gian kho đối soát: <b className="font-mono">{returnCase.unitId}</b></p>
                  <p className="text-xs text-stone-600">Mã hồ sơ thuê: <b className="font-mono">{returnCase.rentalId}</b></p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-stone-500">Chi tiết thanh toán:</p>
                  <p className="text-xs">
                    Phương thức: <b>{apiRecord ? receiptMethod : "Chuyển khoản liên ngân hàng (VietQR / Napas)"}</b>
                  </p>
                  <p className="text-xs">
                    Mã đối chiếu GD: <b className="font-mono text-stone-800">{apiRecord ? receipt?.transactionReference || "Chưa ghi nhận" : returnCase.settlementPaymentId || returnCase.refundTransaction?.id || `TXN-${returnCase.id}`}</b>
                  </p>
                  <p className="text-xs">
                    Thời gian giao dịch: <b>{apiRecord ? receipt?.recordedAt ? new Date(receipt.recordedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Chưa ghi nhận" : docDate}</b>
                  </p>
                  {apiRecord && receipt?.receiptFileId && <EvidenceDownload id={receipt.receiptFileId} label="Tải biên lai" previewLabel="Xem biên lai" />}
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-stone-600">Số tiền chứng từ:</p>
                    <p className="text-xl font-black text-stone-900">
                      {apiRecord ? receipt ? formatVnd(receipt.amount) : "Chưa có chứng từ" : formatVnd(netRefund > 0 ? netRefund : amountDue > 0 ? amountDue : deposit)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded border border-emerald-600 bg-emerald-50 px-3 py-1 font-mono text-xs font-bold text-emerald-800">
                      {apiRecord ? receipt ? 'ĐÃ GHI NHẬN CHỨNG TỪ' : 'CHƯA CÓ CHỨNG TỪ' : 'ĐÃ KIỂM TRA CHỨNG TỪ'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Con dấu điện tử minh họa */}
              <div className="mt-6 flex justify-between border-t border-stone-100 pt-4 text-xs text-stone-500">
                <div>
                  <p className="font-semibold text-stone-700">Đại diện khách hàng</p>
                  <p className="mt-6 font-medium text-stone-800">{returnCase.customerName}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-stone-700">Đại diện StorageHub</p>
                  <p className="mt-1 font-mono text-[11px] text-emerald-700">{apiRecord ? "Chứng từ theo hồ sơ backend" : "ĐÃ KÝ ĐIỆN TỬ"}</p>
                  <p className="mt-3 font-medium text-stone-800">{returnCase.facilityName || 'Quản lý cơ sở'}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={handlePrint}>
                {role !== 'customer' && '🖨️ '}In biên lai / Lưu PDF
              </Button>
            </div>
          </div>
        )}

        {/* TAB 3: LỊCH SỬ THANH TOÁN */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <h4 className="font-bold text-stone-900">Lịch Sử Giao Dịch Thuê & Quyết Toán</h4>
              <p className="text-xs text-stone-500">
                Toàn bộ dòng tiền phát sinh xuyên suốt vòng đời hợp đồng {returnCase.rentalId}
              </p>

              <div className="mt-3">
                <Table>
                  <Thead>
                    <tr>
                      <Th>Thời gian</Th>
                      <Th>Khoản mục</Th>
                      <Th>Mã tham chiếu</Th>
                      <Th>Phương thức</Th>
                      <Th className="text-right">Số tiền</Th>
                      <Th>Trạng thái</Th>
                    </tr>
                  </Thead>
                  <Tbody>
                    {/* Giao dịch cọc ban đầu */}
                    {!apiRecord && <Tr>
                      <Td className="text-xs text-stone-500">{docDate}</Td>
                      <Td className="font-semibold text-stone-800">Cọc đảm bảo hợp đồng</Td>
                      <Td className="font-mono text-xs text-stone-500">DEP-{returnCase.rentalId}</Td>
                      <Td className="text-xs">{apiRecord ? receiptMethod : 'Chuyển khoản'}</Td>
                      <Td className="text-right font-semibold text-stone-800">+{formatVnd(deposit)}</Td>
                      <Td><Badge variant="success">Đã thanh toán</Badge></Td>
                    </Tr>}

                    {/* Các khoản thanh toán trong kỳ nếu có */}
                    {relatedPayments.map(p => (
                      <Tr key={p.id}>
                        <Td className="text-xs text-stone-500">{p.paidAt || p.receivedAt || docDate}</Td>
                        <Td className="font-semibold text-stone-800">
                          {p.type === 'RENT' ? 'Tiền thuê định kỳ' : p.type === 'DAMAGE_FEE' ? 'Phí phát sinh' : p.type}
                        </Td>
                        <Td className="font-mono text-xs text-stone-500">{p.transactionReference || p.id}</Td>
                        <Td className="text-xs">{p.paymentMethod || 'Chuyển khoản'}</Td>
                        <Td className="text-right font-semibold text-stone-800">{formatVnd(p.amount)}</Td>
                        <Td><Badge variant={p.status === 'PAID' ? 'success' : 'warning'}>{p.status}</Badge></Td>
                      </Tr>
                    ))}

                    {/* Giao dịch quyết toán trả kho */}
                    <Tr>
                      <Td className="text-xs text-stone-500">{docDate}</Td>
                      <Td className="font-semibold text-stone-800">
                        {netRefund > 0 ? 'Hoàn cọc tất toán trả kho' : amountDue > 0 ? 'Thu bổ sung quyết toán' : 'Tất toán hợp đồng'}
                      </Td>
                      <Td className="font-mono text-xs text-stone-500">
                        {apiRecord ? receipt?.transactionReference || "Chưa ghi nhận" : returnCase.settlementPaymentId || `SETTLE-${returnCase.id}`}
                      </Td>
                      <Td className="text-xs">{apiRecord ? receiptMethod : 'Chuyển khoản'}</Td>
                      <Td className={`text-right font-bold ${netRefund > 0 ? 'text-emerald-700' : amountDue > 0 ? 'text-rose-700' : 'text-stone-800'}`}>
                        {apiRecord ? receipt ? formatVnd(receipt.amount) : 'Chưa ghi nhận' : netRefund > 0 ? `-${formatVnd(netRefund)}` : amountDue > 0 ? `+${formatVnd(amountDue)}` : '0 ₫'}
                      </Td>
                      <Td>
                        <Badge variant={isCompleted ? 'success' : 'warning'}>
                          {recorded ? 'Hoàn tất' : 'Chưa có chứng từ xác nhận'}
                        </Badge>
                      </Td>
                    </Tr>
                  </Tbody>
                </Table>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-stone-200 pt-3">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  )
}
