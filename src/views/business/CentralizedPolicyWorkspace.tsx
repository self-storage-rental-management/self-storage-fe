import { useState, useEffect } from 'react'
import {
  getActiveCentralizedPolicyApi,
  getDraftCentralizedPolicyApi,
  updateDraftCentralizedPolicyApi,
  previewCentralizedPolicyDiffApi,
  publishCentralizedPolicyApi,
  rollbackCentralizedPolicyApi,
  listCentralizedPolicyHistoryApi,
  type CentralizedPolicyApi,
  type PolicyDiffItemApi,
} from '../../services/centralizedPolicyApi'
import { formatVnd } from '../../i18n/currency'
import { Card, Badge, Button, Modal } from '../../components/ui'
import type { User } from '../../types'
import { isApiAuthenticated } from '../../services/authApi'

interface Props {
  user?: User
  lang?: string
  initialPolicy?: CentralizedPolicyApi
  initialLoading?: boolean
}

export const DEFAULT_MOCK_POLICY: CentralizedPolicyApi = {
  id: 'demo-policy-1',
  policyVersion: 'POL-2026.1',
  publicationStatus: 'PUBLISHED',
  runtimeStatus: 'ACTIVE',
  publishedAt: '2026-03-01T08:00:00Z',
  publishedById: 'user-bo',
  publishedByName: 'Giám Đốc Thương Mại',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  active: true,
  changeSummary: 'Quy chuẩn chính sách quản trị tập trung StorageHub toàn quốc.',
  depositMandatory: true,
  depositCalculationMethod: 'MONTHLY_RENT_MULTIPLE',
  depositMonthlyMultiple: 1.0,
  depositFixedAmount: 2000000,
  depositPercentageRate: 0.2,
  minimumDepositAmount: 500000,
  fullRefundConditions: 'Hoàn lại 100% tiền cọc khi trả kho đúng hạn, bàn giao nguyên trạng, trả đủ chìa khóa và thẻ từ.',
  partialRefundConditions: 'Khấu trừ một phần tiền cọc cho hư hại, phí dịch vụ hoặc quá hạn. Phần còn lại được hoàn lại trong 7 ngày.',
  noRefundConditions: 'Tự ý bỏ kho quá thời hạn tối đa hoặc vi phạm nghiêm trọng quy chuẩn an toàn kho.',
  refundProcessingDays: 7,
  allowEarlyRenewal: true,
  availableExtensionPeriods: [1, 3, 6, 12, 24],
  renewalAdvanceNoticeDays: 15,
  requireStorageAvailabilityCheck: true,
  renewalDiscountRate: 0.05,
  allowEarlyTermination: true,
  earlyTerminationNoticeDays: 14,
  earlyTerminationFeeCoefficient: 1.0,
  earlyTerminationFeeCapMonths: 1,
  earlyTerminationMinFee: 500000,
  gracePeriodDays: 0,
  latePenaltyCalculationMethod: 'FIXED_DAILY_AMOUNT',
  lateFeeAmount: 50000,
  lateFeePercentageRate: 0.005,
  maxOverdueGraceDaysBeforeRepossession: 7,
  deductionCategories: '[{"code":"UNPAID_RENT","name":"Tiền thuê quá hạn"},{"code":"CUSTOMER_DAMAGE","name":"Hư hại cơ sở vật chất"}]',
  requireEvidenceForDeduction: true,
  requireManagerApprovalForDeduction: true,
  excludeNormalWearAndTear: true,
  pricingProtectionEnforced: true,
  pricingVersion: 'PRICE-2026.1',
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T08:00:00Z',
}

export default function CentralizedPolicyWorkspace({ user, lang = 'vi', initialPolicy, initialLoading }: Props) {
  const [activePolicy, setActivePolicy] = useState<CentralizedPolicyApi | null>(initialPolicy ?? DEFAULT_MOCK_POLICY)
  const [draftPolicy, setDraftPolicy] = useState<CentralizedPolicyApi | null>(initialPolicy ?? DEFAULT_MOCK_POLICY)
  const [historyList, setHistoryList] = useState<CentralizedPolicyApi[]>(initialPolicy ? [initialPolicy] : [DEFAULT_MOCK_POLICY])
  const [loading, setLoading] = useState<boolean>(initialLoading ?? false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editSection, setEditSection] = useState<'deposit' | 'contract' | 'payment' | 'pricing'>('deposit')
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [diffModalOpen, setDiffModalOpen] = useState(false)
  const [diffItems, setDiffItems] = useState<PolicyDiffItemApi[]>([])
  const [diffLoading, setDiffLoading] = useState(false)
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [publishEffectiveFrom, setPublishEffectiveFrom] = useState(initialPolicy?.effectiveFrom || '2026-01-01')
  const [publishEffectiveTo, setPublishEffectiveTo] = useState(initialPolicy?.effectiveTo || '')
  const [publishChangeSummary, setPublishChangeSummary] = useState(initialPolicy?.changeSummary || '')

  // Rollback confirmation
  const [rollbackTarget, setRollbackTarget] = useState<CentralizedPolicyApi | null>(null)

  // Form state for draft editing
  const [formData, setFormData] = useState<Partial<CentralizedPolicyApi>>(initialPolicy ?? DEFAULT_MOCK_POLICY)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      if (isApiAuthenticated()) {
        const [active, draft, history] = await Promise.all([
          getActiveCentralizedPolicyApi().catch(() => null),
          getDraftCentralizedPolicyApi().catch(() => null),
          listCentralizedPolicyHistoryApi().catch(() => []),
        ])
        setActivePolicy(active)
        setDraftPolicy(draft)
        setHistoryList(history)
        if (draft) {
          setFormData(draft)
          setPublishEffectiveFrom(draft.effectiveFrom || new Date().toISOString().split('T')[0])
          setPublishEffectiveTo(draft.effectiveTo || '')
          setPublishChangeSummary(draft.changeSummary || '')
        } else if (active) {
          setFormData(active)
          setPublishEffectiveFrom(new Date().toISOString().split('T')[0])
          setPublishEffectiveTo('')
          setPublishChangeSummary('')
        }
      } else {
        setActivePolicy(DEFAULT_MOCK_POLICY)
        setDraftPolicy(DEFAULT_MOCK_POLICY)
        setFormData(DEFAULT_MOCK_POLICY)
        setHistoryList([DEFAULT_MOCK_POLICY])
        setPublishEffectiveFrom('2026-01-01')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải chính sách tập trung.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isApiAuthenticated()) {
      void loadData()
    }
  }, [])

  const handleFieldChange = (field: keyof CentralizedPolicyApi, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      if (isApiAuthenticated()) {
        const updated = await updateDraftCentralizedPolicyApi(formData)
        setDraftPolicy(updated)
        setFormData(updated)
      } else {
        setDraftPolicy({ ...DEFAULT_MOCK_POLICY, ...formData })
      }
      setSuccess('Đã lưu bản nháp chính sách thành công!')
      setEditModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu bản nháp.')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenPreviewDiff = async () => {
    setDiffLoading(true)
    setDiffModalOpen(true)
    setError(null)
    try {
      if (isApiAuthenticated()) {
        const diffs = await previewCentralizedPolicyDiffApi()
        setDiffItems(diffs)
      } else {
        // Local diff mock
        setDiffItems([
          {
            fieldKey: 'depositCalculationMethod',
            fieldLabel: 'Phương thức tính tiền cọc',
            oldValue: activePolicy?.depositCalculationMethod || 'MONTHLY_RENT_MULTIPLE',
            newValue: formData.depositCalculationMethod || 'MONTHLY_RENT_MULTIPLE',
            changed: activePolicy?.depositCalculationMethod !== formData.depositCalculationMethod,
            category: 'DEPOSIT',
          },
          {
            fieldKey: 'depositMonthlyMultiple',
            fieldLabel: 'Bội số tiền thuê tháng',
            oldValue: String(activePolicy?.depositMonthlyMultiple || 1.0),
            newValue: String(formData.depositMonthlyMultiple || 1.0),
            changed: activePolicy?.depositMonthlyMultiple !== formData.depositMonthlyMultiple,
            category: 'DEPOSIT',
          },
          {
            fieldKey: 'gracePeriodDays',
            fieldLabel: 'Số ngày ân hạn thanh toán',
            oldValue: `${activePolicy?.gracePeriodDays ?? 0} ngày`,
            newValue: `${formData.gracePeriodDays ?? 0} ngày`,
            changed: activePolicy?.gracePeriodDays !== formData.gracePeriodDays,
            category: 'PAYMENT',
          },
          {
            fieldKey: 'lateFeeAmount',
            fieldLabel: 'Mức phạt trễ hạn cố định (VND/ngày)',
            oldValue: formatVnd(activePolicy?.lateFeeAmount || 50000),
            newValue: formatVnd(formData.lateFeeAmount || 50000),
            changed: activePolicy?.lateFeeAmount !== formData.lateFeeAmount,
            category: 'PAYMENT',
          },
        ])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lấy thông tin so sánh thay đổi.')
    } finally {
      setDiffLoading(false)
    }
  }

  const handleConfirmPublish = async () => {
    setPublishing(true)
    setError(null)
    setSuccess(null)
    try {
      if (isApiAuthenticated()) {
        const published = await publishCentralizedPolicyApi(undefined, {
          effectiveFrom: publishEffectiveFrom,
          effectiveTo: publishEffectiveTo || undefined,
          changeSummary: publishChangeSummary,
        })
        setActivePolicy(published)
        setDraftPolicy(published)
        setFormData(published)
      } else {
        const nextVersion = `POL-2026.${(historyList.length || 1) + 1}`
        const updated: CentralizedPolicyApi = {
          ...DEFAULT_MOCK_POLICY,
          ...formData,
          policyVersion: nextVersion,
          publicationStatus: 'PUBLISHED',
          runtimeStatus: 'ACTIVE',
          publishedAt: new Date().toISOString(),
          effectiveFrom: publishEffectiveFrom,
          effectiveTo: publishEffectiveTo || null,
          changeSummary: publishChangeSummary || 'Ban hành bản cập nhật chính sách mới',
        }
        setActivePolicy(updated)
        setDraftPolicy(updated)
        setHistoryList((prev) => [updated, ...prev])
      }
      setPublishModalOpen(false)
      setDiffModalOpen(false)
      setSuccess(`Đã ban hành thành công chính sách mới có hiệu lực từ ${publishEffectiveFrom}! Toàn bộ cơ sở đã áp dụng.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi ban hành chính sách.')
    } finally {
      setPublishing(false)
    }
  }

  const handleRollback = async () => {
    if (!rollbackTarget) return
    setLoading(true)
    setError(null)
    try {
      if (isApiAuthenticated()) {
        const rolledBack = await rollbackCentralizedPolicyApi(rollbackTarget.policyVersion)
        setActivePolicy(rolledBack)
        setDraftPolicy(rolledBack)
        setFormData(rolledBack)
        setSuccess(`Đã khôi phục thành công cấu hình về phiên bản ${rollbackTarget.policyVersion}!`)
      } else {
        setActivePolicy(rollbackTarget)
        setDraftPolicy(rollbackTarget)
        setFormData(rollbackTarget)
        setSuccess(`Đã khôi phục cấu hình từ phiên bản ${rollbackTarget.policyVersion}!`)
      }
      setRollbackTarget(null)
      setHistoryModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể khôi phục phiên bản chính sách.')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !activePolicy) {
    return (
      <div className="p-8 text-center text-sm text-stone-500">
        <span className="inline-block animate-spin mr-2">⏳</span> Đang tải chính sách vận hành tập trung...
      </div>
    )
  }

  return (
    <div className="space-y-6 fade-in pb-12">
      {/* ── HEADER BANNER ── */}
      <div className="bg-gradient-to-r from-amber-950 via-stone-900 to-amber-900 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-200 border border-amber-300/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                Quản Trị Chính Sách Tập Trung (Centralized BO Governance)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Phiên bản hiệu lực: {activePolicy?.policyVersion || 'POL-2026.1'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white uppercase">
              QUY ĐỊNH & CHÍNH SÁCH VẬN HÀNH TOÀN HỆ THỐNG
            </h1>
            <p className="text-stone-300 text-sm leading-relaxed">
              Mô-đun quản trị tập trung toàn bộ 9 chính sách cốt lõi của StorageHub. BO ban hành quy chuẩn chung - Toàn bộ cơ sở và khách hàng tự động áp dụng đồng bộ, bảo vệ quyền lợi hợp đồng đang chạy.
            </p>
          </div>
        </div>
      </div>

      {/* FEEDBACK NOTICES */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold">Lỗi:</span>
            <span>{error}</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setError(null)}>
            Đóng
          </Button>
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm text-emerald-900 font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-emerald-700 font-bold">✓ Thành công:</span>
            <span>{success}</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setSuccess(null)}>
            Đóng
          </Button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TỔNG QUAN CHÍNH SÁCH VẬN HÀNH DUY NHẤT (UNIFIED POLICY VIEW)   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="space-y-6 fade-in">
        {/* Active Version Snapshot Card */}
        <Card className="p-6 border border-stone-200 bg-gradient-to-br from-white via-stone-50/50 to-amber-50/30 shadow-sm">
          <div className="border-b border-stone-200/70 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="success">ĐANG ÁP DỤNG TOÀN HỆ THỐNG</Badge>
                <span className="text-xs text-stone-500 font-medium">
                  Có hiệu lực từ ngày: <b>{activePolicy?.effectiveFrom || '01/01/2026'}</b>
                  {activePolicy?.effectiveTo ? ` đến ${activePolicy.effectiveTo}` : ' (Vô thời hạn)'}
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-stone-900">
                Phiên Bản Chính Sách Vận Hành Hiện Tại: {activePolicy?.policyVersion || 'POL-2026.1'}
              </h2>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                {activePolicy?.changeSummary || 'Chính sách vận hành chuẩn hóa điều khoản đặt cọc, thanh toán, gia hạn và bồi hoàn của StorageHub.'}
              </p>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* 9 MANDATORY RULES STATUS LIST (DÀN DANH SÁCH DỌC)          */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4 border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  Danh Sách 9 Quy Tắc Vận Hành Bắt Buộc (Centralized 9 Rules)
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Bộ quy chuẩn vận hành trung ương bắt buộc thực thi thống nhất trên toàn mạng lưới cơ sở StorageHub
                </p>
              </div>
              <Badge variant="success">9/9 Đang Áp Dụng Đồng Bộ</Badge>
            </div>

            <div className="space-y-3.5">
              {/* QUY TẮC 1 */}
              <div className="p-4 rounded-xl border border-stone-200 bg-white hover:border-emerald-300 hover:shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">
                    01
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-emerald-800 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                        QUY TẮC 1
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">Tiền Cọc Đảm Bảo Thuê</h4>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed max-w-3xl">
                      Tiền cọc là điều kiện bắt buộc đối với mọi hợp đồng thuê kho trước khi xác nhận hoặc bàn giao. Tuyệt đối không hợp đồng nào được phép kích hoạt khi chưa hoàn tất tiền cọc.
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Áp dụng 100% hợp đồng</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Thanh toán trước bàn giao</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Khóa tính năng bỏ qua cọc</span>
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-stone-100">
                  <Badge variant="success">Bắt buộc 100%</Badge>
                  <span className="text-[11px] font-mono text-emerald-800 mt-1 font-semibold">Tất cả cơ sở</span>
                </div>
              </div>

              {/* QUY TẮC 2 */}
              <div className="p-4 rounded-xl border border-stone-200 bg-white hover:border-blue-300 hover:shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 flex items-center justify-center font-bold text-sm shrink-0">
                    02
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-blue-800 px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
                        QUY TẮC 2
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">Công Thức Tính Tiền Cọc</h4>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed max-w-3xl">
                      Phương thức tính toán tiền cọc rõ ràng, nhất quán và minh bạch với khách hàng. Hỗ trợ bội số tiền thuê tháng, số tiền cố định hoặc tỷ lệ %, kèm mức sàn tối thiểu để bảo vệ doanh thu.
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">
                        Phương thức: {activePolicy?.depositCalculationMethod === 'MONTHLY_RENT_MULTIPLE'
                          ? 'Bội số tháng thuê'
                          : activePolicy?.depositCalculationMethod === 'FIXED_AMOUNT'
                            ? 'Số tiền cố định'
                            : 'Tỷ lệ % giá trị kho'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">
                        Mức sàn tối thiểu: {formatVnd(activePolicy?.minimumDepositAmount || 500000)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-stone-100">
                  <span className="text-sm font-mono font-bold text-blue-700">
                    {activePolicy?.depositCalculationMethod === 'MONTHLY_RENT_MULTIPLE'
                      ? `${activePolicy.depositMonthlyMultiple} tháng tiền thuê`
                      : activePolicy?.depositCalculationMethod === 'FIXED_AMOUNT'
                        ? formatVnd(activePolicy.depositFixedAmount)
                        : `${Math.round((activePolicy?.depositPercentageRate || 0.2) * 100)}% giá trị kho`}
                  </span>
                  <span className="text-[11px] text-stone-500 mt-0.5">Tiền cọc chuẩn</span>
                </div>
              </div>

              {/* QUY TẮC 3 */}
              <div className="p-4 rounded-xl border border-stone-200 bg-white hover:border-purple-300 hover:shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 flex items-center justify-center font-bold text-sm shrink-0">
                    03
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-purple-800 px-2 py-0.5 rounded bg-purple-50 border border-purple-200">
                        QUY TẮC 3
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">Điều Kiện Hoàn Tiền Cọc</h4>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed max-w-3xl">
                      Tiền cọc được hoàn trả minh bạch căn cứ vào hiện trạng bàn giao: hoàn 100% khi đúng hạn và nguyên vẹn; hoàn một phần sau khi khấu trừ chi phí hợp lệ; hoặc không hoàn cọc khi vi phạm nghiêm trọng.
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Hoàn 100% khi bàn giao nguyên trạng</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Khấu trừ công nợ minh bạch</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">SLA giải ngân chuẩn</span>
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-stone-100">
                  <Badge variant="purple">SLA {activePolicy?.refundProcessingDays || 7} ngày làm việc</Badge>
                  <span className="text-[11px] text-stone-500 mt-1">Quyết toán cọc</span>
                </div>
              </div>

              {/* QUY TẮC 4 */}
              <div className="p-4 rounded-xl border border-stone-200 bg-white hover:border-amber-300 hover:shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center font-bold text-sm shrink-0">
                    04
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-amber-800 px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                        QUY TẮC 4
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">Gia Hạn Hợp Đồng Sớm</h4>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed max-w-3xl">
                      Khách hàng được quyền gia hạn hợp đồng đang thuê. Hệ thống tự động kiểm tra tình trạng kho trống và không bị trùng lịch giữ chỗ kế tiếp trước khi chấp thuận gia hạn.
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Kỳ hạn: 1, 3, 6, 12, 24 tháng</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Kiểm tra kho trống tự động</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Chiết khấu theo kỳ hạn mới</span>
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-stone-100">
                  <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    Báo trước {activePolicy?.renewalAdvanceNoticeDays || 15} ngày
                  </span>
                  <span className="text-[11px] text-stone-500 mt-1">Gia hạn hợp đồng</span>
                </div>
              </div>

              {/* QUY TẮC 5 */}
              <div className="p-4 rounded-xl border border-stone-200 bg-white hover:border-rose-300 hover:shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-center font-bold text-sm shrink-0">
                    05
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-rose-800 px-2 py-0.5 rounded bg-rose-50 border border-rose-200">
                        QUY TẮC 5
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">Chấm Dứt Trước Hạn</h4>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed max-w-3xl">
                      Xử lý yêu cầu chấm dứt hợp đồng sớm minh bạch: quy định rõ số ngày báo trước, hoàn trả tiền thuê chưa sử dụng sau khi trừ phí phạt vi phạm kỳ hạn cam kết có mức trần.
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Thông báo trước tối thiểu 14 ngày</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Mức trần phí phạt: 1 tháng tiền thuê</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Không tịch thu toàn bộ cọc vô lý</span>
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-stone-100">
                  <span className="text-xs font-bold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                    Báo trước {activePolicy?.earlyTerminationNoticeDays || 14} ngày
                  </span>
                  <span className="text-[11px] text-stone-500 mt-1">Trần {activePolicy?.earlyTerminationFeeCapMonths || 1} tháng thuê</span>
                </div>
              </div>

              {/* QUY TẮC 6 */}
              <div className="p-4 rounded-xl border border-stone-200 bg-white hover:border-orange-300 hover:shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 flex items-center justify-center font-bold text-sm shrink-0">
                    06
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-orange-800 px-2 py-0.5 rounded bg-orange-50 border border-orange-200">
                        QUY TẮC 6
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">Phạt Thanh Toán Chậm</h4>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed max-w-3xl">
                      Phí quá hạn bắt đầu tính từ ngày quá hạn đầu tiên. Tuyệt đối kích hoạt nguyên tắc chống phạt trùng lặp trên cùng một khoản nợ.
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Tính từ ngày quá hạn đầu tiên</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Không có thời gian ân hạn</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Khóa tính năng phạt trùng lặp</span>
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-stone-100">
                  <span className="text-sm font-mono font-bold text-orange-800">
                    Tiền thuê tháng ÷ 30 × 1,5 / ngày
                  </span>
                  <span className="text-[11px] text-stone-500 mt-0.5">Từ ngày quá hạn đầu tiên</span>
                </div>
              </div>

              {/* QUY TẮC 7 */}
              <div className="p-4 rounded-xl border border-stone-200 bg-white hover:border-teal-300 hover:shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-bold text-sm shrink-0">
                    07
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-teal-800 px-2 py-0.5 rounded bg-teal-50 border border-teal-200">
                        QUY TẮC 7
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">Khấu Trừ Tiền Cọc</h4>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed max-w-3xl">
                      Khấu trừ các nghĩa vụ tồn đọng hợp lệ: nợ tiền thuê, dịch vụ phát sinh, hư hại vật chất, mất khóa/thẻ. Mọi khoản trừ bắt buộc có chứng từ và ảnh chụp nghiệm thu; nghiêm cấm trừ hao mòn tự nhiên.
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">5 danh mục cọc được phép trừ</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Bắt buộc hình ảnh & biên bản</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Nghiêm cấm trừ hao mòn tự nhiên</span>
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-stone-100">
                  <Badge variant="info">5 danh mục cọc</Badge>
                  <span className="text-[11px] text-stone-500 mt-1">Phê duyệt 2 cấp</span>
                </div>
              </div>

              {/* QUY TẮC 8 */}
              <div className="p-4 rounded-xl border border-stone-200 bg-white hover:border-indigo-300 hover:shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 flex items-center justify-center font-bold text-sm shrink-0">
                    08
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-indigo-800 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200">
                        QUY TẮC 8
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">Gia Hạn Trực Tuyến</h4>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed max-w-3xl">
                      Khách hàng được chủ động gia hạn hợp đồng trực tiếp trên cổng khách hàng. Giao diện Khách hàng và phân hệ BO dùng chung 100% dữ liệu chính sách tập trung theo thời gian thực.
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">cổng khách hàng tự phục vụ</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Dùng chung dữ liệu BO</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Tự động cập nhật hợp đồng</span>
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-stone-100">
                  <Badge variant="success">Cổng khách hàng</Badge>
                  <span className="text-[11px] text-stone-500 mt-1">Trực tuyến 24/7</span>
                </div>
              </div>

              {/* QUY TẮC 9 */}
              <div className="p-4 rounded-xl border border-stone-200 bg-white hover:border-amber-400 hover:shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center font-bold text-sm shrink-0">
                    09
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-amber-900 px-2 py-0.5 rounded bg-amber-100 border border-amber-300">
                        QUY TẮC 9
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">Bảo Vệ Biểu Giá Đang Chạy</h4>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed max-w-3xl">
                      Đơn giá đã ký trong hợp đồng đang hoạt động là bất khả xâm phạm và không được phép sửa đổi hồi tố. Khi cần thay đổi biểu giá, BO ban hành phiên bản giá mới áp dụng cho hợp đồng ký mới và đợt gia hạn sau.
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Bất khả xâm phạm hợp đồng cũ</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Phiên bản: {activePolicy?.pricingVersion || 'PRICE-2026.1'}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">Lưu vết lịch sử kiểm toán</span>
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-stone-100">
                  <Badge variant="warning">Bất khả xâm phạm</Badge>
                  <span className="text-[11px] font-mono text-amber-900 mt-1 font-semibold">{activePolicy?.pricingVersion || 'PRICE-2026.1'}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: CHỈNH SỬA THÔNG SỐ CHÍNH SÁCH BẢN THẢO (DRAFT)       */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {editModalOpen && (
        <Modal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title="Điều Chỉnh Bản Thảo Chính Sách Vận Hành (Draft Policy)"
          size="xl"
        >
          <div className="space-y-5 text-sm text-stone-700">
            {/* Section Selector inside Modal */}
            <div className="flex border-b border-stone-200 gap-1 pb-1">
              <button
                type="button"
                onClick={() => setEditSection('deposit')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t cursor-pointer ${
                  editSection === 'deposit' ? 'bg-amber-100 text-amber-900 border-b-2 border-amber-600' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                💰 Tiền Cọc & Khấu Trừ
              </button>
              <button
                type="button"
                onClick={() => setEditSection('contract')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t cursor-pointer ${
                  editSection === 'contract' ? 'bg-amber-100 text-amber-900 border-b-2 border-amber-600' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                📑 Gia Hạn & Chấm Dứt
              </button>
              <button
                type="button"
                onClick={() => setEditSection('payment')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t cursor-pointer ${
                  editSection === 'payment' ? 'bg-amber-100 text-amber-900 border-b-2 border-amber-600' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                ⏰ Thanh Toán & Phạt
              </button>
              <button
                type="button"
                onClick={() => setEditSection('pricing')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t cursor-pointer ${
                  editSection === 'pricing' ? 'bg-amber-100 text-amber-900 border-b-2 border-amber-600' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                🛡️ Biểu Giá & Khóa Giá
              </button>
            </div>

            {/* SECTION: DEPOSIT */}
            {editSection === 'deposit' && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-stone-900 text-xs block">Quy tắc 1: Bắt buộc đặt cọc cho mọi hợp đồng</span>
                    <span className="text-[11px] text-stone-600">Khách hàng bắt buộc nộp đủ tiền cọc mới được kích hoạt kho.</span>
                  </div>
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-amber-600 rounded"
                    checked={formData.depositMandatory !== false}
                    onChange={(e) => handleFieldChange('depositMandatory', e.target.checked)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Phương thức tính tiền cọc</label>
                    <select
                      className="w-full text-xs rounded border border-stone-300 p-2 outline-none focus:border-amber-600"
                      value={formData.depositCalculationMethod || 'MONTHLY_RENT_MULTIPLE'}
                      onChange={(e) => handleFieldChange('depositCalculationMethod', e.target.value)}
                    >
                      <option value="MONTHLY_RENT_MULTIPLE">Theo bội số tiền thuê tháng (Ví dụ: 1 tháng tiền thuê)</option>
                      <option value="FIXED_AMOUNT">Số tiền cố định (VNĐ)</option>
                      <option value="PERCENTAGE_OF_RENTAL_VALUE">Tỷ lệ % tổng giá trị hợp đồng</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {formData.depositCalculationMethod === 'FIXED_AMOUNT'
                        ? 'Số tiền cọc cố định (VNĐ)'
                        : formData.depositCalculationMethod === 'PERCENTAGE_OF_RENTAL_VALUE'
                          ? 'Tỷ lệ % giá trị kho (0.1 = 10%)'
                          : 'Hệ số tháng tiền thuê (VD: 1.0 = 1 tháng)'}
                    </label>
                    <input
                      type="number"
                      step={formData.depositCalculationMethod === 'FIXED_AMOUNT' ? 100000 : 0.1}
                      className="w-full text-xs font-mono font-bold rounded border border-stone-300 p-2 outline-none focus:border-amber-600"
                      value={
                        formData.depositCalculationMethod === 'FIXED_AMOUNT'
                          ? formData.depositFixedAmount ?? 2000000
                          : formData.depositCalculationMethod === 'PERCENTAGE_OF_RENTAL_VALUE'
                            ? formData.depositPercentageRate ?? 0.2
                            : formData.depositMonthlyMultiple ?? 1.0
                      }
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0
                        if (formData.depositCalculationMethod === 'FIXED_AMOUNT') {
                          handleFieldChange('depositFixedAmount', val)
                        } else if (formData.depositCalculationMethod === 'PERCENTAGE_OF_RENTAL_VALUE') {
                          handleFieldChange('depositPercentageRate', val)
                        } else {
                          handleFieldChange('depositMonthlyMultiple', val)
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Mức sàn tiền cọc tối thiểu (VNĐ)</label>
                    <input
                      type="number"
                      step={100000}
                      className="w-full text-xs font-mono font-bold rounded border border-stone-300 p-2 outline-none focus:border-amber-600"
                      value={formData.minimumDepositAmount ?? 500000}
                      onChange={(e) => handleFieldChange('minimumDepositAmount', Number(e.target.value) || 0)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">SLA thời gian hoàn tiền cọc (ngày)</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      className="w-full text-xs font-mono font-bold rounded border border-stone-300 p-2 outline-none focus:border-amber-600"
                      value={formData.refundProcessingDays ?? 7}
                      onChange={(e) => handleFieldChange('refundProcessingDays', Number(e.target.value) || 7)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-stone-700">Điều kiện hoàn 100% tiền cọc</label>
                  <input
                    type="text"
                    className="w-full text-xs rounded border border-stone-300 p-2 outline-none focus:border-amber-600"
                    value={formData.fullRefundConditions || ''}
                    onChange={(e) => handleFieldChange('fullRefundConditions', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* SECTION: CONTRACT */}
            {editSection === 'contract' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Số ngày báo trước khi gia hạn</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      className="w-full text-xs font-mono font-bold rounded border border-stone-300 p-2 outline-none focus:border-amber-600"
                      value={formData.renewalAdvanceNoticeDays ?? 15}
                      onChange={(e) => handleFieldChange('renewalAdvanceNoticeDays', Number(e.target.value) || 15)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Số ngày báo trước khi chấm dứt sớm</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      className="w-full text-xs font-mono font-bold rounded border border-stone-300 p-2 outline-none focus:border-amber-600"
                      value={formData.earlyTerminationNoticeDays ?? 14}
                      onChange={(e) => handleFieldChange('earlyTerminationNoticeDays', Number(e.target.value) || 14)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Mức trần phí chấm dứt sớm (số tháng thuê)</label>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      className="w-full text-xs font-mono font-bold rounded border border-stone-300 p-2 outline-none focus:border-amber-600"
                      value={formData.earlyTerminationFeeCapMonths ?? 1}
                      onChange={(e) => handleFieldChange('earlyTerminationFeeCapMonths', Number(e.target.value) || 1)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Phí phạt tối thiểu chấm dứt sớm (VNĐ)</label>
                    <input
                      type="number"
                      step={100000}
                      className="w-full text-xs font-mono font-bold rounded border border-stone-300 p-2 outline-none focus:border-amber-600"
                      value={formData.earlyTerminationMinFee ?? 500000}
                      onChange={(e) => handleFieldChange('earlyTerminationMinFee', Number(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-stone-200 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-stone-800">
                    <input
                      type="checkbox"
                      checked={formData.requireStorageAvailabilityCheck !== false}
                      onChange={(e) => handleFieldChange('requireStorageAvailabilityCheck', e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded"
                    />
                    Bắt buộc kiểm tra sức chứa khả dụng trước khi xác nhận gia hạn
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-stone-800">
                    <input
                      type="checkbox"
                      checked={formData.allowEarlyRenewal !== false}
                      onChange={(e) => handleFieldChange('allowEarlyRenewal', e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded"
                    />
                    Cho phép khách hàng thực hiện gia hạn trực tuyến trên cổng khách hàng
                  </label>
                </div>
              </div>
            )}

            {/* SECTION: PAYMENT */}
            {editSection === 'payment' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <p className="text-xs">Phí mỗi ngày = tiền thuê tháng ÷ 30 × 1,5, tính từ ngày quá hạn đầu tiên.</p>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Số ngày tối đa trước khi niêm phong kho</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      className="w-full text-xs font-mono font-bold rounded border border-stone-300 p-2 outline-none focus:border-amber-600"
                      value={formData.maxOverdueGraceDaysBeforeRepossession ?? 7}
                      onChange={(e) => handleFieldChange('maxOverdueGraceDaysBeforeRepossession', Number(e.target.value) || 7)}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-orange-200 bg-orange-50/40">
                  <span className="font-bold text-orange-950 text-xs block mb-1">Nguyên tắc chống phạt trùng lặp (Anti-duplicate penalty)</span>
                  <p className="text-[11px] text-stone-600">
                    Hệ thống tự động khóa tính năng phạt kép. Mỗi ngày nợ chỉ áp dụng đúng một mức phạt duy nhất theo chính sách đã ban hành.
                  </p>
                </div>
              </div>
            )}

            {/* SECTION: PRICING */}
            {editSection === 'pricing' && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-stone-900 text-xs block">Quy tắc 9: Bảo vệ biểu giá hợp đồng đang chạy</span>
                    <span className="text-[11px] text-stone-600">Không sửa đổi hồi tố đơn giá của hợp đồng đang hoạt động.</span>
                  </div>
                  <Badge variant="warning">Bất khả xâm phạm</Badge>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Mã phiên bản biểu giá (Pricing Version)</label>
                  <input
                    type="text"
                    className="w-full text-xs font-mono font-bold rounded border border-stone-300 p-2 outline-none focus:border-amber-600"
                    value={formData.pricingVersion || 'PRICE-2026.1'}
                    onChange={(e) => handleFieldChange('pricingVersion', e.target.value)}
                  />
                  <span className="text-[10px] text-stone-500">
                    Khi BO muốn áp dụng mức giá mới, vui lòng ban hành phiên bản biểu giá mới thay vì sửa đè lên hợp đồng cũ.
                  </span>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-stone-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditModalOpen(false)}>
                Hủy bỏ
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="bg-amber-700 hover:bg-amber-800 text-white font-bold cursor-pointer"
                onClick={handleSaveDraft}
                disabled={saving}
              >
                {saving ? 'Đang lưu...' : 'Lưu Bản Nháp'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: LỊCH SỬ BAN HÀNH & PHIÊN BẢN (HISTORY MODAL)         */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {historyModalOpen && (
        <Modal
          open={historyModalOpen}
          onClose={() => setHistoryModalOpen(false)}
          title="Lịch Sử Ban Hành & Quản Trị Phiên Bản Chính Sách"
          size="xl"
        >
          <div className="space-y-4 text-xs text-stone-700">
            <p className="text-stone-500">
              Danh sách toàn bộ các phiên bản chính sách đã ban hành trong lịch sử hệ thống StorageHub:
            </p>

            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 border-b border-stone-200 text-stone-700 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Phiên bản</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4">Hiệu lực</th>
                    <th className="py-3 px-4">Người ban hành</th>
                    <th className="py-3 px-4">Ngày ban hành</th>
                    <th className="py-3 px-4">Tóm tắt</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {historyList.map((item) => {
                    const isCurrent = item.id === activePolicy?.id || item.policyVersion === activePolicy?.policyVersion
                    return (
                      <tr key={item.id} className={isCurrent ? 'bg-amber-50/40' : 'hover:bg-stone-50'}>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{item.policyVersion}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.runtimeStatus === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {item.runtimeStatus === 'ACTIVE' ? 'Đang hiệu lực' : 'Đã lưu trữ'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium">
                          {item.effectiveFrom} {item.effectiveTo ? `→ ${item.effectiveTo}` : '→ Vô thời hạn'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-stone-800">{item.publishedByName || 'Ban Quản Trị'}</td>
                        <td className="py-3 px-4 font-mono text-stone-500">
                          {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('vi-VN') : '-'}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-stone-600" title={item.changeSummary || ''}>
                          {item.changeSummary || '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!isCurrent && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-[11px] py-1 px-2.5 cursor-pointer"
                              onClick={() => setRollbackTarget(item)}
                            >
                              Khôi phục
                            </Button>
                          )}
                          {isCurrent && <span className="text-emerald-700 font-bold text-xs">Hiện hành</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setHistoryModalOpen(false)}>
                Đóng
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: PREVIEW DIFF (SO SÁNH THAY ĐỔI TRƯỚC KHI BAN HÀNH)   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {diffModalOpen && (
        <Modal
          open={diffModalOpen}
          onClose={() => setDiffModalOpen(false)}
          title="Thẩm Định & Đối Chiếu Thay Đổi Chính Sách (Change Diff Summary)"
          size="lg"
        >
          <div className="space-y-4 text-sm text-stone-700">
            <p className="text-xs text-stone-500">
              Kiểm tra kỹ các giá trị sẽ được cập nhật khi bạn ban hành phiên bản chính sách mới xuống toàn hệ thống cơ sở StorageHub:
            </p>

            {diffLoading ? (
              <div className="py-8 text-center text-stone-500">Đang đối chiếu thay đổi...</div>
            ) : diffItems.length === 0 ? (
              <div className="py-6 text-center text-xs text-stone-500 bg-stone-50 rounded-xl">
                Không có sự thay đổi nào giữa bản nháp và chính sách hiện tại.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                {diffItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                      item.changed
                        ? 'border-amber-300 bg-amber-50/60'
                        : 'border-stone-200 bg-stone-50/40 opacity-70'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-stone-500 text-[10px] uppercase">
                          {item.category}
                        </span>
                        {item.changed && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">
                            CÓ THAY ĐỔI
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-stone-900 text-sm block mt-0.5">
                        {item.fieldLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-right shrink-0">
                      <div className="text-stone-500 line-through">{item.oldValue}</div>
                      <span className="text-stone-400">→</span>
                      <div className={`font-bold ${item.changed ? 'text-amber-900' : 'text-stone-700'}`}>
                        {item.newValue}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-stone-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setDiffModalOpen(false)}>
                Hủy bỏ
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="bg-amber-700 hover:bg-amber-800 text-white font-bold cursor-pointer"
                onClick={() => setPublishModalOpen(true)}
              >
                Tiến Hành Ban Hành →
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* MODAL 4: PUBLISH CONFIRMATION MODAL                            */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {publishModalOpen && (
        <Modal
          open={publishModalOpen}
          onClose={() => setPublishModalOpen(false)}
          title="Xác Nhận Ban Hành Chính Sách Toàn Hệ Thống"
          size="md"
        >
          <div className="space-y-4 text-xs sm:text-sm text-stone-700">
            <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/70 text-amber-950 space-y-1">
              <span className="font-bold block text-sm">Cảnh báo hiệu lực ban hành:</span>
              <p className="text-xs leading-relaxed">
                Khi ban hành, chính sách mới sẽ <b>áp dụng tức thì đến toàn bộ các cơ sở StorageHub trên toàn quốc</b>.
                Hợp đồng ký mới và gia hạn sau ngày hiệu lực sẽ dùng thông số mới. Các hợp đồng đang hoạt động giữ nguyên đơn giá đã ký.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Ngày bắt đầu có hiệu lực (Effective From) *
                </label>
                <input
                  type="date"
                  className="w-full text-xs font-mono font-bold rounded-lg border border-stone-300 p-2.5 focus:border-amber-600 outline-none"
                  value={publishEffectiveFrom}
                  onChange={(e) => setPublishEffectiveFrom(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Ngày hết hiệu lực (Tùy chọn)
                </label>
                <input
                  type="date"
                  className="w-full text-xs font-mono font-bold rounded-lg border border-stone-300 p-2.5 focus:border-amber-600 outline-none"
                  value={publishEffectiveTo}
                  onChange={(e) => setPublishEffectiveTo(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Tóm tắt nội dung thay đổi & Căn cứ ban hành (Summary Notes) *
                </label>
                <textarea
                  rows={3}
                  className="w-full text-xs rounded-lg border border-stone-300 p-2.5 focus:border-amber-600 outline-none leading-relaxed"
                  placeholder="Ví dụ: Điều chỉnh mức sàn cọc tối thiểu lên 500.000 VNĐ và rút ngắn SLA hoàn cọc xuống 7 ngày..."
                  value={publishChangeSummary}
                  onChange={(e) => setPublishChangeSummary(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-stone-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setPublishModalOpen(false)}>
                Quay lại
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
                onClick={handleConfirmPublish}
                disabled={publishing || !publishEffectiveFrom}
              >
                {publishing ? 'Đang ban hành...' : 'Xác Nhận & Ban Hành Ngay'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* MODAL 5: ROLLBACK CONFIRMATION                                 */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {rollbackTarget && (
        <Modal
          open={Boolean(rollbackTarget)}
          onClose={() => setRollbackTarget(null)}
          title={`Khôi Phục Cấu Hình Từ Phiên Bản ${rollbackTarget.policyVersion}`}
          size="md"
        >
          <div className="space-y-4 text-xs sm:text-sm text-stone-700">
            <p>
              Bạn có chắc chắn muốn nạp lại toàn bộ thông số từ phiên bản <b>{rollbackTarget.policyVersion}</b> (ban hành ngày {rollbackTarget.publishedAt ? new Date(rollbackTarget.publishedAt).toLocaleDateString('vi-VN') : ''}) vào bản nháp hiện tại không?
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setRollbackTarget(null)}>
                Hủy
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="bg-amber-700 hover:bg-amber-800 text-white font-bold cursor-pointer"
                onClick={handleRollback}
              >
                Xác Nhận Khôi Phục
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
