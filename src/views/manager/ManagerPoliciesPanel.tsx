import { useState, useEffect } from 'react'
import { Badge, Button, Card, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Input } from '../../components/ui'
import { formatVnd, useLanguage } from '../../i18n/LanguageContext'
import { useStorageHub } from '../../store/StorageHubContext'
import { POLICIES } from '../../data/demoDatabase'
import type { User } from '../../types'
import type { BusinessConfig } from '../../types/storageHub'

interface ManagerPoliciesPanelProps {
  user: User
  showToast: (msg: string) => void
}

export default function ManagerPoliciesPanel({ user, showToast }: ManagerPoliciesPanelProps) {
  const { lang } = useLanguage()
  const { config: storeConfig, updateBusinessConfig } = useStorageHub()

  // Local editable state for business configuration parameters
  const [formConfig, setFormConfig] = useState<BusinessConfig>(storeConfig)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setFormConfig(storeConfig)
  }, [storeConfig])

  const handleSaveConfig = () => {
    setIsSaving(true)
    try {
      updateBusinessConfig(formConfig, user)
      showToast(
        lang === 'vi'
          ? 'Đã cập nhật và áp dụng tham số vận hành cơ sở thành công!'
          : 'Facility operating parameters updated and applied successfully!'
      )
    } catch (err: any) {
      showToast(err?.message || 'Error updating config')
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetDefault = () => {
    const defaults: BusinessConfig = {
      dimDivisor: 5000,
      gracePeriodDays: 7,
      lateFeeAmount: 25,
      defaultDepositRatio: 0.2,
      holdExpiryHours: 24
    }
    setFormConfig(defaults)
    updateBusinessConfig(defaults, user)
    showToast(lang === 'vi' ? 'Đã khôi phục thông số vận hành mặc định.' : 'Reset to default operating parameters.')
  }

  return (
    <div className="fade-in space-y-6">
      <SectionHeader
        title={lang === 'vi' ? 'Quy Định & Chính Sách Vận Hành Cơ Sở' : 'Facility Operational Policies'}
        subtitle={`${user.facility ?? 'Downtown Storage'} · ${
          lang === 'vi'
            ? 'Quy chế lưu kho, quy trình leo thang nợ, an toàn PCCC và cấu hình thông số tự động hóa'
            : 'Storage terms, delinquency escalation, fire safety standards and automated operating parameters'
        }`}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              showToast(
                lang === 'vi'
                  ? 'Đã tải cẩm nang chính sách vận hành (PDF)!'
                  : 'Downloaded operational handbook (PDF)!'
              )
            }
          >
            {lang === 'vi' ? 'Tải Cẩm Nang Vận Hành' : 'Download Handbook'}
          </Button>
        }
      />

      {/* Live Parameter Overview Cards reflecting storeConfig */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-stone-500 font-medium">
            {lang === 'vi' ? 'Gia hạn thanh toán nợ' : 'Grace Period'}
          </p>
          <p className="text-2xl font-bold text-stone-900 mt-1">
            {storeConfig.gracePeriodDays}{' '}
            <span className="text-sm font-normal text-stone-500">{lang === 'vi' ? 'ngày' : 'days'}</span>
          </p>
          <p className="text-[11px] text-stone-500 mt-1">
            {lang === 'vi' ? 'Sau ngày đến hạn mới áp dụng phí phạt' : 'Before late penalty applies'}
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-stone-500 font-medium">
            {lang === 'vi' ? 'Mức phạt trễ hạn cố định' : 'Fixed Late Fee'}
          </p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {formatVnd(storeConfig.lateFeeAmount)}
          </p>
          <p className="text-[11px] text-stone-500 mt-1">
            {lang === 'vi' ? 'Áp dụng khi quá hạn thời gian ân hạn' : 'Charged after grace period expires'}
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-stone-500 font-medium">
            {lang === 'vi' ? 'Thời gian khóa giữ kho (TTL)' : 'Unit Hold TTL'}
          </p>
          <p className="text-2xl font-bold text-amber-600 mt-1">
            {storeConfig.holdExpiryHours}{' '}
            <span className="text-sm font-normal text-stone-500">{lang === 'vi' ? 'giờ' : 'hours'}</span>
          </p>
          <p className="text-[11px] text-stone-500 mt-1">
            {lang === 'vi' ? 'Tự động nhả kho nếu chưa nộp cọc' : 'Auto-releases if unpaid'}
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-stone-500 font-medium">
            {lang === 'vi' ? 'Tỷ lệ cọc giữ chỗ trực tuyến' : 'Online Booking Deposit'}
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {Math.round(storeConfig.defaultDepositRatio * 100)}%
          </p>
          <p className="text-[11px] text-stone-500 mt-1">
            {lang === 'vi' ? 'Quy đổi thành cọc hợp đồng khi nhận kho' : 'Credited towards contract deposit'}
          </p>
        </div>
      </div>

      {/* Interactive Business Configuration Form */}
      <Card className="p-5 border border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-white to-stone-50 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-amber-200/60">
          <div>
            <h3 className="font-bold text-stone-900 text-base">
              {lang === 'vi' ? 'Cấu Hình Tham Số Vận Hành Tự Động' : 'Automated Operating Parameters Control'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {lang === 'vi'
                ? 'Thiết lập các ngưỡng thời gian, mức phí phạt và tỷ lệ tính toán cọc áp dụng cho toàn bộ cơ sở'
                : 'Configure thresholds, penalty calculations, and deposit rules enforced facility-wide'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleResetDefault}>
              {lang === 'vi' ? 'Mặc định' : 'Reset Defaults'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isSaving}
              onClick={handleSaveConfig}
            >
              {lang === 'vi' ? 'Lưu cấu hình' : 'Save Parameters'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Input
            label={lang === 'vi' ? 'Thời gian ân hạn (ngày)' : 'Grace Period (Days)'}
            type="number"
            min="1"
            max="30"
            value={String(formConfig.gracePeriodDays)}
            onChange={e => setFormConfig({ ...formConfig, gracePeriodDays: Number(e.target.value) || 7 })}
          />

          <Input
            label={lang === 'vi' ? 'Phí phạt quá hạn (VND)' : 'Late Fee Amount (VND)'}
            type="number"
            min="0"
            max="500"
            value={String(formConfig.lateFeeAmount)}
            onChange={e => setFormConfig({ ...formConfig, lateFeeAmount: Number(e.target.value) || 25 })}
          />

          <Input
            label={lang === 'vi' ? 'Tỷ lệ cọc giữ chỗ (0.1 - 0.5)' : 'Booking Deposit Ratio'}
            type="number"
            step="0.05"
            min="0.1"
            max="1"
            value={String(formConfig.defaultDepositRatio)}
            onChange={e => setFormConfig({ ...formConfig, defaultDepositRatio: Number(e.target.value) || 0.2 })}
          />

          <Input
            label={lang === 'vi' ? 'Hạn giữ chỗ thanh toán (giờ)' : 'Hold Expiry (Hours)'}
            type="number"
            min="1"
            max="72"
            value={String(formConfig.holdExpiryHours)}
            onChange={e => setFormConfig({ ...formConfig, holdExpiryHours: Number(e.target.value) || 24 })}
          />

          <Input
            label={lang === 'vi' ? 'Hệ số thể tích DIM' : 'DIM Divisor'}
            type="number"
            min="1000"
            max="10000"
            value={String(formConfig.dimDivisor)}
            onChange={e => setFormConfig({ ...formConfig, dimDivisor: Number(e.target.value) || 5000 })}
          />
        </div>
      </Card>

      {/* Detailed Policies Table */}
      <Card className="p-5 border border-stone-200 shadow-sm">
        <h3 className="font-bold text-stone-900 text-base mb-3">
          {lang === 'vi'
            ? 'Danh Mục Quy Định Áp Dụng Cho Khách Thuê & Nhân Viên'
            : 'Operational Policy Matrix'}
        </h3>
        <Table>
          <Thead>
            <tr>
              <Th>{lang === 'vi' ? 'Chính Sách' : 'Policy'}</Th>
              <Th>{lang === 'vi' ? 'Phạm Vi Áp Dụng' : 'Scope'}</Th>
              <Th>{lang === 'vi' ? 'Giá Trị Chuẩn' : 'Standard Value'}</Th>
              <Th>{lang === 'vi' ? 'Quy Trình Kiểm Tra' : 'Enforcement Protocol'}</Th>
            </tr>
          </Thead>
          <Tbody>
            {POLICIES.map(p => (
              <Tr key={p.id}>
                <Td>
                  <span className="font-bold text-sm text-stone-900">{p.name}</span>
                </Td>
                <Td>
                  <span className="text-xs text-stone-600">{p.scope}</span>
                </Td>
                <Td>
                  <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-xs">
                    {p.value}
                  </span>
                </Td>
                <Td>
                  <Badge variant={p.editable ? 'success' : 'muted'}>
                    {lang === 'vi' ? (p.editable ? 'Cho phép sửa' : 'Cố định') : (p.editable ? 'Configurable' : 'Fixed')}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>
    </div>
  )
}
