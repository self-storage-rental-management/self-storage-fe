import { useState, useEffect } from 'react'
import { Badge, Button, Card, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Input } from '../../components/ui'
import { formatVnd } from '../../i18n/currency'
import { DEFAULT_BUSINESS_CONFIG, useStorageHub } from '../../store/StorageHubContext'
import { POLICIES } from '../../data/demoDatabase'
import type { User } from '../../types'
import type { BusinessConfig } from '../../types/storageHub'

interface ManagerPoliciesPanelProps {
  user: User
  showToast: (msg: string) => void
}

export default function ManagerPoliciesPanel({ user, showToast }: ManagerPoliciesPanelProps) {
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
        'Đã cập nhật và áp dụng tham số vận hành cơ sở thành công!'
      )
    } catch (err: any) {
      showToast(err?.message || 'Error updating config')
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetDefault = () => {
    const defaults: BusinessConfig = DEFAULT_BUSINESS_CONFIG
    setFormConfig(defaults)
    updateBusinessConfig(defaults, user)
    showToast('Đã khôi phục thông số vận hành mặc định.')
  }

  return (
    <div className="fade-in space-y-6">
      <SectionHeader
        title={'Quy Định & Chính Sách Vận Hành Cơ Sở'}
        subtitle={`${user.facility ?? 'Downtown Storage'} · ${
          'Quy chế lưu kho, quy trình leo thang nợ, an toàn PCCC và cấu hình thông số tự động hóa'
        }`}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              showToast(
                'Đã tải cẩm nang chính sách vận hành (PDF)!'
              )
            }
          >
            {'Tải Cẩm Nang Vận Hành'}
          </Button>
        }
      />

      {/* Live Parameter Overview Cards reflecting storeConfig */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-stone-500 font-medium">
            {'Gia hạn thanh toán nợ'}
          </p>
          <p className="text-2xl font-bold text-stone-900 mt-1">
            {storeConfig.gracePeriodDays}{' '}
            <span className="text-sm font-normal text-stone-500">{'ngày'}</span>
          </p>
          <p className="text-[11px] text-stone-500 mt-1">
            {'Sau ngày đến hạn mới áp dụng phí phạt'}
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-stone-500 font-medium">
            {'Mức phạt trễ hạn cố định'}
          </p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {formatVnd(storeConfig.lateFeeAmount)}
          </p>
          <p className="text-[11px] text-stone-500 mt-1">
            {'Áp dụng khi quá hạn thời gian ân hạn'}
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-stone-500 font-medium">
            {'Thời gian khóa giữ kho (TTL)'}
          </p>
          <p className="text-2xl font-bold text-amber-600 mt-1">
            {storeConfig.holdExpiryHours}{' '}
            <span className="text-sm font-normal text-stone-500">{'giờ'}</span>
          </p>
          <p className="text-[11px] text-stone-500 mt-1">
            {'Tự động nhả kho nếu chưa nộp cọc'}
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-stone-500 font-medium">
            {'Tỷ lệ cọc giữ chỗ trực tuyến'}
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {Math.round(storeConfig.defaultDepositRatio * 100)}%
          </p>
          <p className="text-[11px] text-stone-500 mt-1">
            {'Quy đổi thành cọc hợp đồng khi nhận kho'}
          </p>
        </div>
      </div>

      {/* Interactive Business Configuration Form */}
      <Card className="p-5 border border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-white to-stone-50 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-amber-200/60">
          <div>
            <h3 className="font-bold text-stone-900 text-base">
              {'Cấu Hình Tham Số Vận Hành Tự Động'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {'Thiết lập các ngưỡng thời gian, mức phí phạt và tỷ lệ tính toán cọc áp dụng cho toàn bộ cơ sở'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleResetDefault}>
              {'Mặc định'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isSaving}
              onClick={handleSaveConfig}
            >
              {'Lưu cấu hình'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Input
            label={'Thời gian ân hạn (ngày)'}
            type="number"
            min="1"
            max="30"
            value={String(formConfig.gracePeriodDays)}
            onChange={e => setFormConfig({ ...formConfig, gracePeriodDays: Number(e.target.value) || 7 })}
          />

          <Input
            label={'Phí phạt quá hạn (VND)'}
            type="number"
            min="0"
            max="500"
            value={String(formConfig.lateFeeAmount)}
            onChange={e => setFormConfig({ ...formConfig, lateFeeAmount: Number(e.target.value) || 25 })}
          />

          <Input
            label={'Tỷ lệ cọc giữ chỗ (0.1 - 0.5)'}
            type="number"
            step="0.05"
            min="0.1"
            max="1"
            value={String(formConfig.defaultDepositRatio)}
            onChange={e => setFormConfig({ ...formConfig, defaultDepositRatio: Number(e.target.value) || 0.2 })}
          />

          <Input
            label={'Hạn giữ chỗ thanh toán (giờ)'}
            type="number"
            min="1"
            max="72"
            value={String(formConfig.holdExpiryHours)}
            onChange={e => setFormConfig({ ...formConfig, holdExpiryHours: Number(e.target.value) || 24 })}
          />

          <Input
            label={'Hệ số thể tích DIM'}
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
          {'Danh Mục Quy Định Áp Dụng Cho Khách Thuê & Nhân Viên'}
        </h3>
        <Table>
          <Thead>
            <tr>
              <Th>{'Chính Sách'}</Th>
              <Th>{'Phạm Vi Áp Dụng'}</Th>
              <Th>{'Giá Trị Chuẩn'}</Th>
              <Th>{'Quy Trình Kiểm Tra'}</Th>
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
                    {(p.editable ? 'Cho phép sửa' : 'Cố định')}
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
